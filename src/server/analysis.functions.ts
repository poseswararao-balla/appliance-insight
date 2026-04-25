import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const analysisInput = z.object({
  appliance_type: z.string().min(1).max(100),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  age_years: z.number().min(0).max(50),
  daily_usage_hours: z.number().min(0).max(24),
  power_rating_watts: z.number().min(0).max(20000).optional().nullable(),
  electricity_rate: z.number().min(0).max(5),
});

type CatalogRow = {
  appliance_type: string;
  brand: string | null;
  model: string | null;
  power_rating_watts: number;
  max_life_years: number;
  energy_star: boolean | null;
};

interface MatchResult {
  power: number;
  maxLife: number;
  method: "exact" | "brand_avg" | "type_avg" | "ai_predicted";
  confidence: "High" | "Medium" | "Low";
}

function avg(rows: CatalogRow[], key: "power_rating_watts" | "max_life_years"): number {
  if (!rows.length) return 0;
  return rows.reduce((s, r) => s + Number(r[key]), 0) / rows.length;
}

async function matchAppliance(
  type: string,
  brand: string | null | undefined,
  model: string | null | undefined,
): Promise<MatchResult & { catalog: CatalogRow[] }> {
  const { data: catalog } = await supabaseAdmin
    .from("appliance_catalog")
    .select("*")
    .ilike("appliance_type", type);

  const rows = (catalog ?? []) as CatalogRow[];

  // Level 1: exact brand+model
  if (brand && model) {
    const exact = rows.find(
      (r) =>
        r.brand?.toLowerCase() === brand.toLowerCase() &&
        r.model?.toLowerCase() === model.toLowerCase(),
    );
    if (exact) {
      return {
        power: Number(exact.power_rating_watts),
        maxLife: Number(exact.max_life_years),
        method: "exact",
        confidence: "High",
        catalog: rows,
      };
    }
  }

  // Level 2: brand average
  if (brand) {
    const brandRows = rows.filter((r) => r.brand?.toLowerCase() === brand.toLowerCase());
    if (brandRows.length) {
      return {
        power: avg(brandRows, "power_rating_watts"),
        maxLife: avg(brandRows, "max_life_years"),
        method: "brand_avg",
        confidence: "Medium",
        catalog: rows,
      };
    }
  }

  // Level 3: type average
  if (rows.length) {
    return {
      power: avg(rows, "power_rating_watts"),
      maxLife: avg(rows, "max_life_years"),
      method: "type_avg",
      confidence: "Medium",
      catalog: rows,
    };
  }

  // Level 4: AI prediction
  return {
    power: 0,
    maxLife: 10,
    method: "ai_predicted",
    confidence: "Low",
    catalog: rows,
  };
}

async function aiPredictPower(
  type: string,
  brand: string | null | undefined,
  model: string | null | undefined,
): Promise<{ power: number; maxLife: number } | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an appliance energy expert. Predict realistic typical power consumption (in watts) and max useful life (in years) for household appliances. Use industry averages.",
        },
        {
          role: "user",
          content: `Appliance type: ${type}\nBrand: ${brand ?? "unknown"}\nModel: ${model ?? "unknown"}\n\nReturn typical power rating in watts and max life in years.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "predict_specs",
            description: "Return predicted appliance specs",
            parameters: {
              type: "object",
              properties: {
                power_watts: { type: "number" },
                max_life_years: { type: "number" },
              },
              required: ["power_watts", "max_life_years"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "predict_specs" } },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    const parsed = JSON.parse(args);
    return { power: Number(parsed.power_watts), maxLife: Number(parsed.max_life_years) };
  } catch {
    return null;
  }
}

async function aiSummary(payload: {
  type: string;
  brand: string | null | undefined;
  model: string | null | undefined;
  age: number;
  efficiencyLoss: number;
  monthlyExtra: number;
  healthScore: number;
  fiveYearCost: number;
}): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an energy efficiency advisor. Write a concise 2-3 sentence personalized summary about an appliance's energy condition and what the user should consider doing. Be specific and actionable. No greetings, no bullet points.",
          },
          {
            role: "user",
            content: `${payload.type} (${payload.brand ?? "unknown brand"} ${payload.model ?? ""}), ${payload.age} years old. Efficiency loss: ${payload.efficiencyLoss.toFixed(1)}%. Monthly extra cost: $${payload.monthlyExtra.toFixed(2)}. Health score: ${payload.healthScore.toFixed(0)}/100. 5-year energy cost: $${payload.fiveYearCost.toFixed(0)}.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export const analyzeAppliance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => analysisInput.parse(input))
  .handler(async ({ data }) => {
    let match = await matchAppliance(data.appliance_type, data.brand, data.model);

    // Fall back to AI prediction if no catalog data
    if (match.method === "ai_predicted") {
      const aiPred = await aiPredictPower(data.appliance_type, data.brand, data.model);
      if (aiPred) {
        match = { ...match, power: aiPred.power, maxLife: aiPred.maxLife };
      } else {
        match = { ...match, power: 500, maxLife: 10 }; // safe default
      }
    }

    // User-provided power overrides
    const ratedPower = data.power_rating_watts && data.power_rating_watts > 0
      ? data.power_rating_watts
      : match.power;

    // Aging model: efficiency loss grows with age. Caps at 60%.
    // Loss = min(60, 4% * age + 0.5% * age^2)
    const efficiencyLoss = Math.min(60, 4 * data.age_years + 0.5 * data.age_years ** 2);
    const currentPower = ratedPower * (1 + efficiencyLoss / 100);

    // Monthly: 30 days
    const monthlyKwh = (currentPower * data.daily_usage_hours * 30) / 1000;
    const idealMonthlyKwh = (ratedPower * data.daily_usage_hours * 30) / 1000;
    const monthlyCost = monthlyKwh * data.electricity_rate;
    const monthlyExtraCost = (monthlyKwh - idealMonthlyKwh) * data.electricity_rate;

    const remainingLife = Math.max(0, match.maxLife - data.age_years);
    const healthScore = Math.max(0, Math.min(100, 100 - efficiencyLoss - (data.age_years / match.maxLife) * 30));

    // 5-year forecast with continued degradation
    const futureTrend: { year: number; kwh: number; cost: number; efficiency_loss: number }[] = [];
    for (let i = 1; i <= 5; i++) {
      const futureAge = data.age_years + i;
      const futureLoss = Math.min(75, 4 * futureAge + 0.5 * futureAge ** 2);
      const futurePower = ratedPower * (1 + futureLoss / 100);
      const yearlyKwh = (futurePower * data.daily_usage_hours * 365) / 1000;
      futureTrend.push({
        year: i,
        kwh: yearlyKwh,
        cost: yearlyKwh * data.electricity_rate,
        efficiency_loss: futureLoss,
      });
    }
    const fiveYearCost = futureTrend.reduce((s, y) => s + y.cost, 0);

    // Recommendations: efficient catalog entries with same type
    const efficientOptions = match.catalog
      .filter((c) => c.brand && c.model)
      .sort((a, b) => Number(a.power_rating_watts) - Number(b.power_rating_watts))
      .slice(0, 3)
      .map((c) => {
        const newMonthlyKwh = (Number(c.power_rating_watts) * data.daily_usage_hours * 30) / 1000;
        const newMonthlyCost = newMonthlyKwh * data.electricity_rate;
        const monthlySavings = monthlyCost - newMonthlyCost;
        return {
          brand: c.brand,
          model: c.model,
          power_watts: Number(c.power_rating_watts),
          max_life_years: Number(c.max_life_years),
          energy_star: !!c.energy_star,
          monthly_savings: Math.max(0, monthlySavings),
          yearly_savings: Math.max(0, monthlySavings * 12),
        };
      })
      .filter((r) => r.power_watts < ratedPower);

    const summary = await aiSummary({
      type: data.appliance_type,
      brand: data.brand,
      model: data.model,
      age: data.age_years,
      efficiencyLoss,
      monthlyExtra: monthlyExtraCost,
      healthScore,
      fiveYearCost,
    });

    return {
      efficiency_loss_pc: Number(efficiencyLoss.toFixed(2)),
      current_power_w: Number(currentPower.toFixed(2)),
      rated_power_w: Number(ratedPower.toFixed(2)),
      monthly_kwh: Number(monthlyKwh.toFixed(2)),
      monthly_cost: Number(monthlyCost.toFixed(2)),
      monthly_extra_cost: Number(monthlyExtraCost.toFixed(2)),
      health_score: Number(healthScore.toFixed(1)),
      remaining_life_years: Number(remainingLife.toFixed(1)),
      five_year_cost: Number(fiveYearCost.toFixed(2)),
      confidence: match.confidence,
      match_method: match.method,
      future_trend: futureTrend,
      recommendations: efficientOptions,
      summary,
    };
  });

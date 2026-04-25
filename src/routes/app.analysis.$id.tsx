import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Activity, Zap, DollarSign, Heart, TrendingDown, Brain, Award } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { analyzeAppliance } from "@/server/analysis.functions";

export const Route = createFileRoute("/app/analysis/$id")({
  component: AnalysisPage,
});

interface Recommendation {
  brand: string;
  model: string;
  power_watts: number;
  max_life_years: number;
  energy_star: boolean;
  monthly_savings: number;
  yearly_savings: number;
}

interface FutureYear {
  year: number;
  kwh: number;
  cost: number;
  efficiency_loss: number;
}

interface AppRow {
  id: string;
  appliance_type: string;
  brand: string | null;
  model: string | null;
  age_years: number;
  daily_usage_hours: number;
  power_rating_watts: number | null;
  electricity_rate: number;
}

interface AnalysisRow {
  id: string;
  efficiency_loss_pc: number;
  current_power_w: number;
  monthly_kwh: number;
  monthly_cost: number;
  monthly_extra_cost: number;
  health_score: number;
  remaining_life_years: number;
  five_year_cost: number;
  confidence: string;
  match_method: string;
  future_trend: FutureYear[];
  recommendations: Recommendation[];
  summary: string | null;
}

function AnalysisPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [appliance, setAppliance] = useState<AppRow | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  async function load() {
    setLoading(true);
    const { data: app, error } = await supabase
      .from("appliances")
      .select("id, appliance_type, brand, model, age_years, daily_usage_hours, power_rating_watts, electricity_rate")
      .eq("id", id)
      .single();
    if (error || !app) {
      toast.error("Appliance not found");
      navigate({ to: "/app/dashboard" });
      return;
    }
    setAppliance(app as AppRow);

    const { data: ana } = await supabase
      .from("analyses")
      .select("*")
      .eq("appliance_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ana) setAnalysis(ana as unknown as AnalysisRow);
    setLoading(false);
  }

  async function runAnalysis() {
    if (!appliance || !user) return;
    setRunning(true);
    try {
      const result = await analyzeAppliance({
        data: {
          appliance_type: appliance.appliance_type,
          brand: appliance.brand,
          model: appliance.model,
          age_years: Number(appliance.age_years),
          daily_usage_hours: Number(appliance.daily_usage_hours),
          power_rating_watts: appliance.power_rating_watts ? Number(appliance.power_rating_watts) : null,
          electricity_rate: Number(appliance.electricity_rate),
        },
      });
      const { data: ana, error } = await supabase
        .from("analyses")
        .insert({
          appliance_id: appliance.id,
          user_id: user.id,
          efficiency_loss_pc: result.efficiency_loss_pc,
          current_power_w: result.current_power_w,
          monthly_kwh: result.monthly_kwh,
          monthly_cost: result.monthly_cost,
          monthly_extra_cost: result.monthly_extra_cost,
          health_score: result.health_score,
          remaining_life_years: result.remaining_life_years,
          five_year_cost: result.five_year_cost,
          confidence: result.confidence,
          match_method: result.match_method,
          future_trend: result.future_trend,
          recommendations: result.recommendations,
          summary: result.summary,
        })
        .select("*")
        .single();
      if (error) throw error;
      setAnalysis(ana as unknown as AnalysisRow);
      toast.success("Analysis complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!appliance) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/app/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("backToDashboard")}
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 rounded-3xl border border-border bg-gradient-card p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {appliance.appliance_type}
          </span>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {appliance.brand && appliance.model ? `${appliance.brand} ${appliance.model}` : appliance.brand ?? appliance.model ?? "Generic appliance"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {Number(appliance.age_years)} years old · {Number(appliance.daily_usage_hours)} hours/day · ${Number(appliance.electricity_rate)}/kWh
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={running} variant="outline" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {running ? t("analyzing") : "Re-run analysis"}
        </Button>
      </div>

      {!analysis ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Brain className="mx-auto h-10 w-10 text-primary" />
          <h3 className="mt-4 font-display text-xl font-semibold">No analysis yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">Run AI analysis to see efficiency, costs, and recommendations.</p>
          <Button onClick={runAnalysis} disabled={running} className="mt-6 bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90">
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("analyzing")}</> : t("runAnalysis")}
          </Button>
        </div>
      ) : (
        <AnalysisView analysis={analysis} appliance={appliance} />
      )}
    </div>
  );
}

function AnalysisView({ analysis, appliance }: { analysis: AnalysisRow; appliance: AppRow }) {
  const { t } = useI18n();

  const ratedPower = appliance.power_rating_watts && Number(appliance.power_rating_watts) > 0
    ? Number(appliance.power_rating_watts)
    : analysis.current_power_w / (1 + Number(analysis.efficiency_loss_pc) / 100);

  const powerCompare = [
    { name: t("rated"), watts: Math.round(ratedPower) },
    { name: t("actual"), watts: Math.round(Number(analysis.current_power_w)) },
  ];

  const lossPie = [
    { name: "Useful", value: Math.max(0, 100 - Number(analysis.efficiency_loss_pc)) },
    { name: "Lost", value: Number(analysis.efficiency_loss_pc) },
  ];
  const PIE_COLORS = ["oklch(0.52 0.16 158)", "oklch(0.78 0.16 75)"];

  const future = analysis.future_trend ?? [];

  const confColor =
    analysis.confidence === "High" ? "bg-success/15 text-success border-success/30"
    : analysis.confidence === "Medium" ? "bg-accent/20 text-accent-foreground border-accent/40"
    : "bg-muted text-muted-foreground border-border";

  const methodLabel: Record<string, string> = {
    exact: t("exact"),
    brand_avg: t("brandAvg"),
    type_avg: t("typeAvg"),
    ai_predicted: t("aiPredicted"),
  };

  return (
    <div className="space-y-6">
      {/* AI summary */}
      {analysis.summary && (
        <Card className="border-primary/30 bg-gradient-primary text-primary-foreground shadow-glow">
          <CardContent className="flex gap-4 p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/20">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider opacity-90">{t("aiSummary")}</h3>
              <p className="mt-1.5 text-sm leading-relaxed sm:text-base">{analysis.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI icon={TrendingDown} label={t("efficiencyLoss")} value={`${Number(analysis.efficiency_loss_pc).toFixed(1)}%`} accent />
        <KPI icon={DollarSign} label={t("monthlyExtra")} value={`$${Number(analysis.monthly_extra_cost).toFixed(2)}`} />
        <KPI icon={Heart} label={t("healthScore")} value={`${Math.round(Number(analysis.health_score))}/100`} success={Number(analysis.health_score) > 60} />
        <KPI icon={Zap} label={t("fiveYearCost")} value={`$${Math.round(Number(analysis.five_year_cost))}`} />
      </div>

      {/* Confidence + match */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${confColor}`}>
          {t("confidence")}: {analysis.confidence}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
          {t("matchMethod")}: {methodLabel[analysis.match_method] ?? analysis.match_method}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
          {Number(analysis.remaining_life_years).toFixed(1)} {t("yearsRemaining")}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
          {Number(analysis.monthly_kwh).toFixed(1)} kWh · {t("monthlyConsumption")}
        </span>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border bg-gradient-card">
          <CardContent className="p-6">
            <h3 className="font-display text-lg font-semibold">{t("powerComparison")}</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={powerCompare}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.015 150)" />
                  <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
                  <YAxis stroke="currentColor" fontSize={12} unit="W" />
                  <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.9 0.015 150)", borderRadius: 12 }} />
                  <Bar dataKey="watts" radius={[8, 8, 0, 0]} fill="oklch(0.52 0.16 158)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-gradient-card">
          <CardContent className="p-6">
            <h3 className="font-display text-lg font-semibold">{t("energyBreakdown")}</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={lossPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {lossPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.9 0.015 150)", borderRadius: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Future forecast */}
      <Card className="border-border bg-gradient-card">
        <CardContent className="p-6">
          <h3 className="font-display text-lg font-semibold">{t("futureForecast")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Projected yearly energy consumption and cost over the next 5 years.</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={future.map((f) => ({ year: `Y${f.year}`, kWh: Math.round(f.kwh), Cost: Math.round(f.cost) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.015 150)" />
                <XAxis dataKey="year" stroke="currentColor" fontSize={12} />
                <YAxis yAxisId="left" stroke="oklch(0.52 0.16 158)" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="oklch(0.78 0.16 75)" fontSize={12} unit="$" />
                <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.9 0.015 150)", borderRadius: 12 }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="kWh" stroke="oklch(0.52 0.16 158)" strokeWidth={3} dot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="Cost" stroke="oklch(0.78 0.16 75)" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <Card className="border-border bg-gradient-card">
          <CardContent className="p-6">
            <h3 className="font-display text-lg font-semibold">{t("recommendations")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">More efficient alternatives sorted by power consumption.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {analysis.recommendations.map((r, i) => (
                <div key={i} className="rounded-2xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display font-semibold">{r.brand} {r.model}</p>
                      <p className="text-xs text-muted-foreground">{r.power_watts}W · {r.max_life_years} yr life</p>
                    </div>
                    {r.energy_star && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                        <Award className="h-3 w-3" /> Star
                      </span>
                    )}
                  </div>
                  <div className="mt-3 rounded-xl bg-success/10 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-success">{t("save")}</p>
                    <p className="font-display text-xl font-bold text-success">${r.yearly_savings.toFixed(0)}<span className="text-xs font-normal opacity-70">{t("perYear")}</span></p>
                    <p className="mt-1 text-[11px] text-muted-foreground">${(r.yearly_savings * 5).toFixed(0)} {t("save5y")}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  accent,
  success,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  success?: boolean;
}) {
  const tone = success
    ? "from-success/15 to-success/5 text-success border-success/20"
    : accent
    ? "from-accent/20 to-accent/5 text-accent-foreground border-accent/30"
    : "from-primary/10 to-primary/0 text-primary border-primary/20";
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tone} p-4 shadow-soft`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

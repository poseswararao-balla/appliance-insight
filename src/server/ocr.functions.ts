import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const ocrInput = z.object({
  image_data_url: z.string().min(20).max(15_000_000),
});

export const ocrApplianceLabel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ocrInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "AI service not configured", appliance_type: null, brand: null, model: null, power_rating_watts: null };
    }

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
              "You extract appliance specifications from photos of appliance labels, nameplates, or rating stickers.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract appliance details from this label image." },
              { type: "image_url", image_url: { url: data.image_data_url } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_appliance",
              description: "Extracted appliance specs from label",
              parameters: {
                type: "object",
                properties: {
                  appliance_type: {
                    type: "string",
                    description: "e.g. Refrigerator, Air Conditioner, Washing Machine, Television, Ceiling Fan, Microwave, Water Heater, Dishwasher",
                  },
                  brand: { type: "string" },
                  model: { type: "string" },
                  power_rating_watts: { type: "number" },
                },
                required: ["appliance_type"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_appliance" } },
      }),
    });

    if (res.status === 429) {
      return { error: "Rate limited. Please try again in a moment.", appliance_type: null, brand: null, model: null, power_rating_watts: null };
    }
    if (res.status === 402) {
      return { error: "AI credits exhausted. Add credits in workspace settings.", appliance_type: null, brand: null, model: null, power_rating_watts: null };
    }
    if (!res.ok) {
      return { error: "Could not read label", appliance_type: null, brand: null, model: null, power_rating_watts: null };
    }

    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return { error: "Could not extract details", appliance_type: null, brand: null, model: null, power_rating_watts: null };
    }
    try {
      const parsed = JSON.parse(args);
      return {
        error: null,
        appliance_type: parsed.appliance_type ?? null,
        brand: parsed.brand ?? null,
        model: parsed.model ?? null,
        power_rating_watts: parsed.power_rating_watts ?? null,
      };
    } catch {
      return { error: "Parse failed", appliance_type: null, brand: null, model: null, power_rating_watts: null };
    }
  });

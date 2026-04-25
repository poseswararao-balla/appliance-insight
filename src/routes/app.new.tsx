import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, ScanLine, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { ocrApplianceLabel } from "@/server/ocr.functions";
import { analyzeAppliance } from "@/server/analysis.functions";

export const Route = createFileRoute("/app/new")({
  component: NewAppliance,
});

const APPLIANCE_TYPES = [
  "Refrigerator",
  "Air Conditioner",
  "Washing Machine",
  "Television",
  "Ceiling Fan",
  "Microwave",
  "Water Heater",
  "Dishwasher",
  "Iron",
  "Geyser",
  "Computer",
  "Laptop",
  "Other",
];

const schema = z.object({
  appliance_type: z.string().min(1).max(100),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  age_years: z.coerce.number().min(0).max(50),
  daily_usage_hours: z.coerce.number().min(0).max(24),
  power_rating_watts: z.coerce.number().min(0).max(20000).optional(),
  electricity_rate: z.coerce.number().min(0).max(5),
});

function NewAppliance() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    appliance_type: "",
    brand: "",
    model: "",
    age_years: "",
    daily_usage_hours: "",
    power_rating_watts: "",
    electricity_rate: "0.15",
  });
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("Read failed"));
      r.readAsDataURL(file);
    });
  }

  async function handleImage(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8 MB)");
      return;
    }
    setScanning(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      const result = await ocrApplianceLabel({ data: { image_data_url: dataUrl } });
      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.appliance_type) update("appliance_type", result.appliance_type);
        if (result.brand) update("brand", result.brand);
        if (result.model) update("model", result.model);
        if (result.power_rating_watts) update("power_rating_watts", String(result.power_rating_watts));
        toast.success("Label scanned!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({
      ...form,
      brand: form.brand || undefined,
      model: form.model || undefined,
      power_rating_watts: form.power_rating_watts || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the inputs");
      return;
    }

    setSubmitting(true);
    try {
      // Insert appliance
      const { data: app, error: insErr } = await supabase
        .from("appliances")
        .insert({
          user_id: user.id,
          appliance_type: parsed.data.appliance_type,
          brand: parsed.data.brand ?? null,
          model: parsed.data.model ?? null,
          age_years: parsed.data.age_years,
          daily_usage_hours: parsed.data.daily_usage_hours,
          power_rating_watts: parsed.data.power_rating_watts ?? null,
          electricity_rate: parsed.data.electricity_rate,
        })
        .select("id")
        .single();
      if (insErr || !app) throw insErr ?? new Error("Insert failed");

      // Run AI analysis
      const result = await analyzeAppliance({
        data: {
          appliance_type: parsed.data.appliance_type,
          brand: parsed.data.brand ?? null,
          model: parsed.data.model ?? null,
          age_years: parsed.data.age_years,
          daily_usage_hours: parsed.data.daily_usage_hours,
          power_rating_watts: parsed.data.power_rating_watts ?? null,
          electricity_rate: parsed.data.electricity_rate,
        },
      });

      // Save analysis
      const { error: anErr } = await supabase.from("analyses").insert({
        appliance_id: app.id,
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
      });
      if (anErr) throw anErr;

      toast.success("Analysis complete!");
      navigate({ to: "/app/analysis/$id", params: { id: app.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("backToDashboard")}
      </Link>

      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("addAppliance")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tell us about your appliance — even if you don't know the exact model.</p>

      <Card className="mt-6 border-border bg-gradient-card shadow-soft">
        <CardContent className="p-6 sm:p-8">
          <Tabs defaultValue="manual">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="gap-2">
                <Sparkles className="h-4 w-4" /> {t("manualEntry")}
              </TabsTrigger>
              <TabsTrigger value="scan" className="gap-2">
                <ScanLine className="h-4 w-4" /> {t("smartScan")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="m-0" />

            <TabsContent value="scan" className="m-0">
              <div
                onClick={() => fileRef.current?.click()}
                className="mb-6 cursor-pointer rounded-2xl border-2 border-dashed border-border bg-secondary/40 p-8 text-center transition-colors hover:border-primary hover:bg-secondary/60"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="mx-auto max-h-48 rounded-xl object-contain" />
                ) : (
                  <>
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    </div>
                    <p className="font-medium">{scanning ? t("extractingLabel") : t("uploadLabel")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("uploadHint")}</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImage(f);
                  }}
                />
              </div>
              {previewUrl && (
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="mb-6 w-full gap-2">
                  <Upload className="h-4 w-4" /> Re-scan another image
                </Button>
              )}
            </TabsContent>
          </Tabs>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t("applianceType")} *</Label>
              <Select value={form.appliance_type} onValueChange={(v) => update("appliance_type", v)}>
                <SelectTrigger className="mt-1.5 h-11">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {APPLIANCE_TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("brand")} <span className="text-xs text-muted-foreground">({t("optional")})</span></Label>
              <Input value={form.brand} onChange={(e) => update("brand", e.target.value)} className="mt-1.5 h-11" placeholder="e.g. Samsung" />
            </div>
            <div>
              <Label>{t("model")} <span className="text-xs text-muted-foreground">({t("optional")})</span></Label>
              <Input value={form.model} onChange={(e) => update("model", e.target.value)} className="mt-1.5 h-11" placeholder="e.g. RT28" />
            </div>

            <div>
              <Label>{t("age")} *</Label>
              <Input type="number" step="0.5" min="0" max="50" value={form.age_years} onChange={(e) => update("age_years", e.target.value)} required className="mt-1.5 h-11" placeholder="0" />
            </div>
            <div>
              <Label>{t("dailyUsage")} *</Label>
              <Input type="number" step="0.5" min="0" max="24" value={form.daily_usage_hours} onChange={(e) => update("daily_usage_hours", e.target.value)} required className="mt-1.5 h-11" placeholder="0" />
            </div>

            <div>
              <Label>{t("powerRating")} <span className="text-xs text-muted-foreground">({t("optional")})</span></Label>
              <Input type="number" step="1" min="0" value={form.power_rating_watts} onChange={(e) => update("power_rating_watts", e.target.value)} className="mt-1.5 h-11" placeholder="Auto-detected if empty" />
            </div>
            <div>
              <Label>{t("electricityRate")}</Label>
              <Input type="number" step="0.01" min="0" value={form.electricity_rate} onChange={(e) => update("electricity_rate", e.target.value)} className="mt-1.5 h-11" />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting} className="h-12 w-full bg-gradient-primary text-base text-primary-foreground shadow-glow hover:opacity-90">
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("analyzing")}</>
                ) : (
                  <>{t("runAnalysis")} →</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Activity, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

interface Row {
  id: string;
  appliance_type: string;
  brand: string | null;
  model: string | null;
  age_years: number;
  daily_usage_hours: number;
  created_at: string;
  analyses?: { id: string; health_score: number; efficiency_loss_pc: number; monthly_extra_cost: number }[];
}

function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("appliances")
      .select("id, appliance_type, brand, model, age_years, daily_usage_hours, created_at, analyses(id, health_score, efficiency_loss_pc, monthly_extra_cost)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("appliances").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Appliance removed");
      setRows((r) => r.filter((x) => x.id !== id));
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("yourAppliances")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track aging, predict costs, and find smarter replacements.</p>
        </div>
        <Link to="/app/new">
          <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" /> {t("addAppliance")}
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-card/50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const latest = r.analyses?.[0];
            return (
              <Card key={r.id} className="group overflow-hidden border-border bg-gradient-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-glow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {r.appliance_type}
                      </span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <h3 className="mt-3 font-display text-lg font-semibold leading-tight">
                    {r.brand && r.model ? `${r.brand} ${r.model}` : r.brand ?? r.model ?? "Generic appliance"}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {Number(r.age_years)} yrs old · {Number(r.daily_usage_hours)} h/day
                  </p>

                  {latest ? (
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-secondary/50 p-3">
                      <Stat label="Health" value={`${Math.round(latest.health_score)}`} />
                      <Stat label="Loss" value={`${Math.round(latest.efficiency_loss_pc)}%`} />
                      <Stat label="$/mo" value={`$${Number(latest.monthly_extra_cost).toFixed(1)}`} />
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-center text-xs text-muted-foreground">
                      No analysis yet
                    </div>
                  )}

                  <Link to="/app/analysis/$id" params={{ id: r.id }}>
                    <Button variant="outline" className="mt-4 w-full gap-2">
                      <Activity className="h-4 w-4" />
                      {latest ? t("overview") : t("runAnalysis")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-base font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-display text-xl font-semibold">{t("noAppliances")}</h3>
      <p className="mt-2 text-sm text-muted-foreground">Start by adding any appliance — even if you don't know the model.</p>
      <Link to="/app/new">
        <Button className="mt-6 bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> {t("addAppliance")}
        </Button>
      </Link>
    </div>
  );
}

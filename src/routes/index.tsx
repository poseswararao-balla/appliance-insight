import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Zap, Brain, TrendingUp, ScanLine, Globe, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="container mx-auto flex items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">{t("appName")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to="/auth/login">
            <Button variant="ghost" size="sm">{t("signIn")}</Button>
          </Link>
          <Link to="/auth/signup">
            <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90">
              {t("signUp")}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 pb-24 pt-12 sm:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>
            {t("tagline")}
          </div>
          <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            {t("heroSub")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth/signup">
              <Button size="lg" className="h-12 bg-gradient-primary px-8 text-base text-primary-foreground shadow-glow hover:opacity-90">
                {t("getStarted")} →
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                {t("signIn")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats / preview */}
        <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { icon: Brain, title: "AI-Powered Matching", desc: "Handles unknown models with 4-level intelligent prediction." },
            { icon: TrendingUp, title: "5-Year Forecasts", desc: "Predict future energy use & costs with degradation curves." },
            { icon: ScanLine, title: "Smart Label Scan", desc: "Photograph the rating sticker — we extract specs instantly." },
            { icon: Zap, title: "Health Score", desc: "0–100 score reveals real efficiency loss vs ideal." },
            { icon: Globe, title: "Multi-language", desc: "Available in English, हिन्दी, తెలుగు & தமிழ்." },
            { icon: ShieldCheck, title: "Private & Secure", desc: "Your appliance data is encrypted and tied to your account." },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border bg-card/30 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VoltaWise · Smart Appliance Aging & Energy Efficiency Analyzer
      </footer>
    </div>
  );
}

import { Outlet, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Zap, LayoutDashboard, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/app/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">{t("appName")}</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/app/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <LayoutDashboard className="h-4 w-4" /> {t("dashboard")}
              </Button>
            </Link>
            <Link to="/app/new">
              <Button variant="ghost" size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> {t("addAppliance")}
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium sm:flex">
              <div className="h-2 w-2 rounded-full bg-success" />
              {user.email}
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title={t("signOut")}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

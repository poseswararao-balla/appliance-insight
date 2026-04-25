import { Outlet, createFileRoute, Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="container mx-auto flex items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">{t("appName")}</span>
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="container mx-auto flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}

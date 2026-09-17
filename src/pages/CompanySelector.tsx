import pkg from "../../package.json";
import { useNavigate, Navigate } from "react-router-dom";
import { useCompany } from "@/context/CompanyContext";
import { useAuth } from "@/context/AuthContext";
import type { Company } from "@/types";
import { ArrowRight, LogOut, Building2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

function getCompanyTheme(company: Company) {
  const slug = company.slug?.toLowerCase() || "";

  if (slug === "mira-ve" || slug.includes("mira")) {
    return {
      iconBox:
        "bg-amber-50 text-amber-600 border-amber-200/80 group-hover:bg-amber-100/70",
      badge: "bg-amber-50 text-amber-700 border-amber-200/80",
      hoverBorder: "hover:border-amber-400 hover:shadow-amber-500/10",
      btnText: "text-amber-600 group-hover:text-amber-700",
      activeRing: "ring-2 ring-amber-500 border-amber-500 shadow-amber-500/10",
      pingColor: "bg-amber-500",
      gradient: "from-amber-600 to-yellow-500",
      bgGlow: "bg-amber-500/5",
    };
  }

  // Default: La 30 (orange)
  return {
    iconBox:
      "bg-orange-50 text-orange-600 border-orange-200/80 group-hover:bg-orange-100/70",
    badge: "bg-orange-50 text-orange-700 border-orange-200/80",
    hoverBorder: "hover:border-orange-400 hover:shadow-orange-500/10",
    btnText: "text-orange-600 group-hover:text-orange-700",
    activeRing: "ring-2 ring-orange-500 border-orange-500 shadow-orange-500/10",
    pingColor: "bg-orange-500",
    gradient: "from-orange-600 to-amber-500",
    bgGlow: "bg-orange-500/5",
  };
}

function getCompanyIcon(company: Company) {
  const slug = company.slug?.toLowerCase() || "";

  if (slug === "mira-ve" || slug.includes("mira")) {
    return <Crown className="size-8 sm:size-10" />;
  }

  if (slug === "la30" || slug.includes("la30")) {
    return <Logo className="size-8 sm:size-10" />;
  }

  if (company.icon) {
    return (
      <span className="text-3xl sm:text-4xl leading-none">{company.icon}</span>
    );
  }
  return <Building2 className="size-8 sm:size-10" />;
}

export default function CompanySelector() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, loading } = useAuth();
  const {
    companies,
    activeCompany,
    setActiveCompany,
    loading: companyLoading,
  } = useCompany();

  if (loading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center animate-pulse">
            <Building2 className="size-6 text-teal-600" />
          </div>
          <div className="w-8 h-8 border-3 border-teal-500/20 border-t-teal-600 rounded-full animate-spin" />
          <span className="text-teal-700 font-bold uppercase tracking-widest text-xs">
            Cargando empresas...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If only 1 company, auto-resolve (shouldn't reach this page)
  if (companies.length <= 1) {
    return <Navigate to="/select-store" replace />;
  }

  const handleSelect = (company: Company) => {
    setActiveCompany(company);
    navigate("/select-store", { replace: true });
  };

  return (
    <div
      className="relative min-h-screen min-h-[100dvh] w-full max-w-full bg-slate-50/70 text-slate-900 flex flex-col justify-between px-4 sm:p-6 lg:p-8 overflow-x-hidden overflow-y-auto select-none"
      style={{
        paddingTop:
          "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))",
        paddingBottom:
          "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))",
      }}
    >
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] max-w-full h-[250px] bg-orange-500/5 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[400px] max-w-full h-[250px] bg-amber-500/5 blur-[100px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] max-w-full h-[200px] bg-teal-500/3 blur-[90px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between max-w-4xl w-full mx-auto shrink-0 py-1">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 sm:size-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-600 text-white shadow-md shadow-slate-600/15 p-1.5">
            <Building2 className="size-5 sm:size-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-base sm:text-lg font-black tracking-tight text-slate-900">
                POS Multi-Empresa
              </span>
              <span className="rounded-md bg-teal-500/15 border border-teal-500/20 px-1.5 py-0.2 text-[9px] font-black text-teal-700 uppercase">
                SaaS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Selecciona la empresa a administrar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-700 bg-white border border-slate-200/80 px-3 py-1 rounded-full shadow-2xs">
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800">
              {user?.name || user?.email}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-extrabold">
              ({user?.role})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer h-8 px-2.5"
          >
            <LogOut className="size-3.5 mr-1" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      {/* Main: Company Cards */}
      <main className="relative z-10 max-w-4xl w-full mx-auto my-auto py-4 sm:py-8 space-y-6 sm:space-y-8 shrink-0">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
            ¿Qué empresa deseas gestionar?
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-0.5 w-8 bg-teal-500/40 rounded-full" />
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">
              SELECCIONA UNA EMPRESA PARA CONTINUAR
            </p>
            <div className="h-0.5 w-8 bg-teal-500/40 rounded-full" />
          </div>
        </div>

        {/* Company Cards Grid */}
        <div
          className={cn(
            "grid gap-5 sm:gap-6 mx-auto w-full",
            companies.length === 2
              ? "grid-cols-1 sm:grid-cols-2 max-w-3xl"
              : companies.length === 3
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl"
                : "grid-cols-1 max-w-md",
          )}
        >
          {companies.map((company) => {
            const isSelected = company.id === activeCompany?.id;
            const theme = getCompanyTheme(company);
            return (
              <button
                key={company.id}
                type="button"
                onClick={() => handleSelect(company)}
                className={cn(
                  "group relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl border transition-all duration-300 text-center cursor-pointer",
                  "bg-white hover:bg-slate-50/50",
                  "border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1",
                  theme.hoverBorder,
                  isSelected && theme.activeRing,
                )}
              >
                {/* Active Badge */}
                <div className="absolute top-3.5 right-3.5">
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border shadow-2xs uppercase tracking-wider",
                      theme.badge,
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full animate-pulse",
                        theme.pingColor,
                      )}
                    />
                    EMPRESA
                  </span>
                </div>

                {/* Company Icon */}
                <div
                  className={cn(
                    "flex size-16 sm:size-20 items-center justify-center rounded-2xl border transition-all duration-300 shadow-2xs mb-4 group-hover:scale-105",
                    theme.iconBox,
                  )}
                >
                  {getCompanyIcon(company)}
                </div>

                {/* Company Name */}
                <h3 className="font-display text-xl sm:text-2xl font-black text-slate-900 group-hover:text-slate-950 transition-colors tracking-tight">
                  {company.name}
                </h3>

                {/* Subtitle */}
                <p className="text-xs text-slate-400 font-medium mt-1">
                  {company.slug === "mira-ve"
                    ? "Pa' que comás · Hamburguesas"
                    : "Perros y Hamburguesas"}
                </p>

                {/* Enter Button */}
                <div
                  className={cn(
                    "mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                    theme.btnText,
                  )}
                >
                  <span>INGRESAR</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[11px] text-slate-400 max-w-4xl w-full mx-auto py-1 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-1 shrink-0">
        <span>POS Multi-Empresa · Aislamiento total de datos</span>
        <span>v{pkg.version}</span>
      </footer>
    </div>
  );
}

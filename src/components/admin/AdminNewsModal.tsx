import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Cpu,
  Calendar,
  History,
  Check,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  APP_UPDATES,
  type AppUpdate,
  type UpdateCategory,
} from "@/data/appUpdates";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AdminNewsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAsRead?: () => void;
  selectedUpdateId?: string | null;
}

const CATEGORY_CONFIG: Record<
  UpdateCategory,
  { label: string; icon: React.ElementType; color: string; badgeBg: string }
> = {
  feature: {
    label: "Nueva Función",
    icon: Sparkles,
    color: "text-amber-600",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
  },
  improvement: {
    label: "Mejora",
    icon: Zap,
    color: "text-blue-600",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  fix: {
    label: "Corrección",
    icon: CheckCircle2,
    color: "text-emerald-600",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  system: {
    label: "Sistema",
    icon: Cpu,
    color: "text-purple-600",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

const THEME_STYLES: Record<
  AppUpdate["gradientTheme"],
  { headerBg: string; accentBadge: string; glowColor: string }
> = {
  sunset: {
    headerBg: "from-slate-950 via-zinc-900 to-amber-950/60",
    accentBadge: "bg-amber-500/15 border-amber-400/30 text-amber-300",
    glowColor: "rgba(245, 158, 11, 0.18)",
  },
  ocean: {
    headerBg: "from-slate-950 via-slate-900 to-blue-950/60",
    accentBadge: "bg-blue-500/15 border-blue-400/30 text-blue-300",
    glowColor: "rgba(59, 130, 246, 0.18)",
  },
  emerald: {
    headerBg: "from-slate-950 via-zinc-900 to-emerald-950/60",
    accentBadge: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300",
    glowColor: "rgba(16, 185, 129, 0.18)",
  },
  purple: {
    headerBg: "from-slate-950 via-zinc-900 to-purple-950/60",
    accentBadge: "bg-purple-500/15 border-purple-400/30 text-purple-300",
    glowColor: "rgba(168, 85, 247, 0.18)",
  },
  midnight: {
    headerBg: "from-slate-950 via-zinc-900 to-slate-900",
    accentBadge: "bg-sky-500/15 border-sky-400/30 text-sky-300",
    glowColor: "rgba(56, 189, 248, 0.18)",
  },
};

export function AdminNewsModal({
  open,
  onOpenChange,
  onMarkAsRead,
  selectedUpdateId,
}: AdminNewsModalProps) {
  const [activeTab, setActiveTab] = useState<"latest" | "history">("latest");
  const [activeVersionId, setActiveVersionId] = useState<string>(
    selectedUpdateId || APP_UPDATES[0]?.id || "",
  );

  const activeUpdate =
    APP_UPDATES.find((u) => u.id === activeVersionId) || APP_UPDATES[0];

  const handleSelectHistoryItem = (id: string) => {
    setActiveVersionId(id);
    setActiveTab("latest");
  };

  const handleConfirmRead = () => {
    if (onMarkAsRead) onMarkAsRead();
    onOpenChange(false);
  };

  if (!activeUpdate) return null;

  const currentTheme = THEME_STYLES[activeUpdate.gradientTheme] || THEME_STYLES.sunset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-0 shadow-2xl rounded-3xl bg-white max-h-[90vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>{activeUpdate.title}</DialogTitle>
          <DialogDescription>
            {activeUpdate.subtitle || activeUpdate.summary}
          </DialogDescription>
        </DialogHeader>

        {/* Hero Header: Elegante, Moderno y Sobrio */}
        <div
          className={cn(
            "relative p-6 sm:p-7 bg-gradient-to-br text-white shrink-0 overflow-hidden select-none border-b border-white/10",
            currentTheme.headerBg,
          )}
        >
          {/* Subtle Glows and Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none"
            style={{ backgroundColor: currentTheme.glowColor }}
          />
          <div className="absolute -left-20 -bottom-20 w-60 h-60 rounded-full bg-black/40 blur-2xl pointer-events-none" />

          {/* Gran Marca de Agua de Versión Mayor */}
          {activeUpdate.isMajor && (
            <div className="absolute right-4 -bottom-6 text-white/[0.04] font-black text-8xl sm:text-9xl tracking-tighter select-none pointer-events-none font-display">
              {activeUpdate.version.replace(/[^0-9.]/g, "")}
            </div>
          )}

          {/* Navigation Bar (Top) */}
          <div className="relative z-10 flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("latest")}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer",
                  activeTab === "latest"
                    ? "bg-white text-slate-900 shadow-xs font-black"
                    : "text-white/70 hover:text-white hover:bg-white/10",
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {activeVersionId === APP_UPDATES[0]?.id
                  ? "Última Versión"
                  : `Versión ${activeUpdate.version}`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer",
                  activeTab === "history"
                    ? "bg-white text-slate-900 shadow-xs font-black"
                    : "text-white/70 hover:text-white hover:bg-white/10",
                )}
              >
                <History className="w-3.5 h-3.5" />
                Historial ({APP_UPDATES.length})
              </button>
            </div>

            <Badge className="bg-white/10 hover:bg-white/15 text-white/90 font-bold backdrop-blur-md border border-white/15 px-3 py-1 rounded-xl text-xs flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white/70" />
              {activeUpdate.date}
            </Badge>
          </div>

          {/* Title & Subtitle */}
          <div className="relative z-10 space-y-2 mt-1">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border backdrop-blur-md text-xs font-black uppercase tracking-wider shadow-xs",
                  currentTheme.accentBadge,
                )}
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>
                  {activeUpdate.isMajor
                    ? `LANZAMIENTO MAYOR ${activeUpdate.version}`
                    : activeUpdate.badgeText || activeUpdate.version}
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white font-display">
              {activeUpdate.title}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
              {activeUpdate.subtitle}
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-5 bg-slate-50/40">
          <AnimatePresence mode="wait">
            {activeTab === "latest" ? (
              <motion.div
                key="latest-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Summary Banner */}
                {activeUpdate.summary && (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-600 shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Resumen del Hito
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                        {activeUpdate.summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Change Items Grid: 2 Columnas Elegantes */}
                <div className="space-y-3 pt-1">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Novedades y Cambios Principales
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeUpdate.items.map((item, idx) => {
                      const catConfig =
                        CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.feature;
                      const CatIcon = catConfig.icon;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-2.5 group",
                            item.highlight
                              ? "bg-white border-amber-200/80 shadow-xs hover:shadow-md hover:border-amber-300"
                              : "bg-white border-slate-200/80 shadow-2xs hover:shadow-md hover:border-slate-300",
                          )}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div
                                className={cn(
                                  "p-2 rounded-xl shrink-0 transition-transform group-hover:scale-105",
                                  item.highlight
                                    ? "bg-amber-50 text-amber-600 border border-amber-200/60"
                                    : "bg-slate-100 text-slate-600 border border-slate-200/60",
                                )}
                              >
                                <CatIcon className="w-4 h-4" />
                              </div>

                              <span
                                className={cn(
                                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0",
                                  catConfig.badgeBg,
                                )}
                              >
                                {catConfig.label}
                              </span>
                            </div>

                            <h4 className="font-extrabold text-sm text-slate-900 tracking-tight group-hover:text-amber-600 transition-colors">
                              {item.title}
                            </h4>

                            <p className="text-xs text-slate-600 font-medium leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="history-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Historial de Publicaciones y Versiones
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">
                    Haz clic en una versión para ver sus detalles
                  </span>
                </div>

                <div className="space-y-2.5">
                  {APP_UPDATES.map((update) => {
                    const isCurrent = update.id === activeVersionId;
                    return (
                      <button
                        key={update.id}
                        type="button"
                        onClick={() => handleSelectHistoryItem(update.id)}
                        className={cn(
                          "w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-4 group cursor-pointer",
                          isCurrent
                            ? "bg-amber-50/50 border-amber-300 shadow-xs"
                            : "bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs hover:shadow-xs",
                        )}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900">
                              {update.version}
                            </span>
                            <span className="text-xs text-slate-400">
                              • {update.date}
                            </span>
                            {update.isMajor && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] font-bold px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-200"
                              >
                                Mayor
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-extrabold text-sm sm:text-base text-slate-800 truncate group-hover:text-amber-600 transition-colors">
                            {update.title}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium truncate">
                            {update.subtitle}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400 group-hover:text-amber-600 transition-colors flex items-center gap-1">
                            Ver póster
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-semibold hidden sm:flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span>Publicado por:</span>
            <span className="font-black text-slate-900">
              {activeUpdate.author || "Equipo de Desarrollo La 30"}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold h-10 px-4 hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer"
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmRead}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black gap-2 shadow-sm px-5 h-10 cursor-pointer transition-all active:scale-95"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              ¡Entendido, Explorar!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

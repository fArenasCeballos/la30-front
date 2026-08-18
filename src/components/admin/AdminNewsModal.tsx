import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Flame,
  ArrowRight,
} from "lucide-react";
import {
  APP_UPDATES,
  type AppUpdate,
  type UpdateCategory,
} from "@/data/appUpdates";
import { motion, AnimatePresence } from "framer-motion";

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
    color: "text-amber-500",
    badgeBg: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  improvement: {
    label: "Mejora",
    icon: Zap,
    color: "text-blue-500",
    badgeBg: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  fix: {
    label: "Corrección",
    icon: CheckCircle2,
    color: "text-emerald-500",
    badgeBg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  system: {
    label: "Sistema",
    icon: Cpu,
    color: "text-purple-500",
    badgeBg: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
};

const THEME_STYLES: Record<
  AppUpdate["gradientTheme"],
  { headerBg: string; accentColor: string; glow: string }
> = {
  sunset: {
    headerBg: "from-orange-600 via-amber-600 to-rose-600",
    accentColor: "#f97316",
    glow: "rgba(249, 115, 22, 0.25)",
  },
  ocean: {
    headerBg: "from-blue-600 via-indigo-600 to-cyan-600",
    accentColor: "#2563eb",
    glow: "rgba(37, 99, 235, 0.25)",
  },
  emerald: {
    headerBg: "from-emerald-600 via-teal-600 to-emerald-700",
    accentColor: "#059669",
    glow: "rgba(5, 150, 105, 0.25)",
  },
  purple: {
    headerBg: "from-purple-600 via-violet-600 to-pink-600",
    accentColor: "#9333ea",
    glow: "rgba(147, 51, 234, 0.25)",
  },
  midnight: {
    headerBg: "from-slate-900 via-zinc-800 to-slate-900",
    accentColor: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.25)",
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
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-0 shadow-2xl rounded-3xl bg-background max-h-[90vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>{activeUpdate.title}</DialogTitle>
        </DialogHeader>

        {/* Poster Header */}
        <div
          className={`relative p-6 sm:p-8 bg-gradient-to-br ${currentTheme.headerBg} text-white shrink-0 overflow-hidden select-none`}
        >
          {/* Subtle Background Glows & Pattern */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-black/15 blur-xl pointer-events-none" />

          {/* Navigation Tabs (Top) */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 bg-black/25 backdrop-blur-md p-1 rounded-2xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("latest")}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === "latest"
                    ? "bg-white text-slate-900 shadow-md font-extrabold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {activeVersionId === APP_UPDATES[0]?.id
                  ? "Última Versión"
                  : `Versión ${activeUpdate.version}`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === "history"
                    ? "bg-white text-slate-900 shadow-md font-extrabold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Historial ({APP_UPDATES.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 hover:bg-white/25 text-white font-extrabold backdrop-blur-md border border-white/20 px-3 py-1 rounded-xl text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {activeUpdate.date}
              </Badge>
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="relative z-10 space-y-2 mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-black tracking-wide border border-white/20 shadow-inner uppercase flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-300" />
                {activeUpdate.version}
              </span>
              <span className="px-3 py-1 rounded-full bg-black/25 backdrop-blur-md text-white text-xs font-bold border border-white/10">
                {activeUpdate.badgeText}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight drop-shadow-sm">
              {activeUpdate.title}
            </h1>
            <p className="text-white/90 text-sm sm:text-base font-medium max-w-xl line-clamp-2">
              {activeUpdate.subtitle}
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === "latest" ? (
              <motion.div
                key="latest-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Summary Banner */}
                {activeUpdate.summary && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-accent/40 border border-border/80 flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                        Resumen de la Actualización
                      </h4>
                      <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                        {activeUpdate.summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Change Items Grid / List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Detalle de Novedades y Cambios
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    {activeUpdate.items.map((item, idx) => {
                      const catConfig =
                        CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.feature;
                      const CatIcon = catConfig.icon;

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border transition-all duration-200 hover:shadow-sm flex items-start gap-3.5 ${
                            item.highlight
                              ? "bg-gradient-to-r from-primary/[0.04] to-accent/20 border-primary/20"
                              : "bg-card border-border/70"
                          }`}
                        >
                          <div
                            className={`p-2.5 rounded-xl shrink-0 ${
                              item.highlight
                                ? "bg-primary text-white shadow-sm"
                                : "bg-accent text-muted-foreground"
                            }`}
                          >
                            <CatIcon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-extrabold text-sm sm:text-base text-foreground">
                                {item.title}
                              </h4>
                              <span
                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${catConfig.badgeBg}`}
                              >
                                {catConfig.label}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
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
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Historial de Publicaciones y Versiones
                  </h3>
                  <span className="text-xs text-muted-foreground font-medium">
                    Haz clic en una versión para ver sus detalles
                  </span>
                </div>

                <div className="space-y-3">
                  {APP_UPDATES.map((update) => {
                    const isCurrent = update.id === activeVersionId;
                    return (
                      <button
                        key={update.id}
                        type="button"
                        onClick={() => handleSelectHistoryItem(update.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-4 group ${
                          isCurrent
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "bg-card hover:bg-accent/40 border-border/70"
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-primary">
                              {update.version}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              • {update.date}
                            </span>
                            {update.isMajor && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-bold px-1.5 py-0"
                              >
                                Mayor
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-extrabold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                            {update.title}
                          </h4>
                          <p className="text-xs text-muted-foreground font-medium truncate">
                            {update.subtitle}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                            Ver poster
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
        <div className="p-4 sm:p-5 border-t bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted-foreground font-semibold hidden sm:flex items-center gap-1.5">
            <span>Publicado por:</span>
            <span className="font-black text-foreground">
              {activeUpdate.author || "La 30 Tech Team"}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold"
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmRead}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl font-extrabold gap-1.5 shadow-md shadow-primary/20 px-4"
            >
              <Check className="w-4 h-4" />
              ¡Entendido!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

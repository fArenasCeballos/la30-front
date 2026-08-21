import { useState } from "react";
import { Sparkles, ArrowRight, X, ChevronDown, ChevronUp, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_UPDATES, type AppUpdate } from "@/data/appUpdates";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AdminNewsBannerProps {
  onOpenFullModal: (updateId?: string) => void;
  update?: AppUpdate;
  isUnread?: boolean;
  onInteract?: () => void;
}

const BANNER_THEMES: Record<
  AppUpdate["gradientTheme"],
  {
    containerBg: string;
    border: string;
    iconBg: string;
    badgeBg: string;
    buttonBg: string;
    glow1: string;
    glow2: string;
    unreadText: string;
    unreadBg: string;
    highlightBorder: string;
    glowShadow: string;
    glowBorder: string;
  }
> = {
  purple: {
    containerBg: "from-purple-500/15 via-indigo-500/10 to-violet-500/15",
    border: "border-purple-500/30",
    iconBg: "from-purple-600 to-indigo-600 shadow-purple-500/30",
    badgeBg: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20",
    buttonBg: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/25",
    glow1: "bg-purple-500/15",
    glow2: "bg-indigo-500/15",
    unreadText: "text-purple-700",
    unreadBg: "bg-purple-500/15 border border-purple-500/20",
    highlightBorder: "border-purple-500/15",
    glowShadow: "rgba(147, 51, 234, 0.45)",
    glowBorder: "rgba(147, 51, 234, 0.8)",
  },
  sunset: {
    containerBg: "from-orange-500/10 via-amber-500/10 to-rose-500/10",
    border: "border-orange-500/25",
    iconBg: "from-primary to-amber-500 shadow-primary/25",
    badgeBg: "bg-primary hover:bg-primary/90 text-white shadow-primary/20",
    buttonBg: "bg-primary hover:bg-primary/90 text-white shadow-primary/20",
    glow1: "bg-primary/10",
    glow2: "bg-amber-500/10",
    unreadText: "text-amber-600",
    unreadBg: "bg-amber-500/15",
    highlightBorder: "border-primary/10",
    glowShadow: "rgba(249, 115, 22, 0.45)",
    glowBorder: "rgba(249, 115, 22, 0.8)",
  },
  ocean: {
    containerBg: "from-blue-500/15 via-indigo-500/10 to-cyan-500/15",
    border: "border-blue-500/30",
    iconBg: "from-blue-600 to-indigo-600 shadow-blue-500/30",
    badgeBg: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20",
    buttonBg: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25",
    glow1: "bg-blue-500/15",
    glow2: "bg-cyan-500/15",
    unreadText: "text-blue-700",
    unreadBg: "bg-blue-500/15 border border-blue-500/20",
    highlightBorder: "border-blue-500/15",
    glowShadow: "rgba(37, 99, 235, 0.45)",
    glowBorder: "rgba(37, 99, 235, 0.8)",
  },
  emerald: {
    containerBg: "from-emerald-500/15 via-teal-500/10 to-green-500/15",
    border: "border-emerald-500/30",
    iconBg: "from-emerald-600 to-teal-600 shadow-emerald-500/30",
    badgeBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25",
    glow1: "bg-emerald-500/15",
    glow2: "bg-teal-500/15",
    unreadText: "text-emerald-700",
    unreadBg: "bg-emerald-500/15 border border-emerald-500/20",
    highlightBorder: "border-emerald-500/15",
    glowShadow: "rgba(5, 150, 105, 0.45)",
    glowBorder: "rgba(5, 150, 105, 0.8)",
  },
  midnight: {
    containerBg: "from-slate-800/15 via-zinc-800/10 to-slate-900/15",
    border: "border-slate-700/30",
    iconBg: "from-slate-800 to-zinc-900 shadow-slate-900/30",
    badgeBg: "bg-slate-800 hover:bg-slate-900 text-white shadow-slate-800/20",
    buttonBg: "bg-slate-800 hover:bg-slate-900 text-white shadow-slate-800/25",
    glow1: "bg-slate-500/15",
    glow2: "bg-zinc-500/15",
    unreadText: "text-slate-800",
    unreadBg: "bg-slate-500/15 border border-slate-500/20",
    highlightBorder: "border-slate-700/15",
    glowShadow: "rgba(100, 116, 139, 0.45)",
    glowBorder: "rgba(100, 116, 139, 0.8)",
  },
};

export function AdminNewsBanner({
  onOpenFullModal,
  update = APP_UPDATES[0],
  isUnread = false,
  onInteract,
}: AdminNewsBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBlinking, setIsBlinking] = useState(() => {
    try {
      const interacted = localStorage.getItem(
        `la30_banner_interacted_${update?.id}`,
      );
      return isUnread && interacted !== "true";
    } catch {
      return isUnread;
    }
  });

  const stopBlinking = () => {
    if (isBlinking) {
      setIsBlinking(false);
      try {
        localStorage.setItem(`la30_banner_interacted_${update.id}`, "true");
      } catch {
        // ignore
      }
      onInteract?.();
    }
  };

  if (isDismissed || !update) return null;

  const theme = BANNER_THEMES[update.gradientTheme] || BANNER_THEMES.purple;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={
        isBlinking
          ? {
              opacity: 1,
              y: 0,
              boxShadow: [
                "0 0 0 0 rgba(0,0,0,0)",
                `0 0 28px 5px ${theme.glowShadow}`,
                "0 0 0 0 rgba(0,0,0,0)",
              ],
              borderColor: [
                "rgba(147, 51, 234, 0.2)",
                theme.glowBorder,
                "rgba(147, 51, 234, 0.2)",
              ],
              scale: [1, 1.008, 1],
            }
          : {
              opacity: 1,
              y: 0,
              scale: 1,
              boxShadow:
                "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
            }
      }
      transition={
        isBlinking
          ? {
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }
          : { duration: 0.3 }
      }
      exit={{ opacity: 0, height: 0 }}
      onClick={stopBlinking}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-gradient-to-r backdrop-blur-sm p-4 sm:p-5 shadow-sm transition-all",
        theme.border,
        theme.containerBg,
      )}
    >
      {/* Decorative ambient gradients */}
      <div
        className={cn(
          "absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none",
          theme.glow1,
        )}
      />
      <div
        className={cn(
          "absolute -left-12 -bottom-12 w-40 h-40 rounded-full blur-2xl pointer-events-none",
          theme.glow2,
        )}
      />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left info */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={cn(
              "w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shrink-0 shadow-md",
              theme.iconBg,
            )}
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "font-black text-[10px] tracking-wide uppercase px-2.5 py-0.5 rounded-lg border-0 shadow-xs",
                  theme.badgeBg,
                )}
              >
                {update.version}
              </Badge>
              {isUnread && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg animate-pulse",
                    theme.unreadText,
                    theme.unreadBg,
                  )}
                >
                  <BellRing className="w-3 h-3" />
                  Nueva Actualización
                </span>
              )}
              <span className="text-xs font-semibold text-muted-foreground">
                • {update.date}
              </span>
            </div>

            <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
              {update.title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium line-clamp-1 sm:line-clamp-2">
              {update.subtitle}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              stopBlinking();
              setIsExpanded(!isExpanded);
            }}
            className="text-xs font-bold text-muted-foreground hover:text-foreground rounded-xl h-8 px-2 sm:px-3"
          >
            {isExpanded ? (
              <>
                Menos
                <ChevronUp className="w-3.5 h-3.5 ml-1" />
              </>
            ) : (
              <>
                Resumen
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              stopBlinking();
              onOpenFullModal(update.id);
            }}
            className={cn(
              "font-extrabold text-xs rounded-xl h-8 px-3.5 gap-1.5 shadow-sm",
              theme.buttonBg,
            )}
          >
            Ver Poster Completo
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              stopBlinking();
              setIsDismissed(true);
            }}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5"
            title="Ocultar aviso"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Quick Highlights */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative z-10 pt-4 mt-3 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2",
              theme.highlightBorder,
            )}
          >
            {update.items.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className={cn(
                  "bg-white/60 dark:bg-card/60 backdrop-blur-xs p-2.5 rounded-xl border space-y-0.5",
                  theme.highlightBorder,
                )}
              >
                <p className="text-xs font-bold text-foreground truncate">
                  {item.title}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                  {item.description}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

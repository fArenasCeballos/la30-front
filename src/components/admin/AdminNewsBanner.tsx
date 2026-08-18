import { useState } from "react";
import { Sparkles, ArrowRight, X, ChevronDown, ChevronUp, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_UPDATES, type AppUpdate } from "@/data/appUpdates";
import { motion, AnimatePresence } from "framer-motion";

interface AdminNewsBannerProps {
  onOpenFullModal: (updateId?: string) => void;
  update?: AppUpdate;
  isUnread?: boolean;
}

export function AdminNewsBanner({
  onOpenFullModal,
  update = APP_UPDATES[0],
  isUnread = false,
}: AdminNewsBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (isDismissed || !update) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-rose-500/10 backdrop-blur-sm p-4 sm:p-5 shadow-sm"
    >
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left info */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary/25">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary hover:bg-primary/90 text-white font-black text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-lg border-0 shadow-xs">
                {update.version}
              </Badge>
              {isUnread && (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 bg-amber-500/15 px-2 py-0.5 rounded-lg animate-pulse">
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
            onClick={() => setIsExpanded(!isExpanded)}
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
            onClick={() => onOpenFullModal(update.id)}
            className="bg-primary hover:bg-primary/90 text-white font-extrabold text-xs rounded-xl h-8 px-3.5 shadow-sm shadow-primary/20 gap-1.5"
          >
            Ver Poster Completo
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDismissed(true)}
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
            className="relative z-10 pt-4 mt-3 border-t border-primary/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
          >
            {update.items.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="bg-white/60 dark:bg-card/60 backdrop-blur-xs p-2.5 rounded-xl border border-primary/10 space-y-0.5"
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

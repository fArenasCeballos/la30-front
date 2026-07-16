import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Calculator,
  FileText,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ReportLoadingModalProps {
  isLoading: boolean;
}

const STEPS = [
  { icon: Database, text: "Consultando datos del rango seleccionado..." },
  { icon: FileText, text: "Estructurando la información..." },
  { icon: Calculator, text: "Realizando cálculos..." },
];

export function ReportLoadingModal({ isLoading }: ReportLoadingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const [prevIsLoading, setPrevIsLoading] = useState(isLoading);

  if (isLoading && !prevIsLoading) {
    setPrevIsLoading(true);
    setIsOpen(true);
    setIsFinished(false);
    setCurrentStep(0);
  } else if (!isLoading && prevIsLoading) {
    setPrevIsLoading(false);
    if (isOpen) {
      setIsFinished(true);
      setCurrentStep(STEPS.length);
    }
  }

  useEffect(() => {
    if (isLoading) {
      // Simulate steps progressing while loading
      const interval = setInterval(() => {
        setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
      }, 1200);

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Only allow closing if finished
        if (!open && isFinished) setIsOpen(false);
      }}
    >
      <DialogContent className="sm:max-w-md border-none shadow-2xl bg-white/95 backdrop-blur-xl rounded-3xl overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Cargando reporte</DialogTitle>
        <DialogDescription className="sr-only">
          El sistema está consultando y procesando los datos del rango de fechas seleccionado.
        </DialogDescription>
        <div className="p-8 flex flex-col items-center justify-center min-h-[340px] text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent pointer-events-none" />

          <AnimatePresence mode="wait">
            {!isFinished ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center w-full relative z-10"
              >
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                  <div className="bg-white p-4 rounded-full shadow-lg relative">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                </div>

                <h3 className="text-xl font-black text-foreground mb-6">
                  Generando Reporte
                </h3>

                <div className="w-full space-y-3">
                  {STEPS.map((step, index) => {
                    const isActive = index === currentStep;
                    const isDone = index < currentStep;
                    const Icon = step.icon;
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{
                          opacity: isActive || isDone ? 1 : 0.4,
                          x: 0,
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl transition-all duration-500",
                          isActive
                            ? "bg-primary/10 text-primary scale-105"
                            : "text-muted-foreground",
                        )}
                      >
                        <div
                          className={cn(
                            "p-2 rounded-xl shrink-0 transition-colors duration-500",
                            isActive
                              ? "bg-primary text-white"
                              : isDone
                                ? "bg-green-500 text-white"
                                : "bg-accent/50",
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Icon
                              className={cn(
                                "w-4 h-4",
                                isActive && "animate-pulse",
                              )}
                            />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[13px] font-bold text-left",
                            isDone && "text-foreground",
                          )}
                        >
                          {step.text}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center relative z-10"
              >
                <div className="mb-6 relative">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                  <div className="bg-white p-5 rounded-full shadow-xl relative">
                    <CheckCircle2
                      className="w-14 h-14 text-green-500"
                      strokeWidth={3}
                    />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-foreground mb-2">
                  ¡Terminado!
                </h3>
                <p className="text-[13px] font-medium text-muted-foreground mb-8 text-balance px-4">
                  Los datos han sido procesados y están listos para
                  visualizarse.
                </p>
                <Button
                  onClick={handleClose}
                  className="w-full sm:w-auto px-10 rounded-2xl h-12 font-black tracking-widest text-[11px] uppercase bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 transition-transform hover:scale-105"
                >
                  Ver Reporte
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

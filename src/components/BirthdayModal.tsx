import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PartyPopper, Heart, Sparkles } from "lucide-react";

export function BirthdayModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user's email matches the specific one
    if (user?.email === "carmonamadridsara@gmail.com") {
      const hasShown = sessionStorage.getItem("birthday_modal_shown");
      if (!hasShown) {
        // Delay slightly for effect
        const timer = setTimeout(() => {
          setIsOpen(true);
          sessionStorage.setItem("birthday_modal_shown", "true");
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden border-none p-0 bg-transparent shadow-2xl">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-pink-500 via-purple-500 to-indigo-600 p-8 text-white shadow-2xl border-4 border-white/20">
          {/* Background elements */}
          <div className="absolute top-4 right-4 animate-pulse opacity-50">
            <Sparkles className="h-12 w-12 text-yellow-200" />
          </div>
          <div className="absolute bottom-4 left-4 animate-bounce opacity-30">
            <Heart className="h-10 w-10 text-red-200 fill-red-200" />
          </div>
          <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl" />

          <DialogHeader className="relative z-10 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-inner border border-white/30 animate-in zoom-in duration-500">
              <PartyPopper className="h-12 w-12 text-yellow-300 drop-shadow-glow" />
            </div>
            <DialogTitle className="text-4xl font-bold text-center text-white drop-shadow-lg mb-2 tracking-tight">
              ¡Feliz Cumpleaños! 🎂
            </DialogTitle>
            <DialogDescription className="text-white/90 text-xl font-medium text-center leading-relaxed">
              Hola, mi vida. ❤️
            </DialogDescription>
          </DialogHeader>

          <div className="relative z-10 mt-6 space-y-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <p className="text-2xl font-bold leading-tight drop-shadow-md">
              Te amo mucho, este es tu aplicativo y lo hice para ti con mucho amor
            </p>
            <p className="text-lg text-white/80 font-medium">✨ Que hoy sea un día tan especial como tú ✨</p>
            <div className="flex justify-center gap-4 py-3">
              <span className="text-3xl animate-bounce duration-700" style={{ animationDelay: '0ms' }}>💖</span>
              <span className="text-3xl animate-bounce duration-700" style={{ animationDelay: '200ms' }}>🥳</span>
              <span className="text-3xl animate-bounce duration-700" style={{ animationDelay: '400ms' }}>🌸</span>
              <span className="text-3xl animate-bounce duration-700" style={{ animationDelay: '600ms' }}>🎀</span>
            </div>
          </div>

          <div className="mt-8 flex justify-center animate-in fade-in zoom-in duration-500 delay-500">
            <button
              onClick={() => setIsOpen(false)}
              className="group relative overflow-hidden rounded-full bg-white px-8 py-3 text-lg font-black text-purple-600 shadow-xl transition-all hover:scale-110 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                ¡Gracias, amor! 😍
                <Heart className="h-5 w-5 fill-purple-600 transition-transform group-hover:scale-125" />
              </span>
              <div className="absolute inset-0 bg-white group-hover:bg-pink-50 transition-colors" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

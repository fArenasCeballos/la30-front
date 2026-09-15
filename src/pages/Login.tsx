import pkg from "../../package.json";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";
import { Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { success, error } = await login(email, password);
      if (success) {
        localStorage.removeItem("la30_active_store");
        navigate("/");
      } else {
        toast.error(error || "Credenciales inválidas");
      }
    } catch (err) {
      toast.error("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] w-full max-w-full bg-slate-50/70 text-slate-900 flex flex-col justify-between px-4 py-2 sm:px-6 sm:py-4 overflow-hidden select-none pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* Destellos sutiles de fondo contenidos para evitar desbordamiento horizontal */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[450px] max-w-full h-[240px] bg-orange-500/5 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[300px] max-w-full h-[200px] bg-teal-500/5 blur-[90px] rounded-full" />
      </div>

      {/* Cabecera Superior Compacta */}
      <header className="relative z-10 flex items-center justify-between max-w-md w-full mx-auto shrink-0 py-0.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-xs shadow-orange-500/20 p-1">
            <Logo className="size-4 sm:size-5" />
          </div>
          <span className="font-display text-xs sm:text-sm font-black tracking-tight text-slate-800">
            La 30 POS
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-500 bg-white border border-slate-200/80 px-2 sm:px-2.5 py-0.5 rounded-full shadow-2xs">
          <ShieldCheck className="size-3 sm:size-3.5 text-emerald-600" />
          <span>Acceso Seguro</span>
        </div>
      </header>

      {/* Área Central: Tarjeta de Acceso */}
      <main className="relative z-10 max-w-md w-full mx-auto my-auto py-1 sm:py-3 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-200/60 relative overflow-hidden">
          {/* Logo y Encabezado del Formulario */}
          <div className="text-center space-y-1 mb-3.5 sm:mb-5">
            <div className="relative inline-flex mb-0.5 sm:mb-1">
              <div className="flex items-center justify-center size-11 sm:size-16 rounded-xl sm:rounded-2xl bg-orange-50/70 border border-orange-200/80 shadow-2xs p-1.5 sm:p-2 transition-transform duration-300 hover:scale-105">
                <Logo className="size-7 sm:size-10" />
              </div>
            </div>

            <h1 className="font-display text-lg sm:text-2xl font-black tracking-tight text-slate-900">
              Iniciar Sesión
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
              Ingresa tus credenciales para acceder a la plataforma
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Campo Email */}
            <div className="space-y-1 sm:space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1.5 ml-0.5"
              >
                <Mail className="size-3.5 text-slate-400" />
                <span>Correo Electrónico</span>
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@la30.com"
                  className="h-10 sm:h-11 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border-slate-200/90 text-slate-900 placeholder:text-slate-400 rounded-xl px-3 sm:px-3.5 text-xs sm:text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
                  required
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-1 sm:space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1.5 ml-0.5"
              >
                <Lock className="size-3.5 text-slate-400" />
                <span>Contraseña</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 sm:h-11 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border-slate-200/90 text-slate-900 placeholder:text-slate-400 rounded-xl px-3 sm:px-3.5 pr-10 sm:pr-11 text-xs sm:text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-3.5 sm:size-4" /> : <Eye className="size-3.5 sm:size-4" />}
                </button>
              </div>
            </div>

            {/* Botón de Ingreso */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 sm:h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer mt-1 active:scale-[0.99]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="size-3.5 sm:size-4" />
                </div>
              )}
            </Button>
          </form>
        </div>
      </main>

      {/* Pie de Página */}
      <footer className="relative z-10 text-center text-[10px] sm:text-[11px] text-slate-400 max-w-md w-full mx-auto py-0.5 sm:py-1 border-t border-slate-200/80 flex items-center justify-between gap-1 shrink-0">
        <span>La 30 POS · Todos los derechos reservados</span>
        <span>v{pkg.version}</span>
      </footer>
    </div>
  );
}


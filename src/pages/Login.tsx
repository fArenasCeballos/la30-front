import pkg from "../../package.json";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";
import { Eye, EyeOff } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0A0A0A]">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/10 blur-[120px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.05)_0%,transparent_70%)]" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-3">
          <div className="relative inline-flex mb-4">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
            <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden group hover:scale-105 transition-transform duration-500">
              <Logo className="h-20 w-20 group-hover:rotate-6 transition-transform duration-500" />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="font-display text-5xl font-bold tracking-tight text-white drop-shadow-sm">
              La 30
            </h1>
            <p className="text-primary font-medium uppercase tracking-[0.3em] text-xs">
              Perros y Hamburguesas
            </p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-4xl p-8 shadow-2xl relative group overflow-hidden">
          {/* Subtle light effect on hover */}
          <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-white/70 ml-1 text-sm font-medium"
              >
                Correo electrónico
              </Label>
              <div className="relative group/input">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@la30.com"
                  className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl px-4 focus:ring-primary/50 focus:border-primary transition-all text-lg"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-white/70 ml-1 text-sm font-medium"
              >
                Contraseña
              </Label>
              <div className="relative group/input">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl px-4 pr-12 focus:ring-primary/50 focus:border-primary transition-all text-lg"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-primary transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-lg mt-2 group/btn"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Ingresar
                </span>
              )}
            </Button>
          </form>
        </div>

        <div className="text-center space-y-4">
          <p className="text-white/30 text-xs font-medium uppercase tracking-widest">
            Sistema de Gestión v{pkg.version}
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-8 bg-white/10" />
            <p className="text-white/20 text-[10px] whitespace-nowrap">
              © {new Date().getFullYear()} LA 30 - TODOS LOS DERECHOS RESERVADOS
            </p>
            <div className="h-px w-8 bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

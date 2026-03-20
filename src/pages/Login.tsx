import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      navigate("/");
    } else {
      toast.error("Credenciales inválidas");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-2">
            <Flame className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold">La 30</h1>
          <p className="text-muted-foreground">Perros y Hamburguesas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="caja@la30.com"
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Cualquier contraseña"
              className="h-12"
              required
            />
          </div>
          <Button
            type="submit"
            size="touch"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <div className="pos-card">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Cuentas de prueba:
          </p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Admin:</span>{" "}
              admin@la30.com
            </p>
            <p>
              <span className="font-medium text-foreground">Caja:</span>{" "}
              caja@la30.com
            </p>
            <p>
              <span className="font-medium text-foreground">Mesero:</span>{" "}
              mesero@la30.com
            </p>
            <p>
              <span className="font-medium text-foreground">Cocina:</span>{" "}
              cocina@la30.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

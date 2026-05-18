import { useNavigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import type { Store } from "@/types";

export default function StoreSelector() {
  const navigate = useNavigate();
  const { stores, setActiveStore } = useStore();

  const activeStores = stores.filter((s) => s.is_active);
  const inactiveStores = stores.filter((s) => !s.is_active);

  const handleSelect = (store: Store) => {
    setActiveStore(store);
    const destination = store.slug === "domicilios" ? "/domicilios" : "/";
    navigate(destination, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0A0A0A]">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/5 blur-[120px] animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-4xl relative z-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="font-display text-6xl font-bold tracking-tight text-white">
            La 30
          </h1>
          <p className="text-white/50 text-xl font-medium uppercase tracking-[0.2em]">
            Selecciona el punto de venta
          </p>
          <div className="h-1 w-24 bg-primary mx-auto rounded-full shadow-[0_0_20px_rgba(249,115,22,0.5)]" />
        </div>

        {/* Active stores */}
        <div className="grid gap-8 sm:grid-cols-2">
          {activeStores.map((store, idx) => (
            <button
              key={store.id}
              onClick={() => handleSelect(store)}
              style={{ "--delay": `${idx * 100}ms` } as React.CSSProperties}
              className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-xl p-10 text-left transition-all duration-500 hover:scale-[1.05] hover:border-primary/50 hover:shadow-[0_0_40px_rgba(249,115,22,0.15)] active:scale-[0.98] focus:outline-none animate-in fade-in slide-in-from-bottom-8 fill-mode-both"
            >
              {/* Internal Glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at center, ${store.color || "#F97316"}, transparent 70%)`,
                }}
              />

              <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="text-8xl relative z-10 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500 block">
                    {store.icon}
                  </span>
                </div>

                <div className="text-center space-y-2">
                  <h2 className="font-display text-4xl font-bold text-white tracking-tight">
                    {store.name}
                  </h2>
                  <p className="text-white/40 text-sm font-medium uppercase tracking-widest group-hover:text-primary transition-colors duration-300">
                    Ingresar ahora
                  </p>
                </div>
              </div>

              {/* Decorative Corner */}
              <div
                className="absolute top-0 right-0 w-24 h-24 bg-linear-to-bl from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
              />
            </button>
          ))}
        </div>

        {/* Inactive stores */}
        {inactiveStores.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 opacity-40">
            {inactiveStores.map((store) => (
              <div
                key={store.id}
                className="relative overflow-hidden rounded-4xl border border-dashed border-white/10 bg-white/5 p-8 text-center"
              >
                <div className="flex items-center justify-center gap-6">
                  <span className="text-5xl grayscale">{store.icon}</span>
                  <div className="text-left">
                    <h2 className="font-display text-xl font-bold text-white/50">
                      {store.name}
                    </h2>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      Próximamente
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import type { User, UserRole } from "@/types";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora

export interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  logoutAll: () => Promise<void>;
  forceReset: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const STORAGE_USER_KEY = "la30_cached_user";

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Fetch profile from DB given auth user id
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Profile fetch error:", error);
        // Resiliencia offline: Si la consulta falla por caída de red, conservar perfil en caché
        const isNetworkErr =
          !navigator.onLine ||
          error.message?.includes("Failed to fetch") ||
          error.message?.includes("NetworkError");

        if (isNetworkErr) {
          const raw = localStorage.getItem(STORAGE_USER_KEY);
          if (raw) {
            try {
              const cached = JSON.parse(raw) as User;
              if (cached && cached.id === userId) {
                console.warn("[Auth] Red inaccesible. Conservando perfil offline en caché.");
                setUser(cached);
                return;
              }
            } catch {
              // ignore parse error
            }
          }
        }
        setUser(null);
        return;
      }

      if (!data) {
        setUser(null);
        localStorage.removeItem(STORAGE_USER_KEY);
        return;
      }

      if (data.is_active === false) {
        toast.error("Cuenta inactiva. Comunícate con administración.");
        await supabase.auth.signOut();
        setUser(null);
        localStorage.removeItem(STORAGE_USER_KEY);
        return;
      }

      setUser(data);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data));
    } catch (err: unknown) {
      console.error("Profile fetch exception:", err);
      // Fallback a perfil en caché si ocurrió una excepción de red
      const raw = localStorage.getItem(STORAGE_USER_KEY);
      if (raw) {
        try {
          const cached = JSON.parse(raw) as User;
          if (cached && cached.id === userId) {
            console.warn("[Auth] Excepción de conexión. Conservando perfil offline en caché.");
            setUser(cached);
            return;
          }
        } catch {
          // ignore
        }
      }
      setUser(null);
    }
  }, []);

  const lastFetchedId = useRef<string | null>(null);
  const initialSessionHandled = useRef(false);

  // ─── Auth state listener ─────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Reset refs al montar (necesario para StrictMode que remonta)
    lastFetchedId.current = null;
    initialSessionHandled.current = false;

    const loadProfile = async (userId: string) => {
      if (!mounted) return;
      lastFetchedId.current = userId;
      try {
        // Timeout de seguridad de 5s para no bloquear en conexiones congeladas
        const profileTimeout = new Promise((resolve) =>
          setTimeout(() => resolve({ isTimeout: true }), 5000),
        );
        await Promise.race([fetchProfile(userId), profileTimeout]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // 1. Restaurar sesión del storage con timeout de seguridad (5s)
    const sessionTimeout = new Promise<{ data: { session: null }; isTimeout: boolean }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null }, isTimeout: true }), 5000),
    );

    Promise.race([
      supabase.auth.getSession().catch((err) => {
        console.error("Session restore error:", err);
        return { data: { session: null }, error: err };
      }),
      sessionTimeout,
    ])
      .then((res) => {
        if (!mounted) return;
        const session = (res as { data?: { session?: { user?: { id?: string } } | null } })?.data?.session;
        if (session?.user?.id) {
          initialSessionHandled.current = true;
          loadProfile(session.user.id);
        } else {
          // Si no hay sesión o hubo timeout, pero ya hay un usuario guardado en caché offline, mantenerlo
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Session restore error:", err);
        if (mounted) setLoading(false);
      });

    // 2. Escuchar cambios (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "INITIAL_SESSION") {
        if (initialSessionHandled.current) return;
        const userId = session?.user?.id;
        if (userId) {
          initialSessionHandled.current = true;
          loadProfile(userId);
        } else {
          setLoading(false);
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const userId = session?.user?.id;
        if (userId) {
          initialSessionHandled.current = true;
          loadProfile(userId);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        lastFetchedId.current = null;
        localStorage.removeItem("la30_active_store");
        localStorage.removeItem("la30_active_company");
        localStorage.removeItem(STORAGE_USER_KEY);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ─── Logout ───────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 2000),
      );
      await Promise.race([signOutPromise, timeoutPromise]);
    } catch {
      // Siempre limpiamos aunque falle signOut
    } finally {
      localStorage.removeItem("la30_active_store");
      localStorage.removeItem("la30_active_company");
      localStorage.removeItem(STORAGE_USER_KEY);
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      if (user) {
        const activeChannel = supabase.getChannels().find((c) => c.topic === `realtime:user-${user.id}`);
        if (activeChannel) {
          await activeChannel.send({
            type: "broadcast",
            event: "global-logout",
            payload: {},
          });
        }
      }

      const signOutPromise = supabase.auth.signOut({ scope: "global" });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 2000),
      );
      await Promise.race([signOutPromise, timeoutPromise]);
      toast.success("Sesión cerrada en todos los dispositivos");
    } catch {
      // Siempre limpiamos aunque falle signOut
    } finally {
      localStorage.removeItem("la30_active_store");
      localStorage.removeItem("la30_active_company");
      localStorage.removeItem(STORAGE_USER_KEY);
      setUser(null);
    }
  }, [user]);

  // ─── Realtime Global Logout Listener ────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`user-${user.id}`);

    channel
      .on("broadcast", { event: "global-logout" }, () => {
        toast.info("Sesión cerrada desde otro dispositivo");
        logout();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, logout]);

  // ─── Auto-logout por inactividad (1 hora) ─────────────────
  useEffect(() => {
    if (!user) return; // Solo rastrear cuando hay sesión activa

    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        toast.info("Sesión cerrada por inactividad");
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    // Iniciar timer
    resetTimer();

    // Escuchar actividad del usuario
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetTimer, { passive: true }),
    );

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetTimer),
      );
    };
  }, [user, logout]);

  // ─── Login ────────────────────────────────────────────────
  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return {
          success: false,
          error: error?.message || "Credenciales inválidas",
        };
      }

      await fetchProfile(data.user.id);
      return { success: true };
    },
    [fetchProfile],
  );

  const forceReset = useCallback(() => {
    import("@/lib/systemUtils").then((m) => m.forceSystemReset());
  }, []);

  const value = useMemo(() => ({
    user,
    login,
    logout,
    logoutAll,
    forceReset,
    isAuthenticated: !!user,
    loading,
  }), [user, login, logout, logoutAll, forceReset, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRequireRole(...roles: UserRole[]) {
  const { user } = useAuth();
  return user && roles.includes(user.role);
}

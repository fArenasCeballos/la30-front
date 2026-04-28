/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
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
  forceReset: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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
        setUser(null);
        return;
      }

      if (!data) {
        setUser(null);
        return;
      }

      setUser(data);
    } catch (err) {
      console.error("Profile fetch exception:", err);
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
      await fetchProfile(userId);
      if (mounted) setLoading(false);
    };

    // 1. Restaurar sesión del storage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user?.id) {
        initialSessionHandled.current = true;
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
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
      setUser(null);
    }
  }, []);

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

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        forceReset,
        isAuthenticated: !!user,
        loading,
      }}
    >
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

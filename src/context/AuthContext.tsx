/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { User, UserRole } from "@/types";
import { supabase } from "@/lib/supabase";

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
        console.warn("No profile data found for user:", userId);
        setUser(null);
        return;
      }

      setUser(data);
    } catch (err) {
      console.error("Profile fetch exception:", err);
      setUser(null);
    }
  }, []);

  const lastFetchedId = React.useRef<string | null>(null);

  // Listen for auth state changes (session restore, login, logout)
  useEffect(() => {
    let mounted = true;

    const handleSession = async (session: import("@supabase/supabase-js").Session | null) => {
      if (!mounted) return;
      const userId = session?.user?.id;

      if (userId) {
        if (lastFetchedId.current !== userId) {
          lastFetchedId.current = userId;
          await fetchProfile(userId);
        }
      } else {
        lastFetchedId.current = null;
        setUser(null);
      }
      setLoading(false);
    };

    // 1. Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // 2. Escuchar cambios futuros
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return { success: false, error: error?.message || "Credenciales inválidas" };
      }

      await fetchProfile(data.user.id);
      return { success: true };
    },
    [fetchProfile],
  );

  const logout = useCallback(async () => {
    try {
      // Limpiamos la sesión en Supabase (con timeout de seguridad)
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("TIMEOUT")), 2000)
      );
      await Promise.race([signOutPromise, timeoutPromise]);
    } catch (err) {
      console.warn("SignOut de Supabase falló o tardó demasiado:", err);
    } finally {
      // Siempre limpiamos el estado local pase lo que pase
      setUser(null);
    }
  }, []);

  const forceReset = useCallback(() => {
    // Importamos dinámicamente o usamos la utilidad
    import("@/lib/systemUtils").then(m => m.forceSystemReset());
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, forceReset, isAuthenticated: !!user, loading }}
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

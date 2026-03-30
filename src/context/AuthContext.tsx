import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { User, UserRole } from "@/types";
import { supabase } from "@/lib/supabase";

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile from DB given auth user id
  const fetchProfile = useCallback(async (userId: string) => {
    console.log("Fetching profile for:", userId);
    
    // Safety timeout to prevent infinite hang
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout fetching profile")), 10000)
    );

    try {
      const fetchPromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

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

      console.log("Profile loaded successfully:", data.role);
      setUser(data);
    } catch (err) {
      console.error("Profile fetch exception:", err);
      setUser(null);
    }
  }, []);

  // Listen for auth state changes (session restore, login, logout)
  useEffect(() => {
  let initialized = false;

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      await fetchProfile(session.user.id);
    }

    setLoading(false);
    initialized = true;
  };

  init();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (!initialized) return;

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
    }
  );

  return () => subscription.unsubscribe();
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
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAuthenticated: !!user, loading }}
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

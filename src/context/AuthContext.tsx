import React, { createContext, useContext, useState, useCallback } from "react";
import type { User, UserRole } from "@/types";
import { MOCK_USERS } from "@/data/mock";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem("la30_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(
    async (email: string, _password: string): Promise<boolean> => {
      // Mock: find user by email, any password works
      const found = MOCK_USERS.find((u) => u.email === email);
      if (found) {
        setUser(found);
        sessionStorage.setItem("la30_user", JSON.stringify(found));
        return true;
      }
      return false;
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("la30_user");
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAuthenticated: !!user }}
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

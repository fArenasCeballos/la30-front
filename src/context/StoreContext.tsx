/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Store, Profile } from "@/types";

const STORAGE_KEY = "la30_active_store";

export interface StoreContextType {
  stores: Store[];
  activeStore: Store | null;
  setActiveStore: (store: Store) => void;
  loading: boolean;
  isAdmin: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "admin";

  // Consolidate fetching and resolving into a single effect to avoid cascading renders
  useEffect(() => {
    async function initializeStores() {
      if (!user) return;

      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching stores:", error);
        setLoading(false);
        return;
      }

      const loadedStores = data || [];
      setStores(loadedStores);

      // Resolve active store
      let storeToSet: Store | null = null;
      
      if (user.role === "admin") {
        const savedSlug = localStorage.getItem(STORAGE_KEY);
        if (savedSlug) {
          storeToSet = loadedStores.find((s) => s.slug === savedSlug) || null;
        }
      } else {
        const userStoreId = (user as Profile).store_id;
        if (userStoreId) {
          storeToSet = loadedStores.find((s) => s.id === userStoreId) || null;
        }
      }

      // Only update state if different to prevent unnecessary renders and infinite loops
      if (storeToSet && activeStore?.id !== storeToSet.id) {
        setActiveStoreState(storeToSet);
      }
      
      setLoading(false);
    }

    initializeStores();
  }, [user, activeStore]); // Depend on user and activeStore for strict compliance

  const setActiveStore = useCallback(
    (store: Store) => {
      setActiveStoreState(store);
      localStorage.setItem(STORAGE_KEY, store.slug);
    },
    [],
  );

  const value = useMemo(
    () => ({
      stores,
      activeStore,
      setActiveStore,
      loading,
      isAdmin,
    }),
    [stores, activeStore, setActiveStore, loading, isAdmin],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

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
  canSwitchStore: boolean;
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
    let isCancelled = false;

    async function initializeStores() {
      if (!user) {
        setStores([]);
        setActiveStoreState(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .order("created_at", { ascending: true });

        if (isCancelled) return;

        if (error) {
          console.error("Error fetching stores:", error);
          setLoading(false);
          return;
        }

        let loadedStores = (data || []).map((s: Store) => ({
          ...s,
          name: s.name === "Carrito Móvil" ? "Tráiler" : s.name,
        }));

        // Filter accessible stores for non-admin users
        if (user.role !== "admin") {
          const profile = user as Profile;
          if (profile.allowed_store_ids && profile.allowed_store_ids.length > 0) {
            loadedStores = loadedStores.filter((s) =>
              profile.allowed_store_ids!.includes(s.id),
            );
          } else if (profile.store_id) {
            // Fallback to legacy single store_id if allowed_store_ids is empty
            loadedStores = loadedStores.filter((s) => s.id === profile.store_id);
          }
          // If profile.allowed_store_ids is null/empty and profile.store_id is null,
          // it means GLOBAL ACCESS, so loadedStores contains all stores.
        }

        if (isCancelled) return;
        setStores(loadedStores);

        // Resolve active store
        let storeToSet: Store | null = null;

        const savedSlug = localStorage.getItem(STORAGE_KEY);
        if (savedSlug) {
          storeToSet = loadedStores.find((s) => s.slug === savedSlug) || null;
        }

        // If no valid saved store is found among accessible stores, default to the first one
        if (!storeToSet && loadedStores.length > 0) {
          storeToSet = loadedStores[0];
        }

        // Only update state if different to prevent unnecessary renders and infinite loops
        if (storeToSet) {
          setActiveStoreState((prev) =>
            prev?.id !== storeToSet?.id ? storeToSet : prev,
          );
        } else {
          setActiveStoreState(null);
        }
      } catch (err) {
        console.error("Error initializing stores:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    initializeStores();

    return () => {
      isCancelled = true;
    };
  }, [user]); // Depend only on user to initialize stores once per session

  const setActiveStore = useCallback(
    (store: Store) => {
      setActiveStoreState(store);
      localStorage.setItem(STORAGE_KEY, store.slug);
    },
    [],
  );

  const canSwitchStore = isAdmin || stores.length > 1;

  const value = useMemo(
    () => ({
      stores,
      activeStore,
      setActiveStore,
      loading,
      isAdmin,
      canSwitchStore,
    }),
    [stores, activeStore, setActiveStore, loading, isAdmin, canSwitchStore],
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

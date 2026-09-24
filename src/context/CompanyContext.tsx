/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/types";

const STORAGE_KEY = "la30_active_company";
const STORAGE_DATA_KEY = "la30_active_company_data";

export interface CompanyContextType {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompany: (company: Company) => void;
  updateCompanyProfitability: (
    companyId: string,
    enabled: boolean,
  ) => Promise<void>;
  loading: boolean;
  canSwitchCompany: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(
    () => {
      try {
        const raw = localStorage.getItem(STORAGE_DATA_KEY);
        return raw ? (JSON.parse(raw) as Company) : null;
      } catch {
        return null;
      }
    },
  );
  const [loading, setLoading] = useState(true);
  const activeCompanyRef = useRef(activeCompany);

  useEffect(() => {
    activeCompanyRef.current = activeCompany;
  }, [activeCompany]);

  // Fetch accessible companies and resolve the active one
  useEffect(() => {
    let isCancelled = false;

    async function initializeCompanies() {
      if (!user) {
        if (!authLoading) {
          setCompanies([]);
          setActiveCompanyState(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        // Timeout de seguridad de 5s para no bloquear si hay corte o congelamiento de red
        const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) =>
          setTimeout(() => resolve({ isTimeout: true }), 5000),
        );

        const fetchPromise = supabase.rpc("get_user_companies");
        const result = await Promise.race([fetchPromise, timeoutPromise]);

        if (isCancelled) return;

        if ("isTimeout" in result) {
          console.warn(
            "[Company] Timeout esperando get_user_companies. Usando empresa en caché.",
          );
          if (activeCompanyRef.current) {
            setCompanies([activeCompanyRef.current]);
          }
          setLoading(false);
          return;
        }

        const { data, error } = result;

        if (error) {
          console.error("Error fetching companies:", error);
          const isNetworkErr =
            !navigator.onLine ||
            error.message?.includes("Failed to fetch") ||
            error.message?.includes("NetworkError");

          if (isNetworkErr && activeCompanyRef.current) {
            console.warn(
              "[Company] Sin red. Conservando empresa activa en caché:",
              activeCompanyRef.current.name,
            );
            setCompanies([activeCompanyRef.current]);
            setLoading(false);
            return;
          }

          // Fallback: If RPC doesn't exist yet (pre-migration), auto-resolve
          // by loading all companies directly
          try {
            const { data: fallbackData } = await supabase
              .from("companies")
              .select("*")
              .eq("is_active", true)
              .order("created_at", { ascending: true });

            if (isCancelled) return;

            if (fallbackData && fallbackData.length > 0) {
              setCompanies(fallbackData as Company[]);
              resolveActiveCompany(fallbackData as Company[]);
            } else {
              if (activeCompanyRef.current) setCompanies([activeCompanyRef.current]);
              setLoading(false);
            }
          } catch {
            if (activeCompanyRef.current) setCompanies([activeCompanyRef.current]);
            setLoading(false);
          }
          return;
        }

        const loadedCompanies = (data || []) as Company[];

        if (isCancelled) return;
        setCompanies(loadedCompanies);
        resolveActiveCompany(loadedCompanies);
      } catch (err) {
        console.error("Error initializing companies:", err);
        if (!isCancelled) {
          if (activeCompanyRef.current) setCompanies([activeCompanyRef.current]);
          setLoading(false);
        }
      }
    }

    function resolveActiveCompany(loadedCompanies: Company[]) {
      let companyToSet: Company | null = null;

      // 1. Try to restore from localStorage
      const savedSlug = localStorage.getItem(STORAGE_KEY);
      if (savedSlug) {
        companyToSet =
          loadedCompanies.find((c) => c.slug === savedSlug) || null;
      }

      // 2. If no saved company (or saved one not accessible), auto-resolve
      if (!companyToSet && loadedCompanies.length > 0) {
        // If user has only 1 company, auto-select it
        if (loadedCompanies.length === 1) {
          companyToSet = loadedCompanies[0];
        }
        // If multiple, leave null so CompanySelector is shown
      }

      if (companyToSet) {
        setActiveCompanyState((prev) =>
          prev?.id !== companyToSet?.id ? companyToSet : prev,
        );
        localStorage.setItem(STORAGE_KEY, companyToSet.slug);
        localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(companyToSet));
      } else {
        setActiveCompanyState(null);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_DATA_KEY);
      }

      setLoading(false);
    }

    initializeCompanies();

    return () => {
      isCancelled = true;
    };
  }, [user, authLoading]);

  const setActiveCompany = useCallback((company: Company) => {
    setActiveCompanyState(company);
    localStorage.setItem(STORAGE_KEY, company.slug);
    localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(company));
    // Clear the active store when switching companies to force re-selection
    localStorage.removeItem("la30_active_store");
  }, []);

  const updateCompanyProfitability = useCallback(
    async (companyId: string, enabled: boolean) => {
      const { error: rpcError } = await supabase.rpc(
        "admin_update_company_profitability",
        {
          p_company_id: companyId,
          p_enabled: enabled,
        },
      );
      if (rpcError) {
        const { error: updateError } = await supabase
          .from("companies")
          .update({ profitability_enabled: enabled })
          .eq("id", companyId);
        if (updateError) throw updateError;
      }

      setActiveCompanyState((prev) => {
        if (prev && prev.id === companyId) {
          const updated = { ...prev, profitability_enabled: enabled };
          localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(updated));
          return updated;
        }
        return prev;
      });

      setCompanies((prev) =>
        prev.map((c) =>
          c.id === companyId ? { ...c, profitability_enabled: enabled } : c,
        ),
      );
    },
    [],
  );

  const canSwitchCompany = companies.length > 1;

  const value = useMemo(
    () => ({
      companies,
      activeCompany,
      setActiveCompany,
      updateCompanyProfitability,
      loading,
      canSwitchCompany,
    }),
    [
      companies,
      activeCompany,
      setActiveCompany,
      updateCompanyProfitability,
      loading,
      canSwitchCompany,
    ],
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Company } from "@/types";

const STORAGE_KEY = "la30_active_company";

export interface CompanyContextType {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompany: (company: Company) => void;
  loading: boolean;
  canSwitchCompany: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch accessible companies and resolve the active one
  useEffect(() => {
    let isCancelled = false;

    async function initializeCompanies() {
      if (!user) {
        setCompanies([]);
        setActiveCompanyState(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_user_companies");

        if (isCancelled) return;

        if (error) {
          console.error("Error fetching companies:", error);
          // Fallback: If RPC doesn't exist yet (pre-migration), auto-resolve
          // by loading all companies directly
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
        if (!isCancelled) setLoading(false);
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
      } else {
        setActiveCompanyState(null);
      }

      setLoading(false);
    }

    initializeCompanies();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const setActiveCompany = useCallback((company: Company) => {
    setActiveCompanyState(company);
    localStorage.setItem(STORAGE_KEY, company.slug);
    // Clear the active store when switching companies to force re-selection
    localStorage.removeItem("la30_active_store");
  }, []);

  const canSwitchCompany = companies.length > 1;

  const value = useMemo(
    () => ({
      companies,
      activeCompany,
      setActiveCompany,
      loading,
      canSwitchCompany,
    }),
    [companies, activeCompany, setActiveCompany, loading, canSwitchCompany],
  );

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx)
    throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

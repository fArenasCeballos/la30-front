import { NavLink as RouterNavLink } from "react-router-dom";
import type { NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const queryClient = useQueryClient();

    // Precarga inteligente basada en la ruta
    const handlePrefetch = () => {
      const path = to.toString();

      if (path === "/dashboard") {
        queryClient.prefetchQuery({
          queryKey: ["dashboard-stats"],
          queryFn: async () => {
            const { data } = await supabase.rpc("get_dashboard_stats");
            return data;
          },
        });
        queryClient.prefetchQuery({
          queryKey: ["top-products"],
          queryFn: async () => {
            const { data } = await supabase.rpc("get_top_products", {
              p_limit: 6,
            });
            return data;
          },
        });
      } else if (path === "/kiosko") {
        queryClient.prefetchQuery({
          queryKey: ["categories"],
          queryFn: async () => {
            const { data } = await supabase
              .from("categories")
              .select("*")
              .eq("is_active", true)
              .order("sort_order");
            return data;
          },
        });
        queryClient.prefetchQuery({
          queryKey: ["products"],
          queryFn: async () => {
            const { data } = await supabase
              .from("products")
              .select("*, categories(*)")
              .eq("available", true)
              .order("sort_order");
            return data;
          },
        });
      }
    };

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        onMouseEnter={handlePrefetch}
        onTouchStart={handlePrefetch}
        className={({ isActive, isPending }) =>
          cn(
            className,
            isActive && activeClassName,
            isPending && pendingClassName,
          )
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };

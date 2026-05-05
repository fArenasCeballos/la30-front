/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Notification } from "@/types";

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], refetch: refreshNotifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60, // 1 minuto de caché para notificaciones
  });

  useEffect(() => {
    if (!user?.id) return;
    
    const notifChannel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "notifications",
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          queryClient.setQueryData(['notifications', user.id], (old: Notification[] | undefined) => {
            const list = old || [];
            return [newNotif, ...list].slice(0, 50);
          });
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [queryClient, user?.id]);

  const unreadCount = React.useMemo(() => 
    notifications.filter((n) => !n.read).length, 
    [notifications]
  );

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    const { error } = await supabase.rpc("mark_notifications_read");
    if (!error) {
      queryClient.setQueryData(['notifications', user?.id], (old: Notification[] | undefined) => {
        if (!old) return old;
        return old.map(n => ({ ...n, read: true }));
      });
    }
  }, [queryClient, user?.id]);

  const clearNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { error } = await supabase.rpc("clear_my_notifications");
    if (!error) {
      queryClient.setQueryData(['notifications', user?.id], []);
    }
  }, [queryClient, user?.id]);

  const handleRefresh = useCallback(async () => {
    await refreshNotifications();
  }, [refreshNotifications]);

  const value = React.useMemo(() => ({
    notifications,
    unreadCount,
    markAllRead,
    clearNotifications,
    refreshNotifications: handleRefresh,
  }), [notifications, unreadCount, markAllRead, clearNotifications, handleRefresh]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

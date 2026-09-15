import { useState, useMemo } from "react";
import { useNotifications } from "@/context/NotificationContext";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BellRing,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Notification } from "@/types";

function formatNotifTime(dateStr: string | undefined | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--";
  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Justo ahora";
  if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  return date.toLocaleDateString("es-CO", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractTitleEmoji(title?: string | null): string | undefined {
  if (!title) return undefined;
  try {
    const match = title.match(/[\p{Extended_Pictographic}]/u);
    return match ? match[0] : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeNotificationTitle(title?: string | null): string {
  if (!title) return "";
  try {
    return title.replace(/[\p{Extended_Pictographic}\s]+$/u, "").trim();
  } catch {
    return title.trim();
  }
}

export interface NotificationBellProps {
  ecosystem?: "restaurant" | "kiosk";
}

export function NotificationBell({
  ecosystem: _ecosystem = "restaurant",
}: NotificationBellProps) {
  const { notifications, unreadCount, markAllRead, markAsRead, clearNotifications } =
    useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const displayedNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  const renderIcon = (n: Notification) => {
    const titleEmoji = extractTitleEmoji(n.title);

    if (n.type === "warning") {
      return (
        <div className="size-8 rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/70 flex items-center justify-center shrink-0 shadow-2xs">
          <AlertTriangle className="size-4 text-amber-600" />
        </div>
      );
    }

    if (n.type === "success") {
      return (
        <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70 flex items-center justify-center shrink-0 shadow-2xs">
          <CheckCircle2 className="size-4 text-emerald-600" />
        </div>
      );
    }

    if (titleEmoji) {
      return (
        <div className="size-8 rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/70 flex items-center justify-center shrink-0 text-base leading-none shadow-2xs">
          {titleEmoji}
        </div>
      );
    }

    return (
      <div className="size-8 rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-200/70 flex items-center justify-center shrink-0 shadow-2xs">
        <Sparkles className="size-4 text-teal-600" />
      </div>
    );
  };

  const getTagBadge = (n: Notification) => {
    if (n.type === "warning") {
      return (
        <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded-md leading-none">
          Stock Bajo
        </span>
      );
    }
    if (n.type === "success") {
      return (
        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md leading-none">
          Éxito
        </span>
      );
    }
    return null;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} no leídas)` : ""}`}
          className={`relative size-9 rounded-xl flex items-center justify-center transition-all duration-300 border ${
            unreadCount > 0
              ? "bg-amber-50/80 hover:bg-amber-100/80 border-amber-200/80 text-amber-800 shadow-2xs"
              : "bg-slate-100/60 hover:bg-slate-200/60 border-slate-200/60 text-slate-600 hover:text-slate-900"
          } active:scale-95`}
        >
          <Bell
            className={`size-4 transition-transform duration-300 ${
              unreadCount > 0 ? "text-amber-600 scale-105" : ""
            }`}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs ring-2 ring-white animate-in zoom-in">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-96 p-0 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="p-3.5 pb-2.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <h4 className="font-display font-black text-sm text-slate-900 tracking-tight">
                Notificaciones
              </h4>
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200/70">
                  {unreadCount} nuevas
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center gap-1">
                  <Check className="size-2.5" /> Al día
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  title="Marcar todas como leídas"
                  onClick={() => markAllRead()}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 py-1 rounded-lg transition-colors"
                >
                  <CheckCheck className="size-3.5" />
                  <span className="hidden sm:inline">Leer todo</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  title="Limpiar todas las notificaciones"
                  onClick={() => clearNotifications()}
                  className="inline-flex items-center justify-center size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          {notifications.length > 0 && (
            <div className="flex items-center p-0.5 bg-slate-200/60 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`flex-1 py-1 px-2.5 rounded-lg text-center transition-all ${
                  filter === "all"
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`flex-1 py-1 px-2.5 rounded-lg text-center transition-all ${
                  filter === "unread"
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                No leídas ({unreadCount})
              </button>
            </div>
          )}
        </div>

        {/* List of Notifications */}
        <div className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-slate-100/80 p-2 space-y-1">
          {displayedNotifications.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="size-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 mx-auto ring-4 ring-teal-50/50">
                <BellRing className="size-5 text-teal-600" />
              </div>
              <p className="text-xs font-black text-slate-800 tracking-tight mb-1">
                {filter === "unread"
                  ? "¡No tienes notificaciones pendientes!"
                  : "Bandeja vacía"}
              </p>
              <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                {filter === "unread"
                  ? "Todas las novedades han sido leídas."
                  : "Te avisaremos de inmediato cuando haya alertas de pedidos o inventario."}
              </p>
            </div>
          ) : (
            displayedNotifications.map((n) => {
              const isUnread = !n.read;
              const cleanTitle = sanitizeNotificationTitle(n.title);

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (isUnread) markAsRead(n.id);
                  }}
                  className={`group relative flex items-start gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                    isUnread
                      ? "bg-amber-50/30 hover:bg-amber-50/60 border border-amber-200/50 shadow-2xs"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  {/* Icon */}
                  {renderIcon(n)}

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {getTagBadge(n)}
                        {cleanTitle && (
                          <p
                            className={`text-xs truncate ${
                              isUnread
                                ? "font-bold text-slate-900"
                                : "font-medium text-slate-700"
                            }`}
                          >
                            {cleanTitle}
                          </p>
                        )}
                      </div>

                      {isUnread && (
                        <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      )}
                    </div>

                    <p
                      className={`text-xs leading-relaxed line-clamp-2 ${
                        isUnread ? "text-slate-800 font-medium" : "text-slate-500"
                      }`}
                    >
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                        <Clock className="size-2.5 text-slate-400" />
                        {formatNotifTime(n.created_at)}
                      </span>

                      {isUnread && (
                        <span className="text-[10px] font-bold text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <Check className="size-2.5" /> Marcar leída
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

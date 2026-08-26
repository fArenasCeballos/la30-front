import { useNotifications } from "@/context/NotificationContext";
import { Button } from "@/components/ui/button";
import { Bell, Check, Trash2, Clock, AlertTriangle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatNotifTime(dateStr: string | undefined | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface NotificationBellProps {
  ecosystem?: "restaurant" | "kiosk";
}

export function NotificationBell({
  ecosystem: _ecosystem = "restaurant",
}: NotificationBellProps) {
  const { notifications, markAllRead, clearNotifications } = useNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse-glow">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-display font-bold text-sm">Notificaciones</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={markAllRead}
              >
                <Check className="h-3 w-3 mr-1" /> Leer todo
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={clearNotifications}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Limpiar
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Sin notificaciones
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex gap-3 px-3 py-3 border-b last:border-0 text-sm transition-colors ${
                n.type === "warning"
                  ? "bg-red-50 border-red-100 border-l-4 border-l-red-500"
                  : !n.read
                    ? "bg-accent/50"
                    : ""
              }`}
            >
              {/* Icon */}
              <div className="shrink-0 mt-0.5">
                {n.type === "warning" ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </span>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-base leading-none">
                    {n.title?.match(/[\p{Emoji}]/u)?.[0] ?? "🔔"}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {n.type === "warning" ? (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                      Stock Bajo
                    </span>
                  </div>
                ) : (
                  n.title && (
                    <p className="font-semibold text-slate-700 truncate text-xs mb-0.5">
                      {n.title.replace(/[\p{Emoji}\s]+$/u, "").trim()}
                    </p>
                  )
                )}
                <p className={`leading-snug ${
                  n.type === "warning" ? "text-red-900 font-medium" : "text-slate-600"
                }`}>
                  {n.message}
                </p>
                <p className={`text-xs mt-1 flex items-center gap-1 ${
                  n.type === "warning" ? "text-red-400" : "text-muted-foreground"
                }`}>
                  <Clock className="h-3 w-3" />
                  {formatNotifTime(n.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

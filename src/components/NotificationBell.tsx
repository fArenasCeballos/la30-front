import { useOrders } from "@/context/OrderContext";
import { Button } from "@/components/ui/button";
import { Bell, Check, Trash2, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearNotifications } =
    useOrders();

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
              className={`px-3 py-2.5 border-b last:border-0 text-sm transition-colors ${!n.read ? "bg-accent/50" : ""}`}
            >
              <p className="leading-snug">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {n.timestamp.toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

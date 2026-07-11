"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { randomId } from "@/lib/utils/random-id";

interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface NotificationContextValue {
  notifications: Notification[];
  notify: (message: string, type?: Notification["type"]) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = React.createContext<NotificationContextValue>({
  notifications: [],
  notify: () => undefined,
  dismiss: () => undefined,
});

export function useNotifications() {
  return React.useContext(NotificationContext);
}

const AUTO_DISMISS_MS = 4000;

const TYPE_STYLES: Record<Notification["type"], string> = {
  success: "border-(--color-success) bg-(--color-success-light) text-(--color-success)",
  error: "border-(--color-danger) bg-(--color-danger-light) text-(--color-danger)",
  warning: "border-(--color-warning) bg-(--color-warning-light) text-(--color-warning)",
  info: "border-(--color-info) bg-(--color-info-light) text-(--color-info)",
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = React.useCallback(
    (message: string, type: Notification["type"] = "info") => {
      const id = randomId();
      setNotifications((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-(--shadow-lg)",
              "animate-in fade-in-0 slide-in-from-bottom-2",
              TYPE_STYLES[n.type]
            )}
          >
            <p className="flex-1">{n.message}</p>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              className="shrink-0 opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

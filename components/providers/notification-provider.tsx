"use client";

import * as React from "react";

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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotificationContext.Provider
      value={{ notifications: [], notify: () => undefined, dismiss: () => undefined }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

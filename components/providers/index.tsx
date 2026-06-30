"use client";

import { ThemeProvider } from "./theme-provider";
import { RoleProvider } from "./role-provider";
import { PermissionProvider } from "./permission-provider";
import { NotificationProvider } from "./notification-provider";
import { AIProvider } from "./ai-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <RoleProvider>
        <PermissionProvider>
          <NotificationProvider>
            <AIProvider>
              {children}
            </AIProvider>
          </NotificationProvider>
        </PermissionProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}

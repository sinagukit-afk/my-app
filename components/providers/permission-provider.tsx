"use client";

import * as React from "react";

interface PermissionContextValue {
  can: (action: string) => boolean;
}

const PermissionContext = React.createContext<PermissionContextValue>({
  can: () => false,
});

export function usePermission() {
  return React.useContext(PermissionContext);
}

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  return (
    <PermissionContext.Provider value={{ can: () => false }}>
      {children}
    </PermissionContext.Provider>
  );
}

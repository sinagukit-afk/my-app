"use client";

import * as React from "react";

type Role = "admin" | "manager" | "staff" | null;

interface RoleContextValue {
  role: Role;
}

const RoleContext = React.createContext<RoleContextValue>({ role: null });

export function useRole() {
  return React.useContext(RoleContext);
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  return (
    <RoleContext.Provider value={{ role: null }}>
      {children}
    </RoleContext.Provider>
  );
}

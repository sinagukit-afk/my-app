"use client";

import * as React from "react";

interface AIContextValue {
  isAvailable: boolean;
}

const AIContext = React.createContext<AIContextValue>({ isAvailable: false });

export function useAI() {
  return React.useContext(AIContext);
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  return (
    <AIContext.Provider value={{ isAvailable: false }}>
      {children}
    </AIContext.Provider>
  );
}

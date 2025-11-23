"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { trpc } from "@/utils/trpc";

/**
 * Timezone Context
 * Provides the system-wide timezone setting to all components
 */

const TimezoneContext = createContext<string>("America/Los_Angeles");

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const { data: timezone } = trpc.settings.getTimezone.useQuery(undefined, {
    staleTime: Infinity, // Cache indefinitely unless manually invalidated
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return (
    <TimezoneContext.Provider value={timezone || "America/Los_Angeles"}>
      {children}
    </TimezoneContext.Provider>
  );
}

/**
 * Hook to access the current timezone setting
 * @returns The current timezone string (e.g., "America/Los_Angeles")
 */
export function useTimezone(): string {
  return useContext(TimezoneContext);
}

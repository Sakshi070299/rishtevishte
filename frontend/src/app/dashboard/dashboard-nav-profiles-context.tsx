"use client";

import { createContext, useContext } from "react";

export type DashboardNavProfilesContextValue = {
  /** `null` until first fetch completes */
  myProfileCount: number | null;
  myProfilesLoading: boolean;
  refreshMyProfiles: () => Promise<void>;
};

export const DashboardNavProfilesContext =
  createContext<DashboardNavProfilesContextValue | null>(null);

/** Same `/profiles` list fetch as sidebar — use to hide “Add New” / block `/register` when count ≥ 1 */
export function useDashboardNavProfiles(): DashboardNavProfilesContextValue {
  const ctx = useContext(DashboardNavProfilesContext);
  if (!ctx) {
    throw new Error(
      "useDashboardNavProfiles must be used inside the user dashboard layout",
    );
  }
  return ctx;
}

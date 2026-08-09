"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role } from "@/lib/types";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const STORAGE_KEY = "rophe.role";
const DEFAULT_ROLE: Role = "front-desk";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(DEFAULT_ROLE);

  // Hydrate from localStorage once on mount (no flash of wrong role).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "front-desk" || stored === "doctor" || stored === "patient") {
        setRoleState(stored);
      }
    } catch {
      // ignore — localStorage unavailable
    }
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole: (next: Role) => {
        setRoleState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // ignore
        }
      },
    }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used inside a RoleProvider");
  }
  return ctx;
}

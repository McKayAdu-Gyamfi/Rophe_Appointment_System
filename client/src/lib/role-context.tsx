"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { signIn as apiSignIn, signOut as apiSignOut, getMe } from "@/lib/api";
import type { Role, StaffSession } from "@/lib/types";

// ---------------------------------------------------------------------------
// Session + role.
//
// Staff sign in; patients never do — they arrive by link, so "signed out" is
// the patient role. `useRole()` keeps its original shape so every screen that
// gates on role === "front-desk" | "doctor" carries on working unchanged.
//
// This is prototype auth: the session lives in localStorage and protects
// nothing. Phase 3 swaps it for a server-issued httpOnly cookie.
// ---------------------------------------------------------------------------

interface AuthContextValue {
  session: StaffSession | null;
  role: Role;
  /** False until the stored session has been read — guards redirect flashes. */
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; session?: StaffSession; error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Session is fetched on mount using getMe()

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getMe();
      if (!active) return;
      if (result.ok) {
        setSession(result.session);
      } else {
        setSession(null);
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiSignIn({ email, password });
    if (!result.ok) return { ok: false as const, error: result.error };

    setSession(result.session);
    return { ok: true as const, session: result.session };
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      role: session?.role ?? "patient",
      ready,
      signIn,
      signOut,
    }),
    [session, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useRole(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useRole must be used inside a RoleProvider");
  }
  return ctx;
}

/** Alias that reads better at call sites that care about the session. */
export const useAuth = useRole;

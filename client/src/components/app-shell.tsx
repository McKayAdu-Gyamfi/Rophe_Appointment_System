"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/role-context";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

// Routes reachable without signing in. The patient portal is deliberately
// open — patients arrive from a link on their phone and have no account.
const PUBLIC_PREFIXES = ["/login", "/portal"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// App shell: top nav (with account menu) + role-aware sidebar (desktop) /
// bottom nav (mobile). The login screen renders bare — no chrome.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready } = useAuth();

  const publicRoute = isPublic(pathname);

  useEffect(() => {
    if (ready && !session && !publicRoute) router.replace("/login");
  }, [ready, session, publicRoute, router]);

  // Login owns the whole viewport.
  if (pathname === "/login") return <>{children}</>;

  // Hold the layout still until we know whether there's a session, otherwise
  // staff screens flash before the redirect fires.
  if (!ready || (!session && !publicRoute)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-brand-bg overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/role-context";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { AppFooter } from "./app-footer";

// Routes reachable without signing in. The patient portal is deliberately
// open — patients arrive from a link on their phone and have no account. So is
// the staff invite page: the person opening it is setting the password they
// would need in order to sign in, so requiring a session would be circular.
const PUBLIC_PREFIXES = ["/login", "/portal", "/invite"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// App shell, laid out as in the reference design: a full-height left rail, and
// a scrolling column holding the top bar, the page, and the footer. Pages own
// their own horizontal padding, so nothing is added around `children` here.
// Small screens drop the rail for the bottom nav.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready } = useAuth();

  const publicRoute = isPublic(pathname);

  useEffect(() => {
    if (ready && !session && !publicRoute) router.replace("/login");
  }, [ready, session, publicRoute, router]);

  // Login and the invite page own the whole viewport — neither has navigation
  // to offer someone who is not yet signed in.
  if (pathname === "/login" || pathname.startsWith("/invite")) return <>{children}</>;

  // Hold the layout still until we know whether there's a session, otherwise
  // staff screens flash before the redirect fires.
  if (!ready || (!session && !publicRoute)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-[1680px]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
          <AppFooter />
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

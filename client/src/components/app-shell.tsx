"use client";

import type { ReactNode } from "react";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

// App shell: top nav (with role switcher) + role-aware sidebar (desktop) /
// bottom nav (mobile). Patient role sees only the top nav and content — no
// sidebar or bottom nav — per Section 2's access table.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar />
        <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

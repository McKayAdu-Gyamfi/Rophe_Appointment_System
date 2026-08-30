"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen, Phone } from "lucide-react";
import { CLINIC } from "@/lib/clinic";
import { useAuth, useRole } from "@/lib/role-context";
import { NAV_BY_ROLE, LANDING_BY_ROLE } from "@/lib/nav";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "rophe.sidebar-collapsed";

// Reading localStorage in a lazy initialiser is safe here only because the
// shell holds this component back until `ready` (see AppShell), so the rail's
// first render is always a post-hydration one — the server never emits it.
// That saves collapsed users a frame of the rail snapping shut on every load.
function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

// Left rail, following the reference design's structure: the wordmark, then
// the nav as a column of pills, then a footer block pinned to the bottom.
// The reference puts a marketing upsell in that footer; ours holds the clinic
// phone line, which is what front-desk staff actually reach for mid-call.
//
// The rail collapses to an icon-only strip, so a crowded screen — the day
// view, a wide patient table — can borrow the width back. The choice sticks
// per browser, because it's a workstation preference, not a per-visit one.
export function Sidebar() {
  const { role } = useRole();
  const { signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // ignore — localStorage unavailable
      }
      return next;
    });
  }, []);

  if (items.length === 0) return null;

  function handleSignOut() {
    signOut();
    router.replace("/login");
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col bg-white transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex gap-2 pb-2 pt-6",
          collapsed ? "flex-col items-center px-2" : "items-center px-5",
        )}
      >
        {!collapsed && (
          <Link href={LANDING_BY_ROLE[role]} className="flex min-w-0 items-center">
            <span className="min-w-0 text-[15px] font-bold leading-tight tracking-tight text-teal-900">
              Rophe
              <span className="block text-[11px] font-medium tracking-normal text-slate-500">
                Specialist Care
              </span>
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900",
            !collapsed && "ml-auto",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      <nav
        className={cn(
          "scrollbar-slim flex-1 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-4",
        )}
      >
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl py-3 text-sm font-semibold transition-colors",
                    collapsed ? "justify-center px-3" : "px-3.5",
                    active
                      ? "bg-teal-700 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      active ? "text-white" : "text-slate-400",
                    )}
                  />
                  {!collapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("space-y-3 pb-5", collapsed ? "px-2" : "px-4")}>
        {collapsed ? (
          <a
            href={`tel:${CLINIC.phoneDial}`}
            aria-label={`Clinic line ${CLINIC.phone}`}
            title={`Clinic line · ${CLINIC.phone}`}
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-teal-700 transition hover:bg-teal-200"
          >
            <Phone className="h-4 w-4" />
          </a>
        ) : (
          <div className="rounded-panel bg-teal-100 p-4 text-center">
            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-teal-700">
              <Phone className="h-4 w-4" />
            </span>
            <p className="mt-2.5 text-[13px] font-bold text-teal-900">Clinic line</p>
            <p className="mt-0.5 text-[11px] leading-snug text-teal-800">
              Reach a colleague or call a patient back
            </p>
            <a
              href={`tel:${CLINIC.phoneDial}`}
              className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
            >
              {CLINIC.phone}
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          aria-label={collapsed ? "Sign out" : undefined}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900",
            collapsed ? "justify-center px-3" : "px-3.5",
          )}
        >
          <LogOut className="h-5 w-5 shrink-0 text-slate-400" />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </aside>
  );
}

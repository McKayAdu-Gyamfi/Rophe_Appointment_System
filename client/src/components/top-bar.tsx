"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, LogIn, LogOut, Search } from "lucide-react";
import { CLINIC } from "@/lib/clinic";
import { useAuth } from "@/lib/role-context";
import { QUICK_ACTIONS_BY_ROLE, pageMetaFor } from "@/lib/nav";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "Hello Abena, welcome back!" — first name only, as in the reference. */
function greeting(fullName: string): string {
  const first = fullName.replace(/^Dr\.?\s+/i, "").split(" ")[0] ?? fullName;
  return `Hello ${first}, welcome back!`;
}

// Top bar, following the reference design: the page title lives here rather
// than in the page body (see PAGE_META in lib/nav.ts), with search and the
// account cluster on the right. No brand mark here — small screens navigate
// with the bottom nav instead.
export function TopBar() {
  const { session, role, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const meta = pageMetaFor(pathname);
  const quickActions = QUICK_ACTIONS_BY_ROLE[role];

  // Escape closes the menu and hands focus back to the trigger, so keyboard
  // users aren't stranded at the top of the document.
  function closeMenu() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleSignOut() {
    setOpen(false);
    signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6 lg:gap-6 lg:px-8">
        <div className="min-w-0 flex-1">
          {meta.title && (
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {meta.title}
            </h1>
          )}
          {meta.greet && session ? (
            <p className="truncate text-[13px] text-slate-500">{greeting(session.fullName)}</p>
          ) : (
            !session && <p className="truncate text-[13px] text-slate-500">{CLINIC.name}</p>
          )}
        </div>

        {session && (
          <>
            <label className="relative hidden xl:block">
              <span className="sr-only">Search patients and appointments</span>
              <input
                type="search"
                placeholder="Search anything"
                className="h-11 w-72 rounded-full bg-slate-100 pl-5 pr-11 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </label>

            <div
              className="relative shrink-0"
              onKeyDown={(e) => {
                if (e.key === "Escape" && open) closeMenu();
              }}
            >
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-left transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                  {initials(session.fullName)}
                </span>
                <span className="hidden sm:block">
                  <span className="block text-sm font-bold leading-tight text-slate-900">
                    {session.fullName}
                  </span>
                  <span className="block text-[11px] leading-tight text-slate-500">
                    {session.jobTitle}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-panel bg-white shadow-pop"
                >
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">{session.fullName}</p>
                    <p className="truncate text-xs text-slate-500">{session.email}</p>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                      {session.jobTitle} · {session.staffId}
                    </p>
                  </div>

                  {/* Prototype convenience: jump to what a patient sees. */}
                  {/* Close on click, not mousedown — closing on mousedown unmounts
                      the anchor before mouseup, so no click fires and the link
                      never navigates. */}
                  <Link
                    href="/portal/appointment"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                    Preview patient view
                  </Link>

                  {/* The sidebar owns sign-out on desktop; this is the only
                      route to it on small screens, where the rail is hidden. */}
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSignOut();
                    }}
                    className="flex w-full items-center gap-2.5 border-t border-slate-200 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    <LogOut className="h-4 w-4 text-slate-400" />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {quickActions.length > 0 && (
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                {quickActions.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-label={label}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-teal-800 transition hover:bg-teal-200"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {!session && (
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <LogIn className="h-4 w-4" />
            Staff sign in
          </Link>
        )}
      </div>
    </header>
  );
}

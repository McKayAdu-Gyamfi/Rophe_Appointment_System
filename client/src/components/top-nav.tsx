"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, LogIn, LogOut } from "lucide-react";
import { CLINIC } from "@/lib/clinic";
import { useAuth } from "@/lib/role-context";
import { LANDING_BY_ROLE } from "@/lib/nav";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TopNav() {
  const { session, role, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={session ? LANDING_BY_ROLE[role] : "/login"} className="flex items-center gap-2.5">
          <Image
            src={CLINIC.logo}
            alt=""
            width={240}
            height={240}
            priority
            className="h-12 w-auto shrink-0 object-contain"
          />
          {/* Wordmark is in the logo, but it's unreadable at 36px — keep the
              text alongside, and hide it on the narrowest screens. */}
          <span className="hidden text-base font-semibold text-slate-900 sm:inline">
            {CLINIC.name}
          </span>
        </Link>

        {session ? (
          <div
            className="relative"
            onKeyDown={(e) => {
              if (e.key === "Escape" && open) closeMenu();
            }}
          >
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-600 text-[11px] font-semibold text-white">
                {initials(session.fullName)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-semibold leading-tight text-slate-900">
                  {session.fullName}
                </span>
                <span className="block text-[11px] leading-tight text-slate-500">
                  {session.jobTitle}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-slate-400 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{session.fullName}</p>
                  <p className="truncate text-xs text-slate-500">{session.email}</p>
                  <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
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
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                  Preview patient view
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4 text-slate-400" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <LogIn className="h-4 w-4 text-slate-400" />
            Staff sign in
          </Link>
        )}
      </div>
    </header>
  );
}

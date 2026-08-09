"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { useRole } from "@/lib/role-context";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<Role, string> = {
  "front-desk": "Front-desk Staff",
  doctor: "Doctor",
  patient: "Patient",
};

export function TopNav() {
  const { role, setRole } = useRole();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
            <span className="text-sm font-bold">R</span>
          </span>
          <span className="text-base font-semibold text-slate-900">
            Rophe Specialist Care
          </span>
        </Link>

        {/* Role switcher — no real auth, client-side state only */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <UserRound className="h-4 w-4 text-teal-600" />
            <span className="hidden sm:inline">Viewing as:</span>
            <span className="font-semibold text-slate-900">{ROLE_LABELS[role]}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>

          {open && (
            <ul
              role="listbox"
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setRole(r);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors",
                      role === r
                        ? "bg-teal-50 font-semibold text-teal-700"
                        : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {ROLE_LABELS[r]}
                    {role === r && (
                      <span className="h-2 w-2 rounded-full bg-teal-600" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}

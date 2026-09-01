"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, LogIn, LogOut, Search, Bell, User } from "lucide-react";
import { useAuth } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export function TopNav() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSignOut() {
    setOpen(false);
    signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 bg-white">
      <div className="flex h-16 w-full items-center justify-between px-6">
        <div className="flex-1 flex items-center">
          {session && (
            <div className="relative w-96">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search patients, files, or reports..."
                className="h-10 w-full rounded-full bg-slate-200/50 pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-brand-accent/20 transition-all"
              />
            </div>
          )}
        </div>

        {session ? (
          <div className="flex items-center gap-6">
            <button className="text-slate-500 hover:text-slate-700 transition relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 block h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-brand-bg" />
            </button>
            
            <div className="h-8 w-px bg-slate-200" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                className="flex items-center gap-3 text-left focus:outline-none"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <div className="hidden text-right sm:block">
                  <span className="block text-sm font-semibold leading-tight text-slate-800">
                    {session.fullName}
                  </span>
                  <span className="block text-xs font-medium leading-tight text-slate-500">
                    {session.jobTitle}
                  </span>
                </div>
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-brand-accent hover:text-brand-accent transition-colors" title="Upload profile picture">
                  <User className="h-5 w-5" />
                </div>
              </button>

              {open && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{session.fullName}</p>
                    <p className="truncate text-xs text-slate-500">{session.email}</p>
                  </div>

                  <Link
                    href="/portal/appointment"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                    Preview patient view
                  </Link>

                  <button
                    type="button"
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

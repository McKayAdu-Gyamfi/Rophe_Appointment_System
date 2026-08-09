"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/role-context";
import { NAV_BY_ROLE } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Compact bottom nav for small screens (where the sidebar is hidden).
// Patient role renders neither sidebar nor this — they only see the portal.
export function MobileNav() {
  const { role } = useRole();
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  if (items.length === 0) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-teal-700" : "text-slate-500",
                )}
              >
                <Icon
                  className={cn("h-5 w-5", active ? "text-teal-600" : "text-slate-400")}
                />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

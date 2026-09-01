"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/role-context";
import { NAV_BY_ROLE } from "@/lib/nav";
import { cn } from "@/lib/utils";

import Image from "next/image";
import { CLINIC } from "@/lib/clinic";

export function Sidebar() {
  const { role } = useRole();
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  if (items.length === 0) return null;

  return (
    <aside className="relative hidden h-full w-60 shrink-0 bg-brand-bg shadow-[4px_0_24px_rgba(0,0,0,0.03)] z-10 md:flex flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Image
          src={CLINIC.logo}
          alt={CLINIC.name}
          width={240}
          height={240}
          priority
          className="h-30 w-auto object-contain"
        />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-accent text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-white" : "text-slate-400",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

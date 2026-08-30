import Link from "next/link";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Panel primitives.
//
// The reference design has exactly one card treatment: a white, borderless,
// 16px-radius block sitting on the recessed #f5f5f7 surface. Separation comes
// from value, not from strokes or shadows — which is most of why the page
// reads as calm. Everything on the dashboard is built from these, so that
// treatment stays in one place.
// ---------------------------------------------------------------------------

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-panel bg-white p-5", className)} {...props}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  action,
  className,
}: {
  title: string;
  /** Trailing control — a SelectPill, PanelLink, or PanelMenuButton. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
      {action}
    </div>
  );
}

/** The filter control the reference uses on its charts ("This Week ⌄"). */
export function SelectPill({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  /** Accessible name — the pill shows only the current value. */
  label: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-full bg-teal-100 py-1.5 pl-3.5 pr-8 text-xs font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-teal-800" />
    </div>
  );
}

/** Stands in for the reference's "…" affordance, but actually goes somewhere. */
export function PanelMenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <MoreHorizontal className="h-4 w-4" />
    </Link>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-xs font-semibold text-teal-700 transition hover:text-teal-900"
    >
      {children}
    </Link>
  );
}

/** Soft status pill. `tone` classes come from lib/status-styles. */
export function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-8 text-center text-[13px] text-slate-400">{children}</p>;
}

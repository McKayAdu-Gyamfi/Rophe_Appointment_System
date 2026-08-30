import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";

/**
 * KPI tile from the reference design: label and value on the left, a dark
 * ink-filled icon square on the right, and a tinted footer strip carrying one
 * line of context.
 *
 * The reference's strip always shows a percentage delta. Ours carries whatever
 * that number's most useful qualifier is — the clinic has no week-on-week
 * baseline worth quoting, and a fabricated "+12% vs. yesterday" would be worse
 * than the plain fact it replaces.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  note,
  tone = "accent",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  note: string;
  /** `alert` recolours the footer strip when the number wants attention. */
  tone?: "accent" | "alert";
}) {
  const alert = tone === "alert";
  const Trend = alert ? ArrowDownRight : ArrowUpRight;

  return (
    <Panel className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-slate-500">{label}</p>
          <p className="tnum mt-1.5 text-[28px] font-bold leading-none tracking-tight text-teal-900">
            {value}
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-900 text-white">
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2.5",
          alert ? "bg-rose-100" : "bg-teal-100",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white",
            alert ? "bg-rose-600" : "bg-teal-600",
          )}
        >
          <Trend className="h-3.5 w-3.5" />
        </span>
        <span
          className={cn(
            "truncate text-xs font-semibold",
            alert ? "text-rose-900" : "text-teal-900",
          )}
        >
          {note}
        </span>
      </div>
    </Panel>
  );
}

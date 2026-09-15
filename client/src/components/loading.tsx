import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// On a slow line a wait on the API must never read as a blank or broken
// screen. Every page that loads data shows one of these until it lands.

/** A centred spinner for a page or panel with nothing to show yet. */
export function LoadingScreen({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-24 text-sm text-slate-500",
        className,
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
      {label}
    </div>
  );
}

/**
 * Floats a spinner over a skeleton, so the grey placeholder reads as "on its
 * way" rather than empty. The parent must be `relative`.
 */
export function LoadingOverlay({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-28 z-10 flex justify-center px-4",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-md ring-1 ring-slate-200">
        <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
        {label}
      </span>
    </div>
  );
}

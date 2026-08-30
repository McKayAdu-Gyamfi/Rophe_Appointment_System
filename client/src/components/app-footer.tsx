import Link from "next/link";
import { CLINIC } from "@/lib/clinic";

// Slim page footer, matching the reference design's closing rule: legal text
// on the left, secondary links trailing it, contact on the right.
export function AppFooter() {
  return (
    <footer className="mt-6 flex flex-col gap-3 px-4 pb-8 pt-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span>
          Copyright © {new Date().getFullYear()} {CLINIC.name}
        </span>
        <Link href="/portal/appointment" className="transition hover:text-slate-900">
          Patient view
        </Link>
        <Link href="/messages" className="transition hover:text-slate-900">
          Message log
        </Link>
      </div>
      <a
        href={`tel:${CLINIC.phoneDial}`}
        className="font-medium transition hover:text-slate-900"
      >
        {CLINIC.phone} · {CLINIC.addressLines.join(", ")}
      </a>
    </footer>
  );
}

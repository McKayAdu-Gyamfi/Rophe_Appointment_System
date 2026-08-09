"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2 } from "lucide-react";
import { getAppointments } from "@/lib/api";
import { CLINIC } from "@/lib/clinic";
import { dateKey } from "@/lib/format";

/**
 * Stands in for the "secure link" a patient would receive by WhatsApp/SMS.
 * Picks the soonest upcoming appointment and forwards to its page, so the
 * Patient role in the switcher always lands on something live rather than a
 * hardcoded id that could drift out of the seed.
 */
export default function PortalEntryPage() {
  const router = useRouter();
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const appointments = await getAppointments();
      if (!active) return;

      const todayKey = dateKey(new Date());
      const next = appointments
        .filter((a) => a.date >= todayKey && a.status !== "cancelled")
        .sort((a, b) =>
          a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
        )[0];

      if (next) {
        router.replace(`/portal/appointment/${next.id}`);
      } else {
        setEmpty(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (empty) {
    return (
      <div className="px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <CalendarOff className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">No upcoming appointment</h1>
          <p className="mt-2 text-sm text-slate-500">
            Call {CLINIC.name} on{" "}
            <a href={`tel:${CLINIC.phoneDial}`} className="font-medium text-teal-700">
              {CLINIC.phone}
            </a>{" "}
            to book.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-4 py-20 text-sm text-slate-400">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Opening your appointment…
    </div>
  );
}

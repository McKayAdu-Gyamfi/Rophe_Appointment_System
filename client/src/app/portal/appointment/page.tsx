"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2 } from "lucide-react";
import { createPortalLink, getAppointments } from "@/lib/api";
import { CLINIC } from "@/lib/clinic";
import { dateKey } from "@/lib/format";

/**
 * The staff-side preview of what a patient sees.
 *
 * A patient never comes through here — they arrive on a tokenised link sent by
 * WhatsApp or SMS. This picks the soonest upcoming appointment, mints a real
 * link for it and forwards, so the preview exercises the same tokenised page
 * the patient gets rather than a bare record id, which is precisely what #13
 * removed.
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

      if (!next) {
        setEmpty(true);
        return;
      }

      const { token } = await createPortalLink(next.id);
      if (!active) return;
      router.replace(`/portal/appointment/${token}`);
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

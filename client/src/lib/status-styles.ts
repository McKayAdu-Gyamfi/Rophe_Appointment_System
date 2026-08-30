import type { RecallState } from "./visits";
import type {
  AppointmentStatus,
  Channel,
  DeliveryStatus,
  MessageType,
  RequestStatus,
  RequestType,
} from "./types";

// ---------------------------------------------------------------------------
// Shared visual constants — single source of truth for status colors.
// Every screen imports from here so appointment/channel/request colors stay
// consistent across the app.
// ---------------------------------------------------------------------------

export type StatusStyle = {
  /** Tailwind classes for a solid badge (bg + text). */
  badge: string;
  /** Tailwind classes for a soft dot/indicator. */
  dot: string;
  /** Human-readable label. */
  label: string;
};

// ---------------------------------------------------------------------------
// Tone carries urgency; the label carries the exact state.
//
// The reference design runs on teal, neutral and coral — it has no violet,
// green, sky or indigo, and six arbitrary hues would read as noise beside it.
// So statuses are grouped by what they ask of the front desk:
//
//   amber  — needs an action now (confirm this, chase this)
//   teal   — settled and still ahead
//   slate  — settled and behind us
//   rose   — went wrong
//
// Within a group the dot shade and the word separate the states.
// ---------------------------------------------------------------------------

export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, StatusStyle> = {
  booked: {
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    label: "Booked",
  },
  confirmed: {
    badge: "bg-teal-100 text-teal-800",
    dot: "bg-teal-600",
    label: "Confirmed",
  },
  rescheduled: {
    badge: "bg-teal-100 text-teal-800",
    dot: "bg-teal-400",
    label: "Rescheduled",
  },
  attended: {
    badge: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    label: "Attended",
  },
  missed: {
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    label: "Missed",
  },
  cancelled: {
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-300",
    label: "Cancelled",
  },
};

// Three states, three meanings: in flight, arrived, failed.
export const DELIVERY_STATUS_STYLES: Record<DeliveryStatus, StatusStyle> = {
  sent: {
    badge: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    label: "Sent",
  },
  delivered: {
    badge: "bg-teal-100 text-teal-800",
    dot: "bg-teal-600",
    label: "Delivered",
  },
  failed: {
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    label: "Failed",
  },
};

export const REQUEST_TYPE_STYLES: Record<RequestType, StatusStyle> = {
  reschedule: {
    badge: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    label: "Reschedule",
  },
  cancellation: {
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    label: "Cancellation",
  },
};

export const REQUEST_STATUS_STYLES: Record<RequestStatus, StatusStyle> = {
  pending: {
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    label: "Pending",
  },
  confirmed: {
    badge: "bg-teal-100 text-teal-800",
    dot: "bg-teal-600",
    label: "Confirmed",
  },
  declined: {
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    label: "Declined",
  },
};

// Message types stay deliberately quiet (outline pills) so they don't compete
// with delivery status, which is what staff scan the log for. Only follow-up
// is toned, because it is the one type that implies work still to do.
export const MESSAGE_TYPE_STYLES: Record<MessageType, StatusStyle> = {
  confirmation: {
    badge: "border border-slate-200 text-slate-600",
    dot: "bg-teal-600",
    label: "Confirmation",
  },
  reminder: {
    badge: "border border-slate-200 text-slate-600",
    dot: "bg-teal-400",
    label: "Reminder",
  },
  "follow-up": {
    badge: "border border-amber-300 text-amber-800",
    dot: "bg-amber-500",
    label: "Follow-up",
  },
  // Recall shares follow-up's amber outline: both mean outstanding work on a
  // patient who is not currently on the calendar. The word separates them.
  recall: {
    badge: "border border-amber-300 text-amber-800",
    dot: "bg-amber-600",
    label: "Recall",
  },
  birthday: {
    badge: "border border-slate-200 text-slate-600",
    dot: "bg-slate-400",
    label: "Birthday",
  },
};

// Channels are a category, not a state, so the pill stays neutral and the dot
// does the distinguishing — the same treatment the reference gives its
// department legend.
export const CHANNEL_STYLES: Record<Channel, StatusStyle> = {
  whatsapp: {
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-teal-600",
    label: "WhatsApp",
  },
  sms: {
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-teal-300",
    label: "SMS",
  },
  email: {
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-teal-900",
    label: "Email",
  },
};

// ---------------------------------------------------------------------------
// Recall states (lib/visits.ts). Same four-tone logic as the appointment
// statuses: amber asks for action now, teal is settled and ahead, slate is
// settled and behind, rose is the one that went wrong.
// ---------------------------------------------------------------------------

export const RECALL_STATE_STYLES: Record<RecallState, StatusStyle> = {
  returning: {
    badge: "bg-teal-100 text-teal-800",
    dot: "bg-teal-600",
    label: "Booked in",
  },
  active: {
    badge: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    label: "Active",
  },
  // Not a patient state at all — a record to finish or remove. Kept visually
  // quiet so it never reads as urgency competing with a real lapsed patient.
  unbooked: {
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-300",
    label: "No appointment",
  },
  lapsing: {
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    label: "Lapsing",
  },
  lapsed: {
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    label: "Lapsed",
  },
};

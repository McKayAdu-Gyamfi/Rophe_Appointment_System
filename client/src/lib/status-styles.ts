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

export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, StatusStyle> = {
  booked: {
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    label: "Booked",
  },
  confirmed: {
    badge: "bg-teal-100 text-teal-800",
    dot: "bg-teal-500",
    label: "Confirmed",
  },
  attended: {
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    label: "Attended",
  },
  missed: {
    badge: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
    label: "Missed",
  },
  rescheduled: {
    badge: "bg-indigo-100 text-indigo-800",
    dot: "bg-indigo-500",
    label: "Rescheduled",
  },
  cancelled: {
    badge: "bg-slate-200 text-slate-600",
    dot: "bg-slate-400",
    label: "Cancelled",
  },
};

export const DELIVERY_STATUS_STYLES: Record<DeliveryStatus, StatusStyle> = {
  sent: {
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
    label: "Sent",
  },
  delivered: {
    badge: "bg-teal-100 text-teal-800",
    dot: "bg-teal-500",
    label: "Delivered",
  },
  failed: {
    badge: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
    label: "Failed",
  },
};

export const REQUEST_TYPE_STYLES: Record<RequestType, StatusStyle> = {
  reschedule: {
    badge: "bg-indigo-100 text-indigo-800",
    dot: "bg-indigo-500",
    label: "Reschedule",
  },
  cancellation: {
    badge: "bg-rose-100 text-rose-800",
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
    dot: "bg-teal-500",
    label: "Confirmed",
  },
  declined: {
    badge: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
    label: "Declined",
  },
};

// Message types are kept deliberately low-contrast (outline pills) so they
// don't compete with delivery status, which is what staff scan the log for.
export const MESSAGE_TYPE_STYLES: Record<MessageType, StatusStyle> = {
  confirmation: {
    badge: "border border-teal-200 text-teal-700",
    dot: "bg-teal-500",
    label: "Confirmation",
  },
  reminder: {
    badge: "border border-sky-200 text-sky-700",
    dot: "bg-sky-500",
    label: "Reminder",
  },
  "follow-up": {
    badge: "border border-amber-200 text-amber-700",
    dot: "bg-amber-500",
    label: "Follow-up",
  },
  birthday: {
    badge: "border border-violet-200 text-violet-700",
    dot: "bg-violet-500",
    label: "Birthday",
  },
};

export const CHANNEL_STYLES: Record<Channel, StatusStyle> = {
  whatsapp: {
    badge: "bg-green-100 text-green-800",
    dot: "bg-green-500",
    label: "WhatsApp",
  },
  sms: {
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
    label: "SMS",
  },
  email: {
    badge: "bg-violet-100 text-violet-800",
    dot: "bg-violet-500",
    label: "Email",
  },
};

import type { MessageType } from "@prisma/client";
import { CLINIC } from "./clinic";

export type TemplateVariableKey =
  | "first_name"
  | "full_name"
  | "date"
  | "time"
  | "doctor"
  | "clinic_name"
  | "clinic_phone"
  | "last_visit"
  | "portal_link";

export const TEMPLATE_VARIABLES: TemplateVariableKey[] = [
  "first_name",
  "full_name",
  "date",
  "time",
  "doctor",
  "clinic_name",
  "clinic_phone",
  "last_visit",
  "portal_link"
];

const VARIABLES_SET = new Set(TEMPLATE_VARIABLES);

export const VARIABLES_BY_TYPE: Record<MessageType, TemplateVariableKey[]> = {
  CONFIRMATION: ["first_name", "full_name", "date", "time", "doctor", "clinic_name", "clinic_phone", "portal_link"],
  REMINDER: ["first_name", "full_name", "date", "time", "doctor", "clinic_name", "clinic_phone", "portal_link"],
  FOLLOW_UP: ["first_name", "full_name", "date", "time", "doctor", "clinic_name", "clinic_phone"],
  RECALL: ["first_name", "full_name", "last_visit", "doctor", "clinic_name", "clinic_phone"],
  BIRTHDAY: ["first_name", "full_name", "clinic_name", "clinic_phone"],
};

const REQUIRED_BY_TYPE: Record<MessageType, TemplateVariableKey[]> = {
  CONFIRMATION: ["date", "time"],
  REMINDER: ["date", "time"],
  FOLLOW_UP: [],
  RECALL: [],
  BIRTHDAY: [],
};

const FIELD_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function fieldsUsed(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(FIELD_PATTERN)) found.add(match[1]);
  return [...found];
}

export interface TemplateIssue {
  level: "error" | "warning";
  message: string;
}

const MAX_BODY_LENGTH = 1000;

export function validateTemplate(
  type: MessageType,
  body: string,
  emailSubject: string,
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const trimmed = body.trim();

  if (!trimmed) {
    issues.push({ level: "error", message: "The message body cannot be empty." });
    return issues;
  }

  if (trimmed.length > MAX_BODY_LENGTH) {
    issues.push({
      level: "error",
      message: `Keep the message under ${MAX_BODY_LENGTH} characters — it is ${trimmed.length}.`,
    });
  }

  const allowed = new Set<string>(VARIABLES_BY_TYPE[type]);
  const used = new Set([...fieldsUsed(body), ...fieldsUsed(emailSubject)]);

  for (const key of used) {
    if (!VARIABLES_SET.has(key as TemplateVariableKey)) {
      issues.push({
        level: "error",
        message: `{{${key}}} is not a valid merge field.`,
      });
    } else if (!allowed.has(key)) {
      issues.push({
        level: "error",
        message: `{{${key}}} is not available on ${type} messages.`,
      });
    }
  }

  for (const key of REQUIRED_BY_TYPE[type]) {
    if (!used.has(key)) {
      issues.push({
        level: "error",
        message: `A ${type} message must include {{${key}}}.`,
      });
    }
  }

  if (/(^|[^{])\{\s*[a-z_]+\s*\}([^}]|$)/.test(body)) {
    issues.push({
      level: "warning",
      message: "Fields need double braces — write {{date}}, not {date}.",
    });
  }

  if (!used.has("first_name") && !used.has("full_name")) {
    issues.push({
      level: "warning",
      message: "No name in this message. Adding {{first_name}} makes it read as written for them.",
    });
  }

  if (!emailSubject.trim()) {
    issues.push({
      level: "warning",
      message: "No email subject — patients on email will see a blank subject line.",
    });
  }

  return issues;
}

export function hasBlockingIssue(issues: TemplateIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

// --- Rendering -------------------------------------------------------------
//
// Ported from renderTemplate() in client/src/lib/templates.ts, which is the
// specification. It matters that this lives server-side now: Message.body
// stores the text that actually went out, so the render has to happen where
// the row is written, not in a browser that may be sending something else.

/** "Monday 3 March" — unambiguous, and short enough for one SMS segment. */
function fmtMessageDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "9:00 AM" */
function fmtMessageTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export interface RenderContext {
  patientFullName: string;
  /** "YYYY-MM-DD" and "HH:mm" of the appointment, when there is one. */
  appointmentDate?: string;
  appointmentTime?: string;
  doctorFullName?: string;
  /** ISO date of the last completed visit. Only recall messages use it. */
  lastVisitDate?: string;
  /** The patient's own link to this appointment. Confirmations and reminders. */
  portalLink?: string;
}

/**
 * Every field needs a fallback. A message reading "Hello ," is worse than one
 * reading "Hello there," — and a recall goes to patients who have never
 * attended, so {{last_visit}} has to read naturally with nothing behind it.
 */
const RESOLVERS: Record<
  TemplateVariableKey,
  { resolve: (ctx: RenderContext) => string | undefined; fallback: string }
> = {
  first_name: {
    resolve: (ctx) => ctx.patientFullName.trim().split(" ")[0],
    fallback: "there",
  },
  full_name: { resolve: (ctx) => ctx.patientFullName, fallback: "there" },
  date: {
    resolve: (ctx) => (ctx.appointmentDate ? fmtMessageDate(ctx.appointmentDate) : undefined),
    fallback: "your appointment date",
  },
  time: {
    resolve: (ctx) => (ctx.appointmentTime ? fmtMessageTime(ctx.appointmentTime) : undefined),
    fallback: "the scheduled time",
  },
  doctor: { resolve: (ctx) => ctx.doctorFullName, fallback: "your doctor" },
  last_visit: {
    resolve: (ctx) => (ctx.lastVisitDate ? fmtMessageDate(ctx.lastVisitDate) : undefined),
    fallback: "a while",
  },
  portal_link: {
    resolve: (ctx) => ctx.portalLink,
    // A message whose link failed to render must still tell the patient how to
    // reach the clinic, rather than trailing off mid-sentence.
    fallback: `call ${CLINIC.phone}`,
  },
  clinic_name: { resolve: () => CLINIC.name, fallback: CLINIC.name },
  clinic_phone: { resolve: () => CLINIC.phone, fallback: CLINIC.phone },
};

/** Fill a template body for one patient. Unknown fields render as [field]. */
export function renderTemplate(body: string, ctx: RenderContext): string {
  return body.replace(FIELD_PATTERN, (_full, key: string) => {
    const variable = RESOLVERS[key as TemplateVariableKey];
    if (!variable) return `[${key}]`;
    const value = variable.resolve(ctx);
    return value && value.trim() ? value : variable.fallback;
  });
}

import type { Appointment, Doctor, MessageType, Patient } from "./types";
import { CLINIC } from "./clinic";
import { fmtTime } from "./format";

// ---------------------------------------------------------------------------
// Message templates — the wording the clinic controls.
//
// Every automated message is one template per type, written by the clinic and
// filled in per patient at send time. The clinic edits the words; the system
// supplies the details. That split is the whole point: staff never retype a
// date, and a wording change applies to every future send without a deploy.
//
// Merge fields are written {{snake_case}} and validated against the registry
// below, so a typo fails on save rather than reaching a patient as
// "{{frist_name}}". Each message type declares which fields it may use — a
// birthday message has no appointment attached, so offering it {{date}} would
// only produce a message that renders half-blank.
// ---------------------------------------------------------------------------

export type TemplateVariableKey =
  | "first_name"
  | "full_name"
  | "date"
  | "time"
  | "doctor"
  | "clinic_name"
  | "clinic_phone"
  | "last_visit";

/** What a variable needs in order to resolve. */
export interface RenderContext {
  patient: Patient;
  appointment?: Appointment;
  doctor?: Doctor;
  /**
   * ISO date of the patient's last completed visit. Only recall messages use
   * it, and only some patients have one — a patient who booked once and never
   * attended is on the recall list precisely because this is empty.
   */
  lastVisitDate?: string;
}

export interface TemplateVariable {
  key: TemplateVariableKey;
  /** Shown on the insert chip. */
  label: string;
  /** One line of help under the chip list. */
  hint: string;
  /**
   * Value for this patient, or undefined when the record has nothing to offer
   * (a patient with no surname, an appointment with no doctor assigned).
   */
  resolve: (ctx: RenderContext) => string | undefined;
  /**
   * Stand-in when resolve() comes back empty. Every variable needs one —
   * a message that reads "Hello ," is worse than one that reads "Hello there,".
   */
  fallback: string;
}

/** "Monday 3 March" — long enough to be unambiguous, short enough for SMS. */
function fmtMessageDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    key: "first_name",
    label: "First name",
    hint: "The patient's first name",
    resolve: (ctx) => ctx.patient.fullName.trim().split(" ")[0],
    fallback: "there",
  },
  {
    key: "full_name",
    label: "Full name",
    hint: "The patient's name as recorded",
    resolve: (ctx) => ctx.patient.fullName,
    fallback: "there",
  },
  {
    key: "date",
    label: "Date",
    hint: "Appointment date, e.g. Monday 3 March",
    resolve: (ctx) => (ctx.appointment ? fmtMessageDate(ctx.appointment.date) : undefined),
    fallback: "your appointment date",
  },
  {
    key: "time",
    label: "Time",
    hint: "Appointment time, e.g. 9:00 AM",
    resolve: (ctx) => (ctx.appointment ? fmtTime(ctx.appointment.time) : undefined),
    fallback: "the scheduled time",
  },
  {
    key: "doctor",
    label: "Doctor",
    hint: "The doctor they are booked with",
    resolve: (ctx) => ctx.doctor?.fullName,
    fallback: "your doctor",
  },
  {
    key: "last_visit",
    label: "Last visit",
    hint: "When the patient was last seen, e.g. Monday 3 March",
    resolve: (ctx) => (ctx.lastVisitDate ? fmtMessageDate(ctx.lastVisitDate) : undefined),
    // A patient who has never attended still gets a recall message, so this
    // has to read naturally with nothing behind it: "we have not seen you in
    // a while" is true either way.
    fallback: "a while",
  },
  {
    key: "clinic_name",
    label: "Clinic name",
    hint: CLINIC.name,
    resolve: () => CLINIC.name,
    fallback: CLINIC.name,
  },
  {
    key: "clinic_phone",
    label: "Clinic phone",
    hint: CLINIC.phone,
    resolve: () => CLINIC.phone,
    fallback: CLINIC.phone,
  },
];

const VARIABLES_BY_KEY = new Map(TEMPLATE_VARIABLES.map((v) => [v.key as string, v]));

/**
 * Which fields each type may use.
 *
 * Birthday messages are the reason this exists: they fire off the patient's
 * date of birth, not off an appointment, so there is no date, time or doctor
 * to fill in. Deliberately absent everywhere: the appointment *type*. A
 * reminder reading "your oncology follow-up" on a shared or lost phone is a
 * confidentiality problem, so the field is not offered at all.
 */
export const VARIABLES_BY_TYPE: Record<MessageType, TemplateVariableKey[]> = {
  confirmation: ["first_name", "full_name", "date", "time", "doctor", "clinic_name", "clinic_phone"],
  reminder: ["first_name", "full_name", "date", "time", "doctor", "clinic_name", "clinic_phone"],
  "follow-up": ["first_name", "full_name", "date", "time", "doctor", "clinic_name", "clinic_phone"],
  // A recall is not about one appointment — it is about a silence — so it gets
  // {{last_visit}} and no {{date}}/{{time}}. Offering those would only produce
  // "your appointment on your appointment date".
  recall: ["first_name", "full_name", "last_visit", "doctor", "clinic_name", "clinic_phone"],
  birthday: ["first_name", "full_name", "clinic_name", "clinic_phone"],
};

/**
 * Fields a type cannot do without. A reminder that omits the date and time is
 * not a reminder, so saving one is blocked rather than warned about.
 */
const REQUIRED_BY_TYPE: Record<MessageType, TemplateVariableKey[]> = {
  confirmation: ["date", "time"],
  reminder: ["date", "time"],
  "follow-up": [],
  recall: [],
  birthday: [],
};

export function variablesFor(type: MessageType): TemplateVariable[] {
  const allowed = new Set<string>(VARIABLES_BY_TYPE[type]);
  return TEMPLATE_VARIABLES.filter((v) => allowed.has(v.key));
}

// --- Rendering -------------------------------------------------------------

const FIELD_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Every {{field}} written in a body, in order, deduplicated. */
export function fieldsUsed(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(FIELD_PATTERN)) found.add(match[1]);
  return [...found];
}

/**
 * Fill a template in for one patient. Unknown fields are left visible as
 * [field] rather than silently deleted — if a broken template ever does reach
 * the preview, staff should see exactly where it broke.
 */
export function renderTemplate(body: string, ctx: RenderContext): string {
  return body.replace(FIELD_PATTERN, (_full, key: string) => {
    const variable = VARIABLES_BY_KEY.get(key);
    if (!variable) return `[${key}]`;
    const value = variable.resolve(ctx);
    return value && value.trim() ? value : variable.fallback;
  });
}

// --- SMS segments ----------------------------------------------------------
//
// SMS is billed per segment, and the segment size depends on the alphabet:
// 160 characters of GSM-7, but only 70 the moment a single character falls
// outside it — one emoji in a friendly birthday message triples the bill for
// every patient, every year. The counter exists so that cost is visible while
// the wording is being written, not on the invoice.

const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/** Characters that are GSM-7 but cost two units each. */
const GSM7_EXTENDED = "^{}\\[~]|€";

export type SmsEncoding = "GSM-7" | "Unicode";

export interface SmsCost {
  encoding: SmsEncoding;
  /** Billable units, not string length — extended GSM-7 characters count twice. */
  units: number;
  segments: number;
  /** Units left in the current segment. */
  remaining: number;
}

export function smsCost(text: string): SmsCost {
  let gsmUnits = 0;
  let utf16Units = 0;
  let unicode = false;

  for (const char of text) {
    // UCS-2 bills per UTF-16 code unit, so anything outside the BMP — most
    // emoji — costs two on its own.
    utf16Units += char.length;
    if (GSM7.includes(char)) gsmUnits += 1;
    else if (GSM7_EXTENDED.includes(char)) gsmUnits += 2;
    else unicode = true;
  }

  // One stray character forces the whole message to UCS-2, where the GSM-7
  // double-billing of ^{}[]~|€ no longer applies.
  const units = unicode ? utf16Units : gsmUnits;

  // Concatenated messages spend part of each segment on the joining header.
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const segments = units <= single ? 1 : Math.ceil(units / multi);
  const capacity = segments === 1 ? single : multi * segments;

  return {
    encoding: unicode ? "Unicode" : "GSM-7",
    units,
    segments: Math.max(segments, 1),
    remaining: capacity - units,
  };
}

// --- Validation ------------------------------------------------------------

export interface TemplateIssue {
  /** Errors block saving; warnings are advice the clinic can overrule. */
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
    if (!VARIABLES_BY_KEY.has(key)) {
      issues.push({
        level: "error",
        message: `{{${key}}} is not a field we can fill in. Use the buttons above to insert one.`,
      });
    } else if (!allowed.has(key)) {
      issues.push({
        level: "error",
        message: `{{${key}}} is not available on ${type} messages — there is no appointment attached to one.`,
      });
    }
  }

  for (const key of REQUIRED_BY_TYPE[type]) {
    if (!used.has(key)) {
      issues.push({
        level: "error",
        message: `A ${type} message must include {{${key}}}, otherwise the patient is not told ${
          key === "date" ? "which day" : "what time"
        }.`,
      });
    }
  }

  // Single braces are the likeliest typo — the old seed wording used {date},
  // which would go out to a patient verbatim.
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

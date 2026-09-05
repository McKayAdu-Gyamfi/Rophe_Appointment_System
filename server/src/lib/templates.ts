import type { MessageType } from "@prisma/client";

export type TemplateVariableKey =
  | "first_name"
  | "full_name"
  | "date"
  | "time"
  | "doctor"
  | "clinic_name"
  | "clinic_phone"
  | "last_visit";

export const TEMPLATE_VARIABLES: TemplateVariableKey[] = [
  "first_name",
  "full_name",
  "date",
  "time",
  "doctor",
  "clinic_name",
  "clinic_phone",
  "last_visit"
];

const VARIABLES_SET = new Set(TEMPLATE_VARIABLES);

export const VARIABLES_BY_TYPE: Record<MessageType, TemplateVariableKey[]> = {
  CONFIRMATION: ["first_name", "full_name", "date", "time", "doctor", "clinic_name", "clinic_phone"],
  REMINDER: ["first_name", "full_name", "date", "time", "doctor", "clinic_name", "clinic_phone"],
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

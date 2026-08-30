// Data model shapes — mirror the future Prisma schema (camelCase).
// Source of truth for both mock data and the real backend that replaces it.

export type Channel = "whatsapp" | "sms" | "email";

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "attended"
  | "missed"
  | "rescheduled"
  // Added for the calendar's cancel action — the PRD's original five have no
  // state for "called off in advance", and reusing "missed" would corrupt the
  // attendance-rate stat. Flagged for client sign-off (PRD Section 8).
  | "cancelled";

export type MessageType =
  | "confirmation"
  | "reminder"
  | "follow-up"
  // Added for the 6-month recall sweep: outreach to a patient who has gone
  // quiet, which is not tied to any one appointment. Kept distinct from
  // "follow-up" (which chases a specific missed visit) so the clinic can audit
  // and word the two separately.
  | "recall"
  | "birthday";

export type DeliveryStatus = "sent" | "delivered" | "failed";

export type RequestType = "reschedule" | "cancellation";

export type RequestStatus = "pending" | "confirmed" | "declined";

export type Role = "front-desk" | "doctor" | "patient";

export interface Patient {
  id: string;
  fullName: string;
  phone: string; // required
  whatsappNumber?: string;
  email?: string; // optional
  dateOfBirth: string; // ISO date
  preferredChannel: Channel;
  registeredDate: string; // ISO date
  notes?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentType: string;
  date: string; // ISO date
  time: string; // "HH:mm"
  durationMinutes: number;
  status: AppointmentStatus;
  createdAt: string; // ISO datetime
  notes?: string;
}

export interface DoctorAvailability {
  doctorId: string;
  dayOfWeek: number; // 0 (Sun) – 6 (Sat)
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  isAvailable: boolean;
}

export interface Message {
  id: string;
  patientId: string;
  appointmentId?: string;
  channel: Channel;
  type: MessageType;
  sentAt: string; // ISO datetime
  deliveryStatus: DeliveryStatus;
  contentPreview: string;
}

/**
 * One saved revision of a template. Kept so the clinic can see who changed the
 * wording and when, and roll back a change they did not mean to make.
 */
export interface TemplateRevision {
  version: number;
  body: string;
  emailSubject: string;
  savedAt: string; // ISO datetime
  savedBy: string; // staff full name
}

/**
 * The wording the clinic controls — one per message type, shared by every
 * channel. Email adds a subject line; SMS and WhatsApp use the body alone.
 * Merge fields ({{first_name}}, {{date}}, …) are filled in per patient at send
 * time; see lib/templates.ts for the registry and the render function.
 */
export interface MessageTemplate {
  id: string;
  type: MessageType;
  /** What this message is for, in the clinic's own words. */
  description: string;
  body: string;
  emailSubject: string;
  version: number;
  updatedAt: string; // ISO datetime
  updatedBy: string; // staff full name
  /** Previous versions, newest first. */
  history: TemplateRevision[];
}

export interface PatientRequest {
  id: string;
  appointmentId: string;
  patientId: string;
  requestType: RequestType;
  requestedDate?: string; // ISO date
  requestedTime?: string; // "HH:mm"
  reason?: string;
  status: RequestStatus;
}

export interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
}

/** Staff who sign in. Patients never have an account — they use a link. */
export type StaffRole = Exclude<Role, "patient">;

/**
 * Where an account is in its life.
 *
 * `invited` exists because front desk creates the account but never chooses
 * the password — they set up the person's email and role, and the new joiner
 * sets their own credentials from the link. Between those two moments the
 * account is real enough to appear in the staff list, and useless enough that
 * it cannot sign in.
 */
export type StaffStatus = "invited" | "active";

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  /**
   * Prototype only — plaintext credentials, never do this for real.
   * Undefined while the account is `invited`: front desk never sets, sees or
   * transports a password, which is the whole point of the invite flow.
   */
  password?: string;
  role: StaffRole;
  staffId: string;
  jobTitle: string;
  /** Set on doctor accounts, linking to the Doctor record. */
  doctorId?: string;
  status: StaffStatus;
  /**
   * Single-use secret in the invite link. Prototype stand-in for a signed,
   * expiring token; cleared the moment the account is activated so a link
   * cannot be replayed. Never leaves the data layer in a session.
   */
  inviteToken?: string;
  invitedAt?: string; // ISO datetime
  /** Full name of the staff member who sent the invitation. */
  invitedBy?: string;
  activatedAt?: string; // ISO datetime
}

/**
 * What the app keeps in session. Neither secret — the password nor the invite
 * token — ever leaves the data layer.
 */
export type StaffSession = Omit<StaffUser, "password" | "inviteToken">;

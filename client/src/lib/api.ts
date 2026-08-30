import type {
  Patient,
  Appointment,
  AppointmentStatus,
  Channel,
  DeliveryStatus,
  Message,
  MessageTemplate,
  MessageType,
  PatientRequest,
  DoctorAvailability,
  Doctor,
  StaffRole,
  StaffSession,
  StaffUser,
} from "./types";
import { buildVisitSummaries, type PatientVisitSummary } from "./visits";
import {
  patients,
  appointments,
  messages,
  messageTemplates,
  patientRequests,
  doctorAvailability,
  doctors,
  staffUsers,
} from "./mockData";

// ---------------------------------------------------------------------------
// Mock API client.
//
// Every function mirrors a real REST endpoint (see PRD Section 0 endpoint
// table). Internally these read/mutate in-memory mock data. When the real
// backend is ready, replace each body with a fetch() call — components that
// import from this file stay untouched.
// ---------------------------------------------------------------------------

// Simulate async so callers can treat these as real network calls.
const delay = <T>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// --- Patients -------------------------------------------------------------

export interface CreatePatientInput {
  fullName: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  dateOfBirth: string;
  preferredChannel: Patient["preferredChannel"];
  notes?: string;
}

export async function getPatients(): Promise<Patient[]> {
  return delay([...patients]);
}

export async function getPatient(id: string): Promise<Patient | undefined> {
  return delay(patients.find((p) => p.id === id));
}

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const patient: Patient = {
    id: uid("p"),
    fullName: input.fullName,
    phone: input.phone,
    whatsappNumber: input.whatsappNumber,
    email: input.email,
    dateOfBirth: input.dateOfBirth,
    preferredChannel: input.preferredChannel,
    registeredDate: new Date().toISOString().slice(0, 10),
    notes: input.notes,
  };
  patients.push(patient);
  return delay(patient);
}

export type UpdatePatientInput = Partial<CreatePatientInput>;

export async function updatePatient(
  id: string,
  input: UpdatePatientInput,
): Promise<Patient | undefined> {
  const patient = patients.find((p) => p.id === id);
  if (patient) {
    Object.assign(patient, input);
  }
  return delay(patient);
}

// --- Appointments ---------------------------------------------------------

export interface BookAppointmentInput {
  patientId: string;
  doctorId: string;
  appointmentType: string;
  date: string;
  time: string;
  durationMinutes: number;
  notes?: string;
}

export async function getAppointments(): Promise<Appointment[]> {
  return delay([...appointments]);
}

export async function getAppointment(id: string): Promise<Appointment | undefined> {
  return delay(appointments.find((a) => a.id === id));
}

export async function bookAppointment(input: BookAppointmentInput): Promise<Appointment> {
  const appointment: Appointment = {
    id: uid("a"),
    patientId: input.patientId,
    doctorId: input.doctorId,
    appointmentType: input.appointmentType,
    date: input.date,
    time: input.time,
    durationMinutes: input.durationMinutes,
    status: "booked",
    createdAt: new Date().toISOString(),
    notes: input.notes,
  };
  appointments.push(appointment);
  return delay(appointment);
}

export interface UpdateAppointmentInput {
  appointmentType?: string;
  date?: string;
  time?: string;
  durationMinutes?: number;
  notes?: string;
  status?: AppointmentStatus;
}

export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput,
): Promise<Appointment | undefined> {
  const appt = appointments.find((a) => a.id === id);
  if (appt) {
    Object.assign(appt, input);
  }
  return delay(appt);
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<Appointment | undefined> {
  const appt = appointments.find((a) => a.id === id);
  if (appt) {
    appt.status = status;
  }
  return delay(appt);
}

// --- Messages (simulated) -------------------------------------------------

export async function getMessages(): Promise<Message[]> {
  return delay([...messages]);
}

// --- Simulated delivery receipts ------------------------------------------
//
// A real provider (WhatsApp Business API, SMS gateway, mail server) accepts a
// message immediately — that's "sent" — then calls back seconds later to say it
// reached the handset ("delivered") or didn't ("failed"). Nothing here talks to
// a network, so the callback is faked with a timer. In Phase 3 this whole block
// disappears and the webhook handler updates the row instead.

/** Share of simulated messages that fail delivery. Set to 0 for a clean demo. */
export const SIMULATED_FAILURE_RATE = 0.12;

const messageListeners = new Set<() => void>();

/** Subscribe to message-log changes; returns an unsubscribe function. */
export function onMessagesChanged(listener: () => void): () => void {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

function notifyMessagesChanged(): void {
  messageListeners.forEach((listener) => listener());
}

export async function updateMessageDeliveryStatus(
  id: string,
  deliveryStatus: DeliveryStatus,
): Promise<Message | undefined> {
  const message = messages.find((m) => m.id === id);
  if (message) {
    message.deliveryStatus = deliveryStatus;
    notifyMessagesChanged();
  }
  return delay(message);
}

/** Stands in for the provider's delivery callback. */
function scheduleDeliveryReceipt(id: string): void {
  const afterMs = 1500 + Math.random() * 1500;
  setTimeout(() => {
    const message = messages.find((m) => m.id === id);
    // Leave it alone if something already resolved this message.
    if (!message || message.deliveryStatus !== "sent") return;
    message.deliveryStatus = Math.random() < SIMULATED_FAILURE_RATE ? "failed" : "delivered";
    notifyMessagesChanged();
  }, afterMs);
}

export interface SendMessageInput {
  patientId: string;
  appointmentId?: string;
  channel: Channel;
  type: MessageType;
  contentPreview: string;
}

/**
 * Simulated send. Nothing leaves the browser — this only appends to the mock
 * message log so staff can see what *would* have gone out. In Phase 3 this
 * becomes the call that hands off to the WhatsApp/SMS/email provider.
 */
export async function sendMessage(input: SendMessageInput): Promise<Message> {
  const message: Message = {
    id: uid("m"),
    patientId: input.patientId,
    appointmentId: input.appointmentId,
    channel: input.channel,
    type: input.type,
    sentAt: new Date().toISOString(),
    deliveryStatus: "sent",
    contentPreview: input.contentPreview,
  };
  messages.unshift(message);
  notifyMessagesChanged();
  scheduleDeliveryReceipt(message.id);
  return delay(message);
}

// --- Message templates ----------------------------------------------------
//
// The clinic owns the wording; the system owns the merge fields. Editing a
// template changes every *future* send and never rewrites the log — sent
// messages keep the text that actually went out (see sendMessage, which stores
// the rendered body rather than a pointer to the template).

const templateListeners = new Set<() => void>();

/** Subscribe to template changes; returns an unsubscribe function. */
export function onTemplatesChanged(listener: () => void): () => void {
  templateListeners.add(listener);
  return () => {
    templateListeners.delete(listener);
  };
}

function notifyTemplatesChanged(): void {
  templateListeners.forEach((listener) => listener());
}

export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  return delay(messageTemplates.map((t) => ({ ...t, history: [...t.history] })));
}

export interface UpdateTemplateInput {
  body: string;
  emailSubject: string;
  /** Staff member making the change — shown in the version history. */
  savedBy: string;
}

/**
 * Save new wording. The outgoing version is pushed onto the history first, so
 * the clinic can always see what a message used to say and who changed it.
 */
export async function updateMessageTemplate(
  type: MessageType,
  input: UpdateTemplateInput,
): Promise<MessageTemplate | undefined> {
  const template = messageTemplates.find((t) => t.type === type);
  if (!template) return delay(undefined);

  const unchanged =
    template.body === input.body && template.emailSubject === input.emailSubject;
  if (unchanged) return delay({ ...template, history: [...template.history] });

  template.history = [
    {
      version: template.version,
      body: template.body,
      emailSubject: template.emailSubject,
      savedAt: template.updatedAt,
      savedBy: template.updatedBy,
    },
    ...template.history,
  ];
  template.body = input.body;
  template.emailSubject = input.emailSubject;
  template.version += 1;
  template.updatedAt = new Date().toISOString();
  template.updatedBy = input.savedBy;

  notifyTemplatesChanged();
  return delay({ ...template, history: [...template.history] });
}

/** Restore the wording from an earlier version, as a new version on top. */
export async function revertMessageTemplate(
  type: MessageType,
  version: number,
  savedBy: string,
): Promise<MessageTemplate | undefined> {
  const template = messageTemplates.find((t) => t.type === type);
  const revision = template?.history.find((h) => h.version === version);
  if (!template || !revision) return delay(undefined);

  return updateMessageTemplate(type, {
    body: revision.body,
    emailSubject: revision.emailSubject,
    savedBy,
  });
}

// --- Pending requests -----------------------------------------------------

export type RequestDecision = "confirmed" | "declined";

export async function getPendingRequests(): Promise<PatientRequest[]> {
  return delay([...patientRequests]);
}

export interface CreatePatientRequestInput {
  appointmentId: string;
  patientId: string;
  requestType: PatientRequest["requestType"];
  requestedDate?: string;
  requestedTime?: string;
  reason?: string;
}

/**
 * Submitted from the patient-facing page. Deliberately does NOT touch the
 * appointment — it only queues a request for staff, who stay in control of the
 * calendar (PRD Section 3.3).
 */
export async function createPatientRequest(
  input: CreatePatientRequestInput,
): Promise<PatientRequest> {
  const request: PatientRequest = {
    id: uid("r"),
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    requestType: input.requestType,
    requestedDate: input.requestedDate,
    requestedTime: input.requestedTime,
    reason: input.reason,
    status: "pending",
  };
  patientRequests.unshift(request);
  return delay(request);
}

/**
 * Confirming a request cascades to the linked appointment: a reschedule moves
 * the date/time, a cancellation calls it off. Declining only closes the
 * request. The cascade lives here rather than in the UI because the real
 * PATCH /api/requests/:id would apply both changes in one transaction.
 */
export async function respondToRequest(
  id: string,
  decision: RequestDecision,
): Promise<PatientRequest | undefined> {
  const req = patientRequests.find((r) => r.id === id);
  if (!req) return delay(undefined);

  req.status = decision;

  if (decision === "confirmed") {
    const appt = appointments.find((a) => a.id === req.appointmentId);
    if (appt) {
      if (req.requestType === "cancellation") {
        appt.status = "cancelled";
      } else {
        if (req.requestedDate) appt.date = req.requestedDate;
        if (req.requestedTime) appt.time = req.requestedTime;
        appt.status = "rescheduled";
      }
    }
  }

  return delay(req);
}

// --- Doctor availability --------------------------------------------------

export async function getDoctorAvailability(doctorId = "doc-1"): Promise<DoctorAvailability[]> {
  return delay(doctorAvailability.filter((d) => d.doctorId === doctorId));
}

/**
 * Replace one day's availability windows wholesale. The grid computes the new
 * merged windows from its open-slot set and sends them here, which keeps the
 * stored shape minimal (adjacent slots collapse into one row) and makes the
 * write idempotent — the real PUT /api/doctors/:id/availability/:day would
 * behave the same way.
 */
export async function setDoctorDayAvailability(
  doctorId: string,
  dayOfWeek: number,
  windows: DoctorAvailability[],
): Promise<DoctorAvailability[]> {
  for (let i = doctorAvailability.length - 1; i >= 0; i -= 1) {
    const row = doctorAvailability[i];
    if (row.doctorId === doctorId && row.dayOfWeek === dayOfWeek) {
      doctorAvailability.splice(i, 1);
    }
  }
  doctorAvailability.push(...windows);
  return delay(windows);
}

// --- Auth (prototype) ------------------------------------------------------
//
// Credential checking happens here, in the data layer, so the swap to a real
// POST /api/auth/login changes this file and nothing else. It is NOT security:
// the check runs in the browser against seeded data. Phase 3 replaces it with a
// server-issued session cookie.

export interface SignInInput {
  email: string;
  password: string;
}

export type SignInResult =
  | { ok: true; session: StaffSession }
  | { ok: false; error: string };

export async function signIn({ email, password }: SignInInput): Promise<SignInResult> {
  const user = staffUsers.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
  );

  // Same message either way — never reveal which half was wrong.
  if (!user || !user.password || user.password !== password) {
    // One exception to that rule: an account that exists but was never set up
    // has no password to be wrong, and "wrong credentials" would send the new
    // joiner hunting for a password nobody ever gave them. Naming the real
    // problem here costs nothing — they were sent the invitation.
    if (user && user.status === "invited") {
      return delay({
        ok: false,
        error: "This account hasn't been set up yet. Open the invitation link to choose a password.",
      });
    }
    return delay({ ok: false, error: "Those credentials don't match an account." });
  }

  return delay({ ok: true, session: toSession(user) });
}

export async function getStaffUsers(): Promise<StaffSession[]> {
  return delay(staffUsers.map(toSession));
}

// --- Staff invitations -----------------------------------------------------
//
// Front desk creates the account; the new joiner creates the credentials.
// That split is the requirement, and it is also the only version worth
// building: any flow where an existing staff member chooses a colleague's
// password ends with that password being read out over a desk.
//
// So `inviteStaffUser` writes a user with no password and a single-use token,
// and `acceptStaffInvitation` is the only thing that can set one. In Phase 3
// the token becomes a signed, expiring value and the link goes out by email;
// nothing about the two endpoints changes.

/** Strip both secrets. The session shape must never carry either. */
function toSession(user: StaffUser): StaffSession {
  const { password: _password, inviteToken: _token, ...session } = user;
  return session;
}

export interface InviteStaffInput {
  fullName: string;
  email: string;
  role: StaffRole;
  jobTitle: string;
  /** Doctors only — recorded on the new Doctor record. */
  specialty?: string;
  /** Who is sending it; shown to the joiner so the link is not anonymous. */
  invitedBy: string;
}

export type InviteStaffResult =
  | { ok: true; user: StaffSession; inviteToken: string }
  | { ok: false; error: string };

function nextStaffId(): string {
  const numbers = staffUsers
    .map((u) => Number(u.staffId.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n));
  return `RSC-${Math.max(1000, ...numbers) + 1}`;
}

/**
 * Create an account in the `invited` state and return its link token.
 *
 * A doctor invitation also creates the Doctor record the schedule joins
 * against, because a doctor account with no Doctor row would sign in to a
 * schedule that cannot exist.
 */
export async function inviteStaffUser(input: InviteStaffInput): Promise<InviteStaffResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (!fullName) return delay({ ok: false, error: "Enter the person's full name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return delay({ ok: false, error: "Enter a valid email address." });
  }
  if (staffUsers.some((u) => u.email.toLowerCase() === email)) {
    return delay({
      ok: false,
      error: "Someone already has an account with that email address.",
    });
  }

  let doctorId: string | undefined;
  if (input.role === "doctor") {
    doctorId = uid("doc");
    doctors.push({
      id: doctorId,
      fullName,
      specialty: input.specialty?.trim() || input.jobTitle.trim() || "Specialist",
    });
  }

  const user: StaffUser = {
    id: uid("u"),
    fullName,
    email,
    role: input.role,
    staffId: nextStaffId(),
    jobTitle: input.jobTitle.trim() || (input.role === "doctor" ? "Doctor" : "Front-desk Staff"),
    doctorId,
    status: "invited",
    inviteToken: uid("inv"),
    invitedAt: new Date().toISOString(),
    invitedBy: input.invitedBy,
  };
  staffUsers.push(user);

  return delay({ ok: true, user: toSession(user), inviteToken: user.inviteToken! });
}

/** Look up a pending invitation by its link token. */
export async function getStaffInvitation(token: string): Promise<StaffSession | undefined> {
  const user = staffUsers.find((u) => u.inviteToken === token && u.status === "invited");
  return delay(user ? toSession(user) : undefined);
}

export type AcceptInvitationResult =
  | { ok: true; session: StaffSession }
  | { ok: false; error: string };

/** Minimum the prototype enforces. Phase 3 should also check against a breach list. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * The only path that can set a password. Consumes the token, so the link stops
 * working the moment it succeeds.
 */
export async function acceptStaffInvitation(
  token: string,
  password: string,
): Promise<AcceptInvitationResult> {
  const user = staffUsers.find((u) => u.inviteToken === token && u.status === "invited");
  if (!user) {
    return delay({
      ok: false,
      error: "This invitation link is no longer valid. Ask the front desk to send a new one.",
    });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return delay({
      ok: false,
      error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }
  if (password.toLowerCase() === user.email.toLowerCase()) {
    return delay({ ok: false, error: "Your password cannot be your email address." });
  }

  user.password = password;
  user.status = "active";
  user.activatedAt = new Date().toISOString();
  delete user.inviteToken;

  return delay({ ok: true, session: toSession(user) });
}

/**
 * Withdraw an invitation that was never accepted — a typo in the address, or
 * someone who did not join after all. Only ever removes an `invited` account,
 * so this can never delete a colleague who is using the system.
 */
export async function revokeStaffInvitation(id: string): Promise<{ ok: boolean; error?: string }> {
  const index = staffUsers.findIndex((u) => u.id === id);
  const user = staffUsers[index];
  if (!user || user.status !== "invited") {
    return delay({ ok: false, error: "That invitation has already been accepted." });
  }

  // Take the placeholder Doctor record with it, or the booking form would
  // offer a doctor who never joined.
  if (user.doctorId) {
    const d = doctors.findIndex((doc) => doc.id === user.doctorId);
    if (d !== -1) doctors.splice(d, 1);
  }
  staffUsers.splice(index, 1);
  return delay({ ok: true });
}

/** Re-issue the link, invalidating the old one. Used when a link goes astray. */
export async function resendStaffInvitation(
  id: string,
): Promise<{ ok: true; inviteToken: string } | { ok: false; error: string }> {
  const user = staffUsers.find((u) => u.id === id);
  if (!user || user.status !== "invited") {
    return delay({ ok: false, error: "That invitation has already been accepted." });
  }
  user.inviteToken = uid("inv");
  user.invitedAt = new Date().toISOString();
  return delay({ ok: true, inviteToken: user.inviteToken });
}

// --- Patient recall -------------------------------------------------------
//
// The six-month sweep (PRD Section 3.1 #8). Deliberately computed rather than
// stored: "lapsed" is not a state a patient is put into, it is what falls out
// of the diary the moment nobody books them in. Storing a flag would mean
// something has to remember to clear it when they finally come back.
//
// The real GET /api/recalls does the same join server-side, because the
// alternative is shipping the whole appointment history to the browser to
// work it out.

export interface RecallEntry {
  patient: Patient;
  summary: PatientVisitSummary;
}

/**
 * Every patient with a visit summary attached. Screens filter this down — the
 * recall page to the lapsed ones, the patients list to show last-seen against
 * each row — so one call serves both rather than each inventing its own join.
 */
export async function getPatientRecalls(): Promise<RecallEntry[]> {
  const summaries = buildVisitSummaries(patients, appointments, messages);
  const entries = patients
    .map((patient) => ({ patient, summary: summaries.get(patient.id)! }))
    // Longest silence first — that is the order front desk works the list in.
    .sort((a, b) => b.summary.monthsQuiet - a.summary.monthsQuiet);
  return delay(entries);
}

/** One patient's visit summary — used by the patient detail page. */
export async function getPatientVisitSummary(
  patientId: string,
): Promise<PatientVisitSummary | undefined> {
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) return delay(undefined);
  return delay(buildVisitSummaries([patient], appointments, messages).get(patientId));
}

// --- Doctors --------------------------------------------------------------

export async function getDoctors(): Promise<Doctor[]> {
  return delay([...doctors]);
}

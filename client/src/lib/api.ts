import type {
  Patient,
  Appointment,
  AppointmentStatus,
  Channel,
  DeliveryStatus,
  Message,
  MessageType,
  PatientRequest,
  DoctorAvailability,
  Doctor,
  StaffSession,
} from "./types";
import {
  patients,
  appointments,
  messages,
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
  if (!user || user.password !== password) {
    return delay({ ok: false, error: "Those credentials don't match an account." });
  }

  const { password: _password, ...session } = user;
  return delay({ ok: true, session });
}

export async function getStaffUsers(): Promise<StaffSession[]> {
  return delay(staffUsers.map(({ password: _password, ...rest }) => rest));
}

// --- Doctors --------------------------------------------------------------

export async function getDoctors(): Promise<Doctor[]> {
  return delay([...doctors]);
}

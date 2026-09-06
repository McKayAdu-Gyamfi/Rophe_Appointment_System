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
  AppointmentTypeConfig,
  ClinicSettings,
} from "./types";
import type { PatientVisitSummary } from "./visits";

// --- Settings ------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/** The message from a thrown API error, without asserting the error's type. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string } };
      if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export async function getAppointmentTypes(): Promise<AppointmentTypeConfig[]> {
  return request<AppointmentTypeConfig[]>("/appointment-types");
}

export async function getClinicSettings(): Promise<ClinicSettings> {
  return request<ClinicSettings>("/clinic-settings");
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
  return request<Patient[]>("/patients");
}

export async function getPatient(id: string): Promise<Patient | undefined> {
  return request<Patient>(`/patients/${id}`);
}

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  return request<Patient>("/patients", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdatePatientInput = Partial<CreatePatientInput>;

export async function updatePatient(
  id: string,
  input: UpdatePatientInput,
): Promise<Patient | undefined> {
  return request<Patient>(`/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
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

export interface AppointmentFilters {
  /** "YYYY-MM-DD", inclusive at both ends. */
  from?: string;
  to?: string;
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
}

/**
 * Filters are optional and additive — calling with no arguments still returns
 * everything the signed-in account may see. A doctor is scoped to their own
 * diary by the server whatever is asked for.
 */
export async function getAppointments(filters: AppointmentFilters = {}): Promise<Appointment[]> {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== undefined) as [string, string][],
  );
  const qs = params.toString();
  return request<Appointment[]>(`/appointments${qs ? `?${qs}` : ""}`);
}

export async function getAppointment(id: string): Promise<Appointment | undefined> {
  return request<Appointment>(`/appointments/${id}`);
}

export async function bookAppointment(input: BookAppointmentInput): Promise<Appointment> {
  return request<Appointment>("/appointments", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
  return request<Appointment>(`/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<Appointment | undefined> {
  return request<Appointment>(`/appointments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// --- Messages -------------------------------------------------

export interface MessageFilters {
  channel?: Channel;
  type?: MessageType;
  deliveryStatus?: DeliveryStatus;
  patientId?: string;
}

export async function getMessages(filters: MessageFilters = {}): Promise<Message[]> {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== undefined) as [string, string][],
  );
  const qs = params.toString();
  return request<Message[]>(`/messages${qs ? `?${qs}` : ""}`);
}

let messageInterval: ReturnType<typeof setInterval> | null = null;
const messageListeners = new Set<() => void>();

export function onMessagesChanged(listener: () => void): () => void {
  messageListeners.add(listener);
  if (messageListeners.size > 0 && !messageInterval) {
    messageInterval = setInterval(() => {
      messageListeners.forEach((l) => l());
    }, 5000);
  }
  return () => {
    messageListeners.delete(listener);
    if (messageListeners.size === 0 && messageInterval) {
      clearInterval(messageInterval);
      messageInterval = null;
    }
  };
}

export interface SendMessageInput {
  patientId: string;
  appointmentId?: string;
  channel: Channel;
  type: MessageType;
  /**
   * Ignored by the API. The server renders the clinic's current template and
   * logs that, so what the message log shows is what actually went out rather
   * than what a client claimed it sent.
   */
  contentPreview: string;
}

export async function sendMessage(input: SendMessageInput): Promise<Message> {
  return request<Message>("/messages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- Message templates ----------------------------------------------------

let templateInterval: ReturnType<typeof setInterval> | null = null;
const templateListeners = new Set<() => void>();

export function onTemplatesChanged(listener: () => void): () => void {
  templateListeners.add(listener);
  if (templateListeners.size > 0 && !templateInterval) {
    templateInterval = setInterval(() => {
      templateListeners.forEach((l) => l());
    }, 5000);
  }
  return () => {
    templateListeners.delete(listener);
    if (templateListeners.size === 0 && templateInterval) {
      clearInterval(templateInterval);
      templateInterval = null;
    }
  };
}

export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  return request<MessageTemplate[]>("/templates");
}

export interface UpdateTemplateInput {
  body: string;
  emailSubject: string;
  savedBy: string;
}

export async function updateMessageTemplate(
  type: MessageType,
  input: UpdateTemplateInput,
): Promise<MessageTemplate | undefined> {
  return request<MessageTemplate>(`/templates/${type}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function revertMessageTemplate(
  type: MessageType,
  version: number,
  savedBy: string,
): Promise<MessageTemplate | undefined> {
  return request<MessageTemplate>(`/templates/${type}/revert/${version}`, {
    method: "POST",
    body: JSON.stringify({ savedBy }),
  });
}

// --- Pending requests -----------------------------------------------------

export type RequestDecision = "confirmed" | "declined";

export async function getPendingRequests(): Promise<PatientRequest[]> {
  return request<PatientRequest[]>("/requests");
}

// --- Patient portal -------------------------------------------------------
//
// A patient has no account; the token in their link is the credential. It
// names the appointment, so nothing here sends an appointmentId or patientId —
// the server takes both from the token.

export interface PortalView {
  appointment: {
    id: string;
    appointmentType: string;
    date: string;
    time: string;
    durationMinutes: number;
    status: AppointmentStatus;
  };
  /** Name only — the page greets the patient, it does not show their record. */
  patient: { fullName: string };
  doctor: { fullName: string; specialty: string };
  availability: DoctorAvailability[];
  requests: PatientRequest[];
  clinicSettings: ClinicSettings | null;
  appointmentTypes: AppointmentTypeConfig[];
}

/**
 * Mint a fresh patient link. Front desk work — the token comes back once, so
 * this response is the only chance to copy it.
 */
export async function createPortalLink(
  appointmentId: string,
): Promise<{ token: string; url: string }> {
  return request<{ token: string; url: string }>(`/appointments/${appointmentId}/portal-link`, {
    method: "POST",
  });
}

export async function getPortalAppointment(token: string): Promise<PortalView> {
  return request<PortalView>(`/portal/${encodeURIComponent(token)}`);
}

export async function confirmPortalAppointment(
  token: string,
): Promise<{ status: AppointmentStatus }> {
  return request<{ status: AppointmentStatus }>(
    `/portal/${encodeURIComponent(token)}/confirm`,
    { method: "POST" },
  );
}

export interface CreatePatientRequestInput {
  requestType: PatientRequest["requestType"];
  requestedDate?: string;
  requestedTime?: string;
  reason?: string;
}

export async function createPortalRequest(
  token: string,
  input: CreatePatientRequestInput,
): Promise<PatientRequest> {
  return request<PatientRequest>(`/portal/${encodeURIComponent(token)}/requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function respondToRequest(
  id: string,
  decision: RequestDecision,
): Promise<PatientRequest | undefined> {
  return request<PatientRequest>(`/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: decision }),
  });
}

// --- Doctor availability --------------------------------------------------

/** A single date that does not follow the weekly pattern. */
export interface AvailabilityException {
  id: string;
  doctorId: string;
  date: string; // ISO date
  /** True = no hours at all. False = startTime/endTime replace the pattern. */
  isClosed: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

/**
 * The endpoint answers with the weekly pattern *and* the upcoming exceptions;
 * this keeps returning just the windows, which is what the availability grid
 * reads. Use getDoctorExceptions for the other half.
 *
 * "me" is the default and is what a doctor's own screens pass: the server
 * resolves whose hours these are from the session, so no doctorId is sent for
 * a doctor-scoped action. Front desk names the doctor explicitly.
 */
export async function getDoctorAvailability(doctorId = "me"): Promise<DoctorAvailability[]> {
  const { windows } = await request<{
    windows: DoctorAvailability[];
    exceptions: AvailabilityException[];
  }>(`/doctors/${doctorId}/availability`);
  return windows;
}

export async function getDoctorExceptions(doctorId: string): Promise<AvailabilityException[]> {
  const { exceptions } = await request<{
    windows: DoctorAvailability[];
    exceptions: AvailabilityException[];
  }>(`/doctors/${doctorId}/availability`);
  return exceptions;
}

export async function setDoctorDayAvailability(
  doctorId: string,
  dayOfWeek: number,
  windows: DoctorAvailability[],
): Promise<DoctorAvailability[]> {
  return request<DoctorAvailability[]>(`/doctors/${doctorId}/availability/${dayOfWeek}`, {
    method: "PUT",
    // Only the times are sent: the doctor and the day are in the path.
    body: JSON.stringify({
      windows: windows.map(({ startTime, endTime }) => ({ startTime, endTime })),
    }),
  });
}

export interface CreateExceptionInput {
  date: string;
  isClosed?: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export async function createDoctorException(
  doctorId: string,
  input: CreateExceptionInput,
): Promise<AvailabilityException> {
  return request<AvailabilityException>(`/doctors/${doctorId}/exceptions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteDoctorException(
  doctorId: string,
  exceptionId: string,
): Promise<void> {
  await request(`/doctors/${doctorId}/exceptions/${exceptionId}`, { method: "DELETE" });
}

// --- Auth ------------------------------------------------------

export const MIN_PASSWORD_LENGTH = 8;

export interface SignInInput {
  email: string;
  password: string;
}

export type SignInResult =
  | { ok: true; session: StaffSession }
  | { ok: false; error: string };

export async function signIn(input: SignInInput): Promise<SignInResult> {
  try {
    // Both session endpoints wrap their payload as { session }.
    const { session } = await request<{ session: StaffSession }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true, session };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function signOut(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

export async function getStaffUsers(): Promise<StaffSession[]> {
  return request<StaffSession[]>("/staff");
}

export interface InviteStaffInput {
  fullName: string;
  email: string;
  role: StaffRole;
  jobTitle: string;
  specialty?: string;
  /** Ignored by the API, which records the signed-in inviter instead. */
  invitedBy: string;
}

export type InviteStaffResult =
  | { ok: true; user: StaffSession; inviteToken: string }
  | { ok: false; error: string };

export async function inviteStaffUser(input: InviteStaffInput): Promise<InviteStaffResult> {
  try {
    const data = await request<{ user: StaffSession; inviteToken: string }>("/staff/invitations", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true, user: data.user, inviteToken: data.inviteToken };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function getStaffInvitation(token: string): Promise<StaffSession | undefined> {
  try {
    const { session } = await request<{ session: StaffSession }>(
      `/staff/invitations/${encodeURIComponent(token)}`,
    );
    return session;
  } catch {
    // A bad, used or expired link is not an error to the invite screen — it
    // renders its "this link is not valid" stage off an absent invitee.
    return undefined;
  }
}

export type AcceptInvitationResult =
  | { ok: true; session: StaffSession }
  | { ok: false; error: string };

export async function acceptStaffInvitation(
  token: string,
  password: string,
): Promise<AcceptInvitationResult> {
  try {
    const { session } = await request<{ session: StaffSession }>(
      `/staff/invitations/${encodeURIComponent(token)}/accept`,
      {
        method: "POST",
        body: JSON.stringify({ password }),
      },
    );
    return { ok: true, session };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function revokeStaffInvitation(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await request(`/staff/invitations/${id}`, { method: "DELETE" });
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function resendStaffInvitation(
  id: string,
): Promise<{ ok: true; inviteToken: string } | { ok: false; error: string }> {
  try {
    const data = await request<{ inviteToken: string }>(`/staff/invitations/${id}/resend`, {
      method: "POST",
    });
    return { ok: true, inviteToken: data.inviteToken };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function getMe(): Promise<{ ok: true; session: StaffSession } | { ok: false; error: string }> {
  try {
    const { session } = await request<{ session: StaffSession }>("/auth/me");
    return { ok: true, session };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

// --- Patient recall -------------------------------------------------------

export interface RecallEntry {
  patient: Patient;
  summary: PatientVisitSummary;
}

export async function getPatientRecalls(): Promise<RecallEntry[]> {
  return request<RecallEntry[]>("/recalls");
}

export async function getPatientVisitSummary(
  patientId: string,
): Promise<PatientVisitSummary | undefined> {
  return request<PatientVisitSummary>(`/patients/${patientId}/summary`);
}

// --- Doctors --------------------------------------------------------------

export async function getDoctors(): Promise<Doctor[]> {
  return request<Doctor[]>("/doctors");
}

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

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
      const data = await res.json();
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

export async function getAppointments(): Promise<Appointment[]> {
  return request<Appointment[]>("/appointments");
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

export async function getMessages(): Promise<Message[]> {
  return request<Message[]>("/messages");
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

export interface CreatePatientRequestInput {
  appointmentId: string;
  patientId: string;
  requestType: PatientRequest["requestType"];
  requestedDate?: string;
  requestedTime?: string;
  reason?: string;
}

export async function createPatientRequest(
  input: CreatePatientRequestInput,
): Promise<PatientRequest> {
  return request<PatientRequest>("/requests", {
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
    body: JSON.stringify({ status: decision.toUpperCase() }),
  });
}

// --- Doctor availability --------------------------------------------------

export async function getDoctorAvailability(doctorId = "doc-1"): Promise<DoctorAvailability[]> {
  return request<DoctorAvailability[]>(`/doctors/${doctorId}/availability`);
}

export async function setDoctorDayAvailability(
  doctorId: string,
  dayOfWeek: number,
  windows: DoctorAvailability[],
): Promise<DoctorAvailability[]> {
  return request<DoctorAvailability[]>(`/doctors/${doctorId}/availability/${dayOfWeek}`, {
    method: "PUT",
    body: JSON.stringify({ windows }),
  });
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
    const session = await request<StaffSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true, session };
  } catch (error: any) {
    return { ok: false, error: error.message };
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
  invitedBy: string;
}

export type InviteStaffResult =
  | { ok: true; user: StaffSession; inviteToken: string }
  | { ok: false; error: string };

export async function inviteStaffUser(input: InviteStaffInput): Promise<InviteStaffResult> {
  try {
    const data = await request<{ user: StaffSession; inviteToken: string }>("/staff/invite", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true, user: data.user, inviteToken: data.inviteToken };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export async function getStaffInvitation(token: string): Promise<StaffSession | undefined> {
  return request<StaffSession>(`/auth/invitation/${token}`);
}

export type AcceptInvitationResult =
  | { ok: true; session: StaffSession }
  | { ok: false; error: string };

export async function acceptStaffInvitation(
  token: string,
  password: string,
): Promise<AcceptInvitationResult> {
  try {
    const session = await request<StaffSession>("/auth/accept-invitation", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    return { ok: true, session };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export async function revokeStaffInvitation(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await request(`/staff/${id}/invitation`, { method: "DELETE" });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export async function resendStaffInvitation(
  id: string,
): Promise<{ ok: true; inviteToken: string } | { ok: false; error: string }> {
  try {
    const data = await request<{ inviteToken: string }>(`/staff/${id}/resend-invitation`, {
      method: "POST",
    });
    return { ok: true, inviteToken: data.inviteToken };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export async function getMe(): Promise<{ ok: true; session: StaffSession } | { ok: false; error: string }> {
  try {
    const session = await request<StaffSession>("/auth/me");
    return { ok: true, session };
  } catch (error: any) {
    return { ok: false, error: error.message };
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

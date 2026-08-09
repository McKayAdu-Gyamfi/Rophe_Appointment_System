import type {
  Patient,
  Appointment,
  AppointmentStatus,
  Message,
  PatientRequest,
  DoctorAvailability,
  Doctor,
} from "./types";
import {
  patients,
  appointments,
  messages,
  patientRequests,
  doctorAvailability,
  doctors,
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

// --- Pending requests -----------------------------------------------------

export type RequestDecision = "confirmed" | "declined";

export async function getPendingRequests(): Promise<PatientRequest[]> {
  return delay([...patientRequests]);
}

export async function respondToRequest(
  id: string,
  decision: RequestDecision,
): Promise<PatientRequest | undefined> {
  const req = patientRequests.find((r) => r.id === id);
  if (req) {
    req.status = decision;
  }
  return delay(req);
}

// --- Doctor availability --------------------------------------------------

export async function getDoctorAvailability(doctorId = "doc-1"): Promise<DoctorAvailability[]> {
  return delay(doctorAvailability.filter((d) => d.doctorId === doctorId));
}

export async function setDoctorAvailability(
  doctorId: string,
  dayOfWeek: number,
  isAvailable: boolean,
  startTime?: string,
  endTime?: string,
): Promise<DoctorAvailability | undefined> {
  const slot = doctorAvailability.find(
    (d) => d.doctorId === doctorId && d.dayOfWeek === dayOfWeek,
  );
  if (slot) {
    slot.isAvailable = isAvailable;
    if (startTime) slot.startTime = startTime;
    if (endTime) slot.endTime = endTime;
  }
  return delay(slot);
}

// --- Doctors --------------------------------------------------------------

export async function getDoctors(): Promise<Doctor[]> {
  return delay([...doctors]);
}

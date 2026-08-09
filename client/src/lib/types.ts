// Data model shapes — mirror the future Prisma schema (camelCase).
// Source of truth for both mock data and the real backend that replaces it.

export type Channel = "whatsapp" | "sms" | "email";

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "attended"
  | "missed"
  | "rescheduled";

export type MessageType = "confirmation" | "reminder" | "follow-up" | "birthday";

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

import type {
  Patient,
  Appointment,
  DoctorAvailability,
  Message,
  MessageTemplate,
  PatientRequest,
  Doctor,
  StaffUser,
} from "./types";
import { dateKey } from "./format";

/**
 * A date this many days from today, as "YYYY-MM-DD". Seed dates are relative
 * so the prototype always has a live today, a recent past and a real six-month
 * tail — a fixed date would put the recall list out of date within a month.
 */
function isoOffset(daysFromToday: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return dateKey(d);
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export const doctors: Doctor[] = [
  { id: "doc-1", fullName: "Dr. Akosua Mensah", specialty: "Specialist Physician" },
];

// ---------------------------------------------------------------------------
// Staff accounts — demo credentials for the prototype sign-in.
//
// Plaintext passwords are fine here because nothing is protected: there is no
// backend, no real patient data, and the login exists so the client can see the
// shape of the real thing. Phase 3 replaces this with hashed credentials and a
// server session. Patients never appear here — they reach their page by link.
// ---------------------------------------------------------------------------

export const DEMO_PASSWORD = "rophe123";

export const staffUsers: StaffUser[] = [
  {
    id: "u-001",
    fullName: "Abena Owusu",
    email: "frontdesk@rophe.care",
    password: DEMO_PASSWORD,
    role: "front-desk",
    staffId: "RSC-1042",
    jobTitle: "Front-desk Staff",
    status: "active",
  },
  {
    id: "u-002",
    fullName: "Dr. Akosua Mensah",
    email: "dr.mensah@rophe.care",
    password: DEMO_PASSWORD,
    role: "doctor",
    staffId: "RSC-0001",
    jobTitle: "Specialist Physician",
    doctorId: "doc-1",
    status: "active",
  },
  {
    id: "u-003",
    fullName: "Kofi Boateng",
    email: "reception@rophe.care",
    password: DEMO_PASSWORD,
    role: "front-desk",
    staffId: "RSC-1088",
    jobTitle: "Reception Assistant",
    status: "active",
  },
  // An invitation mid-flight, so the staff screen and the accept page both have
  // something to show on first load. No password: front desk never sets one.
  {
    id: "u-004",
    fullName: "Gifty Amponsah",
    email: "gifty.amponsah@rophe.care",
    role: "front-desk",
    staffId: "RSC-1104",
    jobTitle: "Reception Assistant",
    status: "invited",
    inviteToken: "demo-invite-token",
    invitedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    invitedBy: "Abena Owusu",
  },
];

// ---------------------------------------------------------------------------
// Patients — 22, varied preferred channels, some missing email. The last six
// are the recall cohort; see the comment above them.
// ---------------------------------------------------------------------------

export const patients: Patient[] = [
  {
    id: "p-001",
    fullName: "Kwabena Owusu",
    phone: "+233 24 123 4567",
    whatsappNumber: "+233 24 123 4567",
    email: "kwabena.owusu@gmail.com",
    dateOfBirth: "1987-03-14",
    preferredChannel: "whatsapp",
    registeredDate: "2024-01-08",
    notes: "Prefers morning appointments.",
  },
  {
    id: "p-002",
    fullName: "Ama Serwaa",
    phone: "+233 20 987 6543",
    whatsappNumber: "+233 20 987 6543",
    email: "ama.serwaa@yahoo.com",
    dateOfBirth: "1992-07-22",
    preferredChannel: "whatsapp",
    registeredDate: "2024-01-15",
  },
  {
    id: "p-003",
    fullName: "Yaw Boateng",
    phone: "+233 27 555 0118",
    dateOfBirth: "1975-11-02",
    preferredChannel: "sms",
    registeredDate: "2024-02-01",
    notes: "SMS-only — no email on file.",
  },
  {
    id: "p-004",
    fullName: "Abena Dapaah",
    phone: "+233 24 444 7788",
    whatsappNumber: "+233 24 444 7788",
    email: "abena.dapaah@outlook.com",
    dateOfBirth: "1990-05-30",
    preferredChannel: "email",
    registeredDate: "2024-02-12",
  },
  {
    id: "p-005",
    fullName: "Kofi Asante",
    phone: "+233 20 332 1100",
    whatsappNumber: "+233 20 332 1100",
    dateOfBirth: "1983-09-18",
    preferredChannel: "sms",
    registeredDate: "2024-02-20",
  },
  {
    id: "p-006",
    fullName: "Esi Mensimah",
    phone: "+233 26 901 2233",
    whatsappNumber: "+233 26 901 2233",
    email: "esi.mensimah@gmail.com",
    dateOfBirth: "1995-12-05",
    preferredChannel: "whatsapp",
    registeredDate: "2024-03-02",
  },
  {
    id: "p-007",
    fullName: "Kojo Frimpong",
    phone: "+233 24 667 8899",
    whatsappNumber: "+233 24 667 8899",
    email: "kojo.frimpong@gmail.com",
    dateOfBirth: "1978-04-11",
    preferredChannel: "email",
    registeredDate: "2024-03-10",
  },
  {
    id: "p-008",
    fullName: "Adwoa Nyarko",
    phone: "+233 27 220 4455",
    dateOfBirth: "2000-08-19",
    preferredChannel: "sms",
    registeredDate: "2024-03-22",
  },
  {
    id: "p-009",
    fullName: "Ekow Mensah",
    phone: "+233 20 778 1122",
    whatsappNumber: "+233 20 778 1122",
    email: "ekow.mensah@hotmail.com",
    dateOfBirth: "1989-01-27",
    preferredChannel: "whatsapp",
    registeredDate: "2024-04-05",
  },
  {
    id: "p-010",
    fullName: "Akua Tweneboah",
    phone: "+233 24 556 3300",
    whatsappNumber: "+233 24 556 3300",
    email: "akua.tweneboah@gmail.com",
    dateOfBirth: "1993-06-14",
    preferredChannel: "email",
    registeredDate: "2024-04-18",
  },
  {
    id: "p-011",
    fullName: "Nana Yaw Darko",
    phone: "+233 26 414 9988",
    whatsappNumber: "+233 26 414 9988",
    dateOfBirth: "1970-02-08",
    preferredChannel: "sms",
    registeredDate: "2024-05-01",
    notes: "Hypertension follow-up.",
  },
  {
    id: "p-012",
    fullName: "Afia Pokuaa",
    phone: "+233 20 880 6677",
    whatsappNumber: "+233 20 880 6677",
    email: "afia.pokuaa@yahoo.com",
    dateOfBirth: "1998-10-23",
    preferredChannel: "whatsapp",
    registeredDate: "2024-05-14",
  },
  {
    id: "p-013",
    fullName: "Kwesi Appiah",
    phone: "+233 24 112 5566",
    whatsappNumber: "+233 24 112 5566",
    email: "kwesi.appiah@gmail.com",
    dateOfBirth: "1985-07-09",
    preferredChannel: "email",
    registeredDate: "2024-06-03",
  },
  {
    id: "p-014",
    fullName: "Eunice Adjei",
    phone: "+233 27 334 8821",
    dateOfBirth: "1996-03-17",
    preferredChannel: "sms",
    registeredDate: "2024-06-20",
  },
  {
    id: "p-015",
    fullName: "Selorm Agbodzi",
    phone: "+233 24 990 0011",
    whatsappNumber: "+233 24 990 0011",
    email: "selorm.agbodzi@gmail.com",
    dateOfBirth: "1991-11-28",
    preferredChannel: "whatsapp",
    registeredDate: "2024-07-08",
  },
  {
    id: "p-016",
    fullName: "Mansa Asante-Boateng",
    phone: "+233 20 661 2200",
    whatsappNumber: "+233 20 661 2200",
    email: "mansa.ab@outlook.com",
    dateOfBirth: "1982-12-30",
    preferredChannel: "email",
    registeredDate: "2024-07-19",
  },
  // -------------------------------------------------------------------------
  // The recall cohort (PRD Section 5a). These six exist so the six-month list
  // is never empty and covers every shape the doctor described: someone who
  // came once and never came back, and someone who booked and never showed.
  // p-020 is the odd one out on purpose — a record with no appointment at all,
  // which the clinic says cannot happen legitimately, so it exercises the
  // "Needs checking" tab rather than the sweep. Their registration dates are
  // relative to today, so the tail stays six months long as the prototype ages.
  // -------------------------------------------------------------------------
  {
    id: "p-017",
    fullName: "Adjoa Frempong",
    phone: "+233 24 660 4412",
    whatsappNumber: "+233 24 660 4412",
    email: "adjoa.frempong@gmail.com",
    dateOfBirth: "1994-04-11",
    preferredChannel: "whatsapp",
    registeredDate: isoOffset(-280),
    notes: "Came in for a first consultation and did not rebook.",
  },
  {
    id: "p-018",
    fullName: "Yaw Ansah",
    phone: "+233 27 214 8890",
    dateOfBirth: "1968-12-05",
    preferredChannel: "sms",
    registeredDate: isoOffset(-620),
    notes: "Hypertensive. Was attending regularly until last year.",
  },
  {
    id: "p-019",
    fullName: "Efua Boakye",
    phone: "+233 20 771 3025",
    whatsappNumber: "+233 20 771 3025",
    dateOfBirth: "1999-08-27",
    preferredChannel: "whatsapp",
    registeredDate: isoOffset(-300),
    notes: "Booked twice, did not attend either. No email on file.",
  },
  {
    id: "p-020",
    fullName: "Kojo Amankwah",
    phone: "+233 26 448 9071",
    dateOfBirth: "1981-02-19",
    preferredChannel: "sms",
    registeredDate: isoOffset(-310),
    notes: "Record has no appointment against it — registration looks unfinished.",
  },
  {
    id: "p-021",
    fullName: "Naa Ayeley Quartey",
    phone: "+233 24 905 6612",
    whatsappNumber: "+233 24 905 6612",
    email: "naa.quartey@outlook.com",
    dateOfBirth: "1986-10-30",
    preferredChannel: "email",
    registeredDate: isoOffset(-400),
    notes: "Diabetes review patient — due back soon.",
  },
  {
    id: "p-022",
    fullName: "Kwame Antwi",
    phone: "+233 20 118 4457",
    whatsappNumber: "+233 20 118 4457",
    email: "kwame.antwi@gmail.com",
    dateOfBirth: "1972-06-14",
    preferredChannel: "whatsapp",
    registeredDate: isoOffset(-500),
    notes: "Lapsed, but a recall message went out this month.",
  },
];

// ---------------------------------------------------------------------------
// Doctor availability — non-flat pattern.
// Mon: closed. Tue: morning only. Wed: full day. Thu: afternoon only.
// Fri: morning only. Sat: closed. Sun: closed.
// ---------------------------------------------------------------------------

// A day can hold several windows (see Wednesday) — the doctor's grid writes
// back the fewest merged ranges that cover the slots she left open. Closed days
// simply have no rows: Sunday, Monday, and Saturday are absent below.
export const doctorAvailability: DoctorAvailability[] = [
  { doctorId: "doc-1", dayOfWeek: 2, startTime: "08:00", endTime: "12:00", isAvailable: true }, // Tue AM
  { doctorId: "doc-1", dayOfWeek: 3, startTime: "08:00", endTime: "12:30", isAvailable: true }, // Wed AM
  { doctorId: "doc-1", dayOfWeek: 3, startTime: "14:00", endTime: "17:00", isAvailable: true }, // Wed PM (lunch gap)
  { doctorId: "doc-1", dayOfWeek: 4, startTime: "13:00", endTime: "17:00", isAvailable: true }, // Thu PM only
  { doctorId: "doc-1", dayOfWeek: 5, startTime: "08:00", endTime: "12:00", isAvailable: true }, // Fri AM
];

// ---------------------------------------------------------------------------
// Appointments — past + future, all 5 statuses, enough missed + attended.
// Dates are relative to "today" so the prototype always has live data.
// ---------------------------------------------------------------------------

export const appointments: Appointment[] = [
  // Past — attended history
  {
    id: "a-1001",
    patientId: "p-001",
    doctorId: "doc-1",
    appointmentType: "Dietician review",
    date: isoOffset(-28),
    time: "09:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
  },
  {
    id: "a-1002",
    patientId: "p-004",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-21),
    time: "10:30",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
  },
  {
    id: "a-1003",
    patientId: "p-006",
    doctorId: "doc-1",
    appointmentType: "Urologist review",
    date: isoOffset(-14),
    time: "08:30",
    durationMinutes: 45,
    status: "attended",
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  // Past — missed (populate follow-up list)
  {
    id: "a-1004",
    patientId: "p-003",
    doctorId: "doc-1",
    appointmentType: "Follow up",
    date: isoOffset(-7),
    time: "09:30",
    durationMinutes: 15,
    status: "missed",
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    notes: "No-show, no prior notice.",
  },
  {
    id: "a-1005",
    patientId: "p-008",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-5),
    time: "14:00",
    durationMinutes: 15,
    status: "missed",
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: "a-1006",
    patientId: "p-011",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-3),
    time: "15:30",
    durationMinutes: 15,
    status: "missed",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  // Missed with no follow-up logged yet — these are what populate the
  // dashboard's "Pending follow-ups" action list on first load (PRD §5, §6.2).
  {
    id: "a-1010",
    patientId: "p-004",
    doctorId: "doc-1",
    appointmentType: "Follow up",
    date: isoOffset(-2),
    time: "09:30",
    durationMinutes: 15,
    status: "missed",
    createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    id: "a-1011",
    patientId: "p-013",
    doctorId: "doc-1",
    appointmentType: "Diabetes review",
    date: isoOffset(-6),
    time: "10:30",
    durationMinutes: 15,
    status: "missed",
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    notes: "Second missed visit — call before rebooking.",
  },
  // Past — rescheduled
  {
    id: "a-1007",
    patientId: "p-002",
    doctorId: "doc-1",
    appointmentType: "General checkup",
    date: isoOffset(-10),
    time: "11:00",
    durationMinutes: 30,
    status: "rescheduled",
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    notes: "Patient rescheduled to next week.",
  },
  // Today — confirmed
  {
    id: "a-2001",
    patientId: "p-005",
    doctorId: "doc-1",
    appointmentType: "Diabetes review",
    date: isoOffset(0),
    time: "09:00",
    durationMinutes: 15,
    status: "confirmed",
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "a-2002",
    patientId: "p-009",
    doctorId: "doc-1",
    appointmentType: "Follow up",
    date: isoOffset(0),
    time: "10:30",
    durationMinutes: 15,
    status: "confirmed",
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "a-2003",
    patientId: "p-012",
    doctorId: "doc-1",
    appointmentType: "Dietician review",
    date: isoOffset(0),
    time: "14:00",
    durationMinutes: 15,
    status: "booked",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  // Future — booked / confirmed mix
  {
    id: "a-2004",
    patientId: "p-007",
    doctorId: "doc-1",
    appointmentType: "Urologist review",
    date: isoOffset(2),
    time: "08:30",
    durationMinutes: 15,
    status: "booked",
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "a-2005",
    patientId: "p-010",
    doctorId: "doc-1",
    appointmentType: "Follow up",
    date: isoOffset(3),
    time: "11:00",
    durationMinutes: 15,
    status: "confirmed",
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "a-2006",
    patientId: "p-013",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(5),
    time: "09:30",
    durationMinutes: 15,
    status: "booked",
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "a-2007",
    patientId: "p-015",
    doctorId: "doc-1",
    appointmentType: "General checkup",
    date: isoOffset(7),
    time: "10:00",
    durationMinutes: 30,
    status: "booked",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a-2008",
    patientId: "p-016",
    doctorId: "doc-1",
    appointmentType: "Follow up",
    date: isoOffset(9),
    time: "14:30",
    durationMinutes: 15,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a-2009",
    patientId: "p-014",
    doctorId: "doc-1",
    appointmentType: "Diabetes review",
    date: isoOffset(12),
    time: "15:00",
    durationMinutes: 15,
    status: "booked",
    createdAt: new Date().toISOString(),
  },

  // -------------------------------------------------------------------------
  // Established history. These patients registered in 2024, so their recent
  // appointments are return visits, not first ones — without an earlier
  // attended visit on record a "Follow up" would be following up on nothing,
  // and every booking would price itself at the 40-minute first-visit rate.
  // -------------------------------------------------------------------------
  {
    id: "a-0801",
    patientId: "p-002",
    doctorId: "doc-1",
    appointmentType: "Dietician review",
    date: isoOffset(-140),
    time: "09:30",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 147 * 86400000).toISOString(),
  },
  {
    id: "a-0802",
    patientId: "p-003",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-125),
    time: "10:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 132 * 86400000).toISOString(),
  },
  {
    id: "a-0803",
    patientId: "p-005",
    doctorId: "doc-1",
    appointmentType: "Diabetes review",
    date: isoOffset(-118),
    time: "10:30",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 125 * 86400000).toISOString(),
  },
  {
    id: "a-0804",
    patientId: "p-007",
    doctorId: "doc-1",
    appointmentType: "General checkup",
    date: isoOffset(-110),
    time: "11:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 117 * 86400000).toISOString(),
  },
  {
    id: "a-0805",
    patientId: "p-008",
    doctorId: "doc-1",
    appointmentType: "Urologist review",
    date: isoOffset(-102),
    time: "14:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 109 * 86400000).toISOString(),
  },
  {
    id: "a-0806",
    patientId: "p-009",
    doctorId: "doc-1",
    appointmentType: "Dietician review",
    date: isoOffset(-96),
    time: "14:30",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 103 * 86400000).toISOString(),
  },
  {
    id: "a-0807",
    patientId: "p-010",
    doctorId: "doc-1",
    appointmentType: "Diabetes review",
    date: isoOffset(-88),
    time: "09:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 95 * 86400000).toISOString(),
  },
  {
    id: "a-0808",
    patientId: "p-011",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-80),
    time: "09:30",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 87 * 86400000).toISOString(),
  },
  {
    id: "a-0809",
    patientId: "p-012",
    doctorId: "doc-1",
    appointmentType: "General checkup",
    date: isoOffset(-74),
    time: "10:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 81 * 86400000).toISOString(),
  },
  {
    id: "a-0810",
    patientId: "p-013",
    doctorId: "doc-1",
    appointmentType: "Urologist review",
    date: isoOffset(-68),
    time: "10:30",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 75 * 86400000).toISOString(),
  },
  {
    id: "a-0811",
    patientId: "p-014",
    doctorId: "doc-1",
    appointmentType: "Dietician review",
    date: isoOffset(-61),
    time: "11:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 68 * 86400000).toISOString(),
  },
  {
    id: "a-0812",
    patientId: "p-015",
    doctorId: "doc-1",
    appointmentType: "Diabetes review",
    date: isoOffset(-55),
    time: "14:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 62 * 86400000).toISOString(),
  },
  {
    id: "a-0813",
    patientId: "p-016",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-48),
    time: "14:30",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 55 * 86400000).toISOString(),
  },

  // -------------------------------------------------------------------------
  // The six-month tail. These sit far enough back that the recall list has
  // something in it on day one, and they carry the clinic's own durations —
  // 40 minutes for a first visit, 15 for a return — so the seed agrees with
  // the rule in lib/appointment-types.ts.
  // -------------------------------------------------------------------------

  // p-017 — came once, never came back (8 months).
  {
    id: "a-0901",
    patientId: "p-017",
    doctorId: "doc-1",
    appointmentType: "Dietician review",
    date: isoOffset(-245),
    time: "09:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 252 * 86400000).toISOString(),
    notes: "First consultation. Advised to return in 6 weeks.",
  },

  // p-018 — attended regularly, then stopped (14 months).
  {
    id: "a-0902",
    patientId: "p-018",
    doctorId: "doc-1",
    appointmentType: "Urologist review",
    date: isoOffset(-600),
    time: "08:30",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 607 * 86400000).toISOString(),
  },
  {
    id: "a-0903",
    patientId: "p-018",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-520),
    time: "10:00",
    durationMinutes: 15,
    status: "attended",
    createdAt: new Date(Date.now() - 527 * 86400000).toISOString(),
  },
  {
    id: "a-0904",
    patientId: "p-018",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-425),
    time: "10:15",
    durationMinutes: 15,
    status: "attended",
    createdAt: new Date(Date.now() - 432 * 86400000).toISOString(),
    notes: "BP stable on current dose. Review in 3 months.",
  },

  // p-019 — booked twice, never attended either.
  {
    id: "a-0905",
    patientId: "p-019",
    doctorId: "doc-1",
    appointmentType: "Other specialist review",
    date: isoOffset(-285),
    time: "11:00",
    durationMinutes: 40,
    status: "missed",
    createdAt: new Date(Date.now() - 292 * 86400000).toISOString(),
    notes: "No-show. Rebooked over the phone.",
  },
  {
    id: "a-0906",
    patientId: "p-019",
    doctorId: "doc-1",
    appointmentType: "General checkup",
    date: isoOffset(-215),
    time: "09:30",
    durationMinutes: 40,
    status: "missed",
    createdAt: new Date(Date.now() - 222 * 86400000).toISOString(),
    notes: "No-show again. Phone rang out.",
  },

  // p-021 — inside the warning band, not yet lapsed (5 months).
  {
    id: "a-0907",
    patientId: "p-021",
    doctorId: "doc-1",
    appointmentType: "Diabetes review",
    date: isoOffset(-160),
    time: "14:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 167 * 86400000).toISOString(),
  },

  // p-022 — lapsed, but already contacted this month (see m-101).
  {
    id: "a-0908",
    patientId: "p-022",
    doctorId: "doc-1",
    appointmentType: "General checkup",
    date: isoOffset(-215),
    time: "08:00",
    durationMinutes: 40,
    status: "attended",
    createdAt: new Date(Date.now() - 222 * 86400000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Messages — 20 entries, all types/channels, at least one failed, including
// the recall sweep that keeps p-022 off this month's list.
// ---------------------------------------------------------------------------

export const messages: Message[] = [
  // Recall outreach. m-101 is inside the 30-day cooldown, which is why Kwame
  // Antwi shows as "contacted" rather than pending on the recall screen; m-102
  // is old enough that Yaw Darko is due another attempt.
  {
    id: "m-101",
    patientId: "p-022",
    channel: "whatsapp",
    type: "recall",
    sentAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview:
      "Hello Kwame, we have not seen you at Rophe Specialist Care since January. Call 020 152 9933 to book a visit.",
  },
  {
    id: "m-102",
    patientId: "p-018",
    channel: "sms",
    type: "recall",
    sentAt: new Date(Date.now() - 95 * 86400000).toISOString(),
    deliveryStatus: "failed",
    contentPreview:
      "Hello Yaw, it has been a while since your last review. Call 020 152 9933 to book a visit.",
  },
  {
    id: "m-001",
    patientId: "p-001",
    appointmentId: "a-1001",
    channel: "whatsapp",
    type: "confirmation",
    sentAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Your appointment on {date} at 09:00 is confirmed. Reply to confirm.",
  },
  {
    id: "m-002",
    patientId: "p-001",
    appointmentId: "a-1001",
    channel: "whatsapp",
    type: "reminder",
    sentAt: new Date(Date.now() - 29 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Reminder: appointment tomorrow at 09:00 with Dr. Mensah.",
  },
  {
    id: "m-003",
    patientId: "p-004",
    appointmentId: "a-1002",
    channel: "email",
    type: "confirmation",
    sentAt: new Date(Date.now() - 28 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Appointment confirmed for {date} at 10:30.",
  },
  {
    id: "m-004",
    patientId: "p-006",
    appointmentId: "a-1003",
    channel: "whatsapp",
    type: "reminder",
    sentAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Reminder: appointment tomorrow at 08:30.",
  },
  {
    id: "m-005",
    patientId: "p-003",
    appointmentId: "a-1004",
    channel: "sms",
    type: "reminder",
    sentAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    deliveryStatus: "sent",
    contentPreview: "Reminder: appointment tomorrow at 09:30.",
  },
  {
    id: "m-006",
    patientId: "p-003",
    appointmentId: "a-1004",
    channel: "sms",
    type: "follow-up",
    sentAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    deliveryStatus: "failed",
    contentPreview: "You missed your appointment. Please call to reschedule.",
  },
  {
    id: "m-007",
    patientId: "p-008",
    appointmentId: "a-1005",
    channel: "sms",
    type: "reminder",
    sentAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Reminder: appointment tomorrow at 14:00.",
  },
  {
    id: "m-008",
    patientId: "p-008",
    appointmentId: "a-1005",
    channel: "sms",
    type: "follow-up",
    sentAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    deliveryStatus: "sent",
    contentPreview: "Missed appointment — please contact us to reschedule.",
  },
  {
    id: "m-009",
    patientId: "p-011",
    appointmentId: "a-1006",
    channel: "sms",
    type: "follow-up",
    sentAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Missed hypertension review. Please book a new slot.",
  },
  {
    id: "m-010",
    patientId: "p-002",
    appointmentId: "a-1007",
    channel: "whatsapp",
    type: "confirmation",
    sentAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Appointment confirmed for {date} at 11:00.",
  },
  {
    id: "m-011",
    patientId: "p-005",
    appointmentId: "a-2001",
    channel: "sms",
    type: "confirmation",
    sentAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Your appointment today at 09:00 is confirmed.",
  },
  {
    id: "m-012",
    patientId: "p-009",
    appointmentId: "a-2002",
    channel: "whatsapp",
    type: "reminder",
    sentAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Reminder: appointment today at 10:30.",
  },
  {
    id: "m-013",
    patientId: "p-007",
    appointmentId: "a-2004",
    channel: "email",
    type: "confirmation",
    sentAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    deliveryStatus: "sent",
    contentPreview: "Appointment booked for {date} at 08:30. Please confirm.",
  },
  {
    id: "m-014",
    patientId: "p-010",
    appointmentId: "a-2005",
    channel: "email",
    type: "reminder",
    sentAt: new Date().toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Reminder: appointment on {date} at 11:00.",
  },
  {
    id: "m-015",
    patientId: "p-004",
    channel: "email",
    type: "birthday",
    sentAt: new Date().toISOString(),
    deliveryStatus: "delivered",
    contentPreview: "Happy birthday from Rophe Specialist Care!",
  },
  {
    id: "m-016",
    patientId: "p-016",
    appointmentId: "a-2008",
    channel: "email",
    type: "confirmation",
    sentAt: new Date().toISOString(),
    deliveryStatus: "sent",
    contentPreview: "Appointment confirmed for {date} at 14:30.",
  },
  {
    id: "m-017",
    patientId: "p-014",
    appointmentId: "a-2009",
    channel: "sms",
    type: "reminder",
    sentAt: new Date().toISOString(),
    deliveryStatus: "failed",
    contentPreview: "Reminder: appointment on {date} at 15:00. (delivery failed — retry queued)",
  },
];

// ---------------------------------------------------------------------------
// Pending requests — 3, mix of reschedule + cancellation.
// ---------------------------------------------------------------------------

export const patientRequests: PatientRequest[] = [
  {
    id: "r-001",
    appointmentId: "a-2004",
    patientId: "p-007",
    requestType: "reschedule",
    requestedDate: isoOffset(6),
    requestedTime: "10:00",
    reason: "Work commitment at original time.",
    status: "pending",
  },
  {
    id: "r-002",
    appointmentId: "a-2002",
    patientId: "p-009",
    requestType: "reschedule",
    requestedDate: isoOffset(4),
    requestedTime: "09:00",
    reason: "",
    status: "pending",
  },
  {
    id: "r-003",
    appointmentId: "a-2003",
    patientId: "p-012",
    requestType: "cancellation",
    reason: "Feeling better, no longer needed.",
    status: "pending",
  },
];


// ---------------------------------------------------------------------------
// Message templates
//
// The wording the clinic owns. These are starting drafts, not final copy —
// the point of the Templates tab is that Rophe replaces them with their own
// words without anyone touching the code. Each one is kept inside a single
// 160-character SMS segment once rendered, so the default wording costs one
// message per patient rather than two.
// ---------------------------------------------------------------------------

const TEMPLATES_SEEDED_AT = new Date(Date.now() - 21 * 86400000).toISOString();

export const messageTemplates: MessageTemplate[] = [
  {
    id: "tpl-confirmation",
    type: "confirmation",
    description: "Sent as soon as an appointment is booked.",
    body:
      "Hello {{first_name}}, your appointment with {{doctor}} is confirmed for " +
      "{{date}} at {{time}}. Call {{clinic_phone}} if you need to change it.",
    emailSubject: "Your appointment is confirmed — {{clinic_name}}",
    version: 1,
    updatedAt: TEMPLATES_SEEDED_AT,
    updatedBy: "Abena Owusu",
    history: [],
  },
  {
    id: "tpl-reminder",
    type: "reminder",
    description: "Sent the day before an appointment.",
    body:
      "Hello {{first_name}}, a reminder of your appointment tomorrow, {{date}} " +
      "at {{time}}, with {{doctor}}. Please arrive 10 minutes early.",
    emailSubject: "Reminder: your appointment on {{date}}",
    version: 1,
    updatedAt: TEMPLATES_SEEDED_AT,
    updatedBy: "Abena Owusu",
    history: [],
  },
  {
    id: "tpl-follow-up",
    type: "follow-up",
    description: "Sent after a missed appointment.",
    body:
      "Hello {{first_name}}, we missed you at {{clinic_name}} on {{date}}. " +
      "Call {{clinic_phone}} to book another time — we would love to see you.",
    emailSubject: "We missed you at {{clinic_name}}",
    version: 1,
    updatedAt: TEMPLATES_SEEDED_AT,
    updatedBy: "Abena Owusu",
    history: [],
  },
  {
    id: "tpl-recall",
    type: "recall",
    description: "Sent to a patient who has not been seen for six months.",
    body:
      "Hello {{first_name}}, we have not seen you at {{clinic_name}} since " +
      "{{last_visit}}. If you are due a check-up, call {{clinic_phone}} and we " +
      "will find you a time.",
    emailSubject: "It has been a while — {{clinic_name}}",
    version: 1,
    updatedAt: TEMPLATES_SEEDED_AT,
    updatedBy: "Abena Owusu",
    history: [],
  },
  {
    id: "tpl-birthday",
    type: "birthday",
    description: "Sent on the patient's birthday.",
    body:
      "Happy birthday, {{first_name}}! Everyone at {{clinic_name}} wishes you " +
      "a wonderful year ahead and good health always.",
    emailSubject: "Happy birthday from {{clinic_name}}!",
    version: 1,
    updatedAt: TEMPLATES_SEEDED_AT,
    updatedBy: "Abena Owusu",
    history: [],
  },
];

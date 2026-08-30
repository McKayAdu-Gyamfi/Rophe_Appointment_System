import { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";

// ---------------------------------------------------------------------------
// Seed — the prototype's demo data, made real.
//
// Ported from client/src/lib/mockData.ts so the app that the clinic has already
// reviewed still looks like itself when it is running on Postgres. Keeping it
// is what lets both halves of the API be developed against realistic data:
// there are lapsed patients for the recall queries, a pending invitation for
// the staff flow, and a failed message for the delivery-status work.
//
// Dates are relative to "today", exactly as the prototype's were. A fixed date
// would leave the six-month recall tail wrong within a month, and the whole
// point of that data is to exercise the six-month boundary.
//
//   npm run prisma:seed        (safe to re-run — it truncates first)
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

const DAY_MS = 86_400_000;

/** Local midnight, `days` from today. */
function dayOffset(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/** An appointment instant: local midnight + "HH:mm". */
function at(days: number, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = dayOffset(days);
  d.setHours(h, m, 0, 0);
  return d;
}

function ago(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

const DEMO_PASSWORD = "rophe123";

async function main() {
  // Order matters: children before parents. Cheaper and clearer than relying
  // on cascade behaviour to get the order right.
  await prisma.auditLog.deleteMany();
  await prisma.portalAccessToken.deleteMany();
  await prisma.patientRequest.deleteMany();
  await prisma.message.deleteMany();
  await prisma.templateRevision.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.appointmentType.deleteMany();
  await prisma.availabilityException.deleteMany();
  await prisma.doctorAvailability.deleteMany();
  await prisma.session.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.clinicSettings.deleteMany();

  // --- Clinic settings ------------------------------------------------------
  // Every number here was questioned by the clinic at least once, which is why
  // they are rows rather than constants.
  await prisma.clinicSettings.create({ data: { id: "clinic" } });

  // --- Appointment types ----------------------------------------------------
  // The clinic's own list (Aug 2026). durationMinutes is the RETURNING-patient
  // length; a first visit uses ClinicSettings.firstVisitMinutes instead.
  const typeNames = [
    { name: "Dietician review", durationMinutes: 15, sortOrder: 1 },
    { name: "Diabetes review", durationMinutes: 15, sortOrder: 2 },
    { name: "Urologist review", durationMinutes: 15, sortOrder: 3 },
    { name: "General checkup", durationMinutes: 30, sortOrder: 4 },
    { name: "Follow up", durationMinutes: 15, sortOrder: 5 },
    { name: "Other specialist review", durationMinutes: 15, sortOrder: 6 },
  ];
  await prisma.appointmentType.createMany({ data: typeNames });
  const types = new Map(
    (await prisma.appointmentType.findMany()).map((t) => [t.name, t.id]),
  );

  // --- Staff ----------------------------------------------------------------
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const abena = await prisma.user.create({
    data: {
      email: "frontdesk@rophe.care",
      fullName: "Abena Owusu",
      staffId: "RSC-1042",
      jobTitle: "Front-desk Staff",
      role: "FRONT_DESK",
      status: "ACTIVE",
      passwordHash,
      activatedAt: ago(400),
    },
  });

  await prisma.user.create({
    data: {
      email: "reception@rophe.care",
      fullName: "Kofi Boateng",
      staffId: "RSC-1088",
      jobTitle: "Reception Assistant",
      role: "FRONT_DESK",
      status: "ACTIVE",
      passwordHash,
      activatedAt: ago(300),
    },
  });

  const mensahUser = await prisma.user.create({
    data: {
      email: "dr.mensah@rophe.care",
      fullName: "Dr. Akosua Mensah",
      staffId: "RSC-0001",
      jobTitle: "Specialist Physician",
      role: "DOCTOR",
      status: "ACTIVE",
      passwordHash,
      activatedAt: ago(400),
      doctor: { create: { specialty: "Specialist Physician" } },
    },
    include: { doctor: true },
  });
  const doctorId = mensahUser.doctor!.id;

  // An invitation mid-flight, so the staff screen has something to show and
  // the accept page can be exercised without creating one first. The token
  // hashes to the same value the frontend's demo link expects.
  const { hashToken } = await import("../src/lib/crypto");
  await prisma.user.create({
    data: {
      email: "gifty.amponsah@rophe.care",
      fullName: "Gifty Amponsah",
      staffId: "RSC-1104",
      jobTitle: "Reception Assistant",
      role: "FRONT_DESK",
      status: "INVITED",
      inviteTokenHash: hashToken("demo-invite-token"),
      inviteExpiresAt: new Date(Date.now() + 5 * DAY_MS),
      invitedAt: ago(2),
      invitedById: abena.id,
    },
  });

  // --- Availability ---------------------------------------------------------
  // Not a flat 9-5: Wednesday has a lunch gap, Thursday is afternoons only,
  // Monday is closed. Exactly the prototype's pattern.
  await prisma.doctorAvailability.createMany({
    data: [
      { doctorId, dayOfWeek: 2, startTime: "08:00", endTime: "12:00" },
      { doctorId, dayOfWeek: 3, startTime: "08:00", endTime: "12:30" },
      { doctorId, dayOfWeek: 3, startTime: "14:00", endTime: "17:00" },
      { doctorId, dayOfWeek: 4, startTime: "13:00", endTime: "17:00" },
      { doctorId, dayOfWeek: 5, startTime: "08:00", endTime: "12:00" },
    ],
  });

  // One date-specific closure, so the exceptions path has data from day one.
  await prisma.availabilityException.create({
    data: {
      doctorId,
      date: dayOffset(21),
      isClosed: true,
      reason: "Away — conference",
    },
  });

  // --- Patients -------------------------------------------------------------
  const patientSeed: {
    key: string;
    fullName: string;
    phone: string;
    whatsappNumber?: string;
    email?: string;
    dateOfBirth: string;
    preferredChannel: "WHATSAPP" | "SMS" | "EMAIL";
    registeredDays: number;
    notes?: string;
  }[] = [
    { key: "p1", fullName: "Kwabena Owusu", phone: "+233 24 123 4567", whatsappNumber: "+233 24 123 4567", email: "kwabena.owusu@gmail.com", dateOfBirth: "1987-03-14", preferredChannel: "WHATSAPP", registeredDays: 960, notes: "Prefers morning appointments." },
    { key: "p2", fullName: "Ama Serwaa", phone: "+233 20 987 6543", whatsappNumber: "+233 20 987 6543", email: "ama.serwaa@yahoo.com", dateOfBirth: "1992-07-22", preferredChannel: "WHATSAPP", registeredDays: 950 },
    { key: "p3", fullName: "Yaw Boateng", phone: "+233 27 555 0118", dateOfBirth: "1975-11-02", preferredChannel: "SMS", registeredDays: 935, notes: "SMS-only — no email on file." },
    { key: "p4", fullName: "Abena Dapaah", phone: "+233 24 444 7788", whatsappNumber: "+233 24 444 7788", email: "abena.dapaah@outlook.com", dateOfBirth: "1990-05-30", preferredChannel: "EMAIL", registeredDays: 925 },
    { key: "p5", fullName: "Kofi Asante", phone: "+233 20 332 1100", whatsappNumber: "+233 20 332 1100", dateOfBirth: "1983-09-18", preferredChannel: "SMS", registeredDays: 915 },
    { key: "p6", fullName: "Esi Mensimah", phone: "+233 26 901 2233", whatsappNumber: "+233 26 901 2233", email: "esi.mensimah@gmail.com", dateOfBirth: "1996-01-25", preferredChannel: "WHATSAPP", registeredDays: 905 },
    { key: "p7", fullName: "Kojo Frimpong", phone: "+233 24 778 9900", dateOfBirth: "1970-08-08", preferredChannel: "SMS", registeredDays: 895 },
    { key: "p8", fullName: "Adwoa Nyarko", phone: "+233 27 220 4411", whatsappNumber: "+233 27 220 4411", email: "adwoa.nyarko@gmail.com", dateOfBirth: "1988-12-19", preferredChannel: "WHATSAPP", registeredDays: 885 },
    { key: "p9", fullName: "Ekow Mensah", phone: "+233 20 664 3322", whatsappNumber: "+233 20 664 3322", dateOfBirth: "1979-06-11", preferredChannel: "WHATSAPP", registeredDays: 875 },
    { key: "p10", fullName: "Akua Tweneboah", phone: "+233 24 990 1122", email: "akua.tweneboah@gmail.com", dateOfBirth: "1994-02-28", preferredChannel: "EMAIL", registeredDays: 865 },
    { key: "p11", fullName: "Nana Yaw Darko", phone: "+233 26 335 7788", whatsappNumber: "+233 26 335 7788", dateOfBirth: "1985-10-05", preferredChannel: "WHATSAPP", registeredDays: 855 },
    { key: "p12", fullName: "Afia Pokuaa", phone: "+233 27 118 2200", dateOfBirth: "1998-04-16", preferredChannel: "SMS", registeredDays: 845 },
    { key: "p13", fullName: "Kwesi Appiah", phone: "+233 24 556 8899", whatsappNumber: "+233 24 556 8899", email: "kwesi.appiah@outlook.com", dateOfBirth: "1981-07-30", preferredChannel: "WHATSAPP", registeredDays: 835 },
    { key: "p14", fullName: "Eunice Adjei", phone: "+233 20 447 1133", dateOfBirth: "1993-09-09", preferredChannel: "SMS", registeredDays: 825 },
    { key: "p15", fullName: "Selorm Agbodzi", phone: "+233 26 772 5566", whatsappNumber: "+233 26 772 5566", email: "selorm.agbodzi@gmail.com", dateOfBirth: "1991-11-21", preferredChannel: "WHATSAPP", registeredDays: 815 },
    { key: "p16", fullName: "Mansa Asante-Boateng", phone: "+233 24 889 4400", email: "mansa.ab@yahoo.com", dateOfBirth: "1977-03-03", preferredChannel: "EMAIL", registeredDays: 805 },
    // The recall cohort — every shape the doctor described.
    { key: "p17", fullName: "Adjoa Frempong", phone: "+233 24 660 4412", whatsappNumber: "+233 24 660 4412", email: "adjoa.frempong@gmail.com", dateOfBirth: "1994-04-11", preferredChannel: "WHATSAPP", registeredDays: 280, notes: "Came in for a first consultation and did not rebook." },
    { key: "p18", fullName: "Yaw Ansah", phone: "+233 27 214 8890", dateOfBirth: "1968-12-05", preferredChannel: "SMS", registeredDays: 620, notes: "Hypertensive. Was attending regularly until last year." },
    { key: "p19", fullName: "Efua Boakye", phone: "+233 20 771 3025", whatsappNumber: "+233 20 771 3025", dateOfBirth: "1999-08-27", preferredChannel: "WHATSAPP", registeredDays: 300, notes: "Booked twice, did not attend either. No email on file." },
    { key: "p20", fullName: "Kojo Amankwah", phone: "+233 26 448 9071", dateOfBirth: "1981-02-19", preferredChannel: "SMS", registeredDays: 310, notes: "Record has no appointment against it — registration looks unfinished." },
    { key: "p21", fullName: "Naa Ayeley Quartey", phone: "+233 24 905 6612", whatsappNumber: "+233 24 905 6612", email: "naa.quartey@outlook.com", dateOfBirth: "1986-10-30", preferredChannel: "EMAIL", registeredDays: 400, notes: "Diabetes review patient — due back soon." },
    { key: "p22", fullName: "Kwame Antwi", phone: "+233 20 118 4457", whatsappNumber: "+233 20 118 4457", email: "kwame.antwi@gmail.com", dateOfBirth: "1972-06-14", preferredChannel: "WHATSAPP", registeredDays: 500, notes: "Lapsed, but a recall message went out this month." },
  ];

  const patients = new Map<string, string>();
  for (const p of patientSeed) {
    const row = await prisma.patient.create({
      data: {
        fullName: p.fullName,
        phone: p.phone,
        whatsappNumber: p.whatsappNumber,
        email: p.email,
        dateOfBirth: new Date(`${p.dateOfBirth}T00:00:00Z`),
        preferredChannel: p.preferredChannel,
        registeredAt: ago(p.registeredDays),
        notes: p.notes,
      },
    });
    patients.set(p.key, row.id);
  }

  // --- Appointments ---------------------------------------------------------
  // Durations agree with the rule: 40 for a first visit, else the type's own.
  const appts: [string, string, number, string, number, Prisma.AppointmentCreateInput["status"], string?][] = [
    // key, type, dayOffset, time, minutes, status, notes
    ["p1", "Dietician review", -28, "09:00", 40, "ATTENDED"],
    ["p4", "Follow up", -21, "10:30", 15, "ATTENDED"],
    ["p6", "Other specialist review", -14, "08:30", 45, "ATTENDED", "Longer slot — complex case."],
    ["p3", "Follow up", -7, "09:30", 15, "MISSED", "No-show, no prior notice."],
    ["p8", "Follow up", -5, "11:00", 15, "MISSED"],
    ["p11", "Diabetes review", -3, "09:00", 15, "MISSED"],
    ["p4", "General checkup", -2, "14:00", 30, "MISSED"],
    ["p13", "Follow up", -6, "10:00", 15, "MISSED"],
    ["p2", "Urologist review", -10, "11:30", 15, "RESCHEDULED"],
    // Established history, so return visits are genuinely return visits.
    ["p2", "Dietician review", -140, "09:00", 40, "ATTENDED"],
    ["p3", "Other specialist review", -125, "09:30", 40, "ATTENDED"],
    ["p5", "Diabetes review", -118, "10:00", 40, "ATTENDED"],
    ["p7", "General checkup", -110, "10:30", 40, "ATTENDED"],
    ["p8", "Urologist review", -102, "11:00", 40, "ATTENDED"],
    ["p9", "Dietician review", -96, "14:00", 40, "ATTENDED"],
    ["p10", "Diabetes review", -88, "14:30", 40, "ATTENDED"],
    ["p11", "Other specialist review", -80, "09:00", 40, "ATTENDED"],
    ["p12", "General checkup", -74, "09:30", 40, "ATTENDED"],
    ["p13", "Urologist review", -68, "10:00", 40, "ATTENDED"],
    ["p14", "Dietician review", -61, "10:30", 40, "ATTENDED"],
    ["p15", "Diabetes review", -55, "11:00", 40, "ATTENDED"],
    ["p16", "Other specialist review", -48, "14:00", 40, "ATTENDED"],
    // Today and ahead.
    ["p5", "Follow up", 0, "09:00", 15, "CONFIRMED"],
    ["p9", "Follow up", 0, "10:00", 15, "CONFIRMED"],
    ["p12", "Diabetes review", 0, "11:00", 15, "BOOKED"],
    ["p7", "Follow up", 2, "09:30", 15, "BOOKED"],
    ["p10", "General checkup", 3, "14:00", 30, "CONFIRMED"],
    ["p13", "Urologist review", 5, "10:30", 15, "BOOKED"],
    ["p15", "Dietician review", 7, "09:00", 15, "BOOKED"],
    ["p16", "Diabetes review", 9, "11:30", 15, "CONFIRMED"],
    ["p14", "Follow up", 12, "10:00", 15, "BOOKED"],
    // The six-month tail.
    ["p17", "Dietician review", -245, "09:00", 40, "ATTENDED", "First consultation. Advised to return in 6 weeks."],
    ["p18", "Other specialist review", -600, "08:30", 40, "ATTENDED"],
    ["p18", "Other specialist review", -520, "10:00", 15, "ATTENDED"],
    ["p18", "Other specialist review", -425, "10:15", 15, "ATTENDED", "BP stable on current dose. Review in 3 months."],
    ["p19", "General checkup", -285, "11:00", 40, "MISSED", "No-show. Rebooked over the phone."],
    ["p19", "General checkup", -215, "09:30", 40, "MISSED", "No-show again. Phone rang out."],
    ["p21", "Diabetes review", -160, "14:00", 40, "ATTENDED"],
    ["p22", "General checkup", -215, "08:00", 40, "ATTENDED"],
  ];

  const created: { key: string; id: string }[] = [];
  for (const [key, typeName, days, time, minutes, status, notes] of appts) {
    const row = await prisma.appointment.create({
      data: {
        patientId: patients.get(key)!,
        doctorId,
        typeId: types.get(typeName)!,
        startsAt: at(days, time),
        durationMinutes: minutes,
        status,
        notes,
        createdAt: ago(Math.abs(days) + 7),
      },
    });
    created.push({ key, id: row.id });
  }

  const firstFor = (key: string) => created.find((c) => c.key === key)!.id;

  // --- Message templates ----------------------------------------------------
  const seededAt = ago(21);
  await prisma.messageTemplate.createMany({
    data: [
      { type: "CONFIRMATION", description: "Sent as soon as an appointment is booked.", body: "Hello {{first_name}}, your appointment with {{doctor}} is confirmed for {{date}} at {{time}}. Call {{clinic_phone}} if you need to change it.", emailSubject: "Your appointment is confirmed — {{clinic_name}}", updatedByName: "Abena Owusu", updatedAt: seededAt },
      { type: "REMINDER", description: "Sent the day before an appointment.", body: "Hello {{first_name}}, a reminder of your appointment tomorrow, {{date}} at {{time}}, with {{doctor}}. Please arrive 10 minutes early.", emailSubject: "Reminder: your appointment on {{date}}", updatedByName: "Abena Owusu", updatedAt: seededAt },
      { type: "FOLLOW_UP", description: "Sent after a missed appointment.", body: "Hello {{first_name}}, we missed you at {{clinic_name}} on {{date}}. Call {{clinic_phone}} to book another time — we would love to see you.", emailSubject: "We missed you at {{clinic_name}}", updatedByName: "Abena Owusu", updatedAt: seededAt },
      { type: "RECALL", description: "Sent to a patient who has not been seen for six months.", body: "Hello {{first_name}}, we have not seen you at {{clinic_name}} since {{last_visit}}. If you are due a check-up, call {{clinic_phone}} and we will find you a time.", emailSubject: "It has been a while — {{clinic_name}}", updatedByName: "Abena Owusu", updatedAt: seededAt },
      { type: "BIRTHDAY", description: "Sent on the patient's birthday.", body: "Happy birthday, {{first_name}}! Everyone at {{clinic_name}} wishes you a wonderful year ahead and good health always.", emailSubject: "Happy birthday from {{clinic_name}}!", updatedByName: "Abena Owusu", updatedAt: seededAt },
    ],
  });

  // --- Messages -------------------------------------------------------------
  // Includes a FAILED delivery, because that state is the whole point of the
  // audit log: a reminder stuck on "sent" is possibly the clinic's fault.
  await prisma.message.createMany({
    data: [
      { patientId: patients.get("p22")!, channel: "WHATSAPP", type: "RECALL", sentAt: ago(12), deliveryStatus: "DELIVERED", deliveredAt: ago(12), body: "Hello Kwame, we have not seen you at Rophe Specialist Care since January. Call 020 152 9933 to book a visit." },
      { patientId: patients.get("p18")!, channel: "SMS", type: "RECALL", sentAt: ago(95), deliveryStatus: "FAILED", providerError: "Handset unreachable past expiry window", body: "Hello Yaw, it has been a while since your last review. Call 020 152 9933 to book a visit." },
      { patientId: patients.get("p1")!, appointmentId: firstFor("p1"), channel: "WHATSAPP", type: "CONFIRMATION", sentAt: ago(35), deliveryStatus: "DELIVERED", deliveredAt: ago(35), body: "Your appointment on Monday 3 March at 09:00 is confirmed." },
      { patientId: patients.get("p1")!, appointmentId: firstFor("p1"), channel: "WHATSAPP", type: "REMINDER", sentAt: ago(29), deliveryStatus: "DELIVERED", deliveredAt: ago(29), body: "Reminder: appointment tomorrow at 09:00 with Dr. Mensah." },
      { patientId: patients.get("p4")!, appointmentId: firstFor("p4"), channel: "EMAIL", type: "CONFIRMATION", sentAt: ago(28), deliveryStatus: "DELIVERED", deliveredAt: ago(28), emailSubject: "Your appointment is confirmed", body: "Appointment confirmed for Monday 10 March at 10:30." },
      { patientId: patients.get("p3")!, appointmentId: firstFor("p3"), channel: "SMS", type: "FOLLOW_UP", sentAt: ago(6), deliveryStatus: "DELIVERED", deliveredAt: ago(6), body: "We missed you yesterday. Call 020 152 9933 to rebook." },
      { patientId: patients.get("p6")!, channel: "WHATSAPP", type: "BIRTHDAY", sentAt: ago(40), deliveryStatus: "DELIVERED", deliveredAt: ago(40), body: "Happy birthday, Esi! Everyone at Rophe Specialist Care wishes you good health." },
    ],
  });

  // --- Pending requests -----------------------------------------------------
  await prisma.patientRequest.createMany({
    data: [
      { appointmentId: firstFor("p12"), patientId: patients.get("p12")!, requestType: "RESCHEDULE", requestedStartsAt: at(4, "10:00"), reason: "Travelling for work that morning.", createdAt: ago(1) },
      { appointmentId: firstFor("p15"), patientId: patients.get("p15")!, requestType: "CANCELLATION", reason: "Feeling much better, will rebook if needed.", createdAt: ago(2) },
      { appointmentId: firstFor("p7"), patientId: patients.get("p7")!, requestType: "RESCHEDULE", requestedStartsAt: at(9, "09:30"), createdAt: ago(1) },
    ],
  });

  const counts = {
    patients: await prisma.patient.count(),
    appointments: await prisma.appointment.count(),
    staff: await prisma.user.count(),
    messages: await prisma.message.count(),
    requests: await prisma.patientRequest.count(),
    types: await prisma.appointmentType.count(),
  };
  console.log("Seeded:", counts);
  console.log(`Demo password for every active account: ${DEMO_PASSWORD}`);
  console.log("Pending invite link token: demo-invite-token");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

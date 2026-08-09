# Rophe Specialist Care — Smart Digital Appointment & Patient Follow-up System
## Prototype PRD (Phase 1: UI + Dummy Data)

**Purpose of this document:** This PRD is for building an interactive, click-through prototype in Bolt.new. It is **UI/UX only** — no real backend, no real authentication, no real database, no real messaging integrations. All data is mocked/seeded in-app so the client can click through every screen and feel like they are using the real product. Once the client reviews and approves this prototype, the UI is locked and becomes the source of truth for database design (Phase 2) and backend build (Phase 3).

**Explicit build constraints for Bolt.new:**
- ~~No real auth — use a simple role switcher instead of login screens.~~ **Superseded:** the prototype now has a staff sign-in screen (`/login`) with seeded demo accounts. It is still not security — credentials are checked in the browser against mock data and the session lives in `localStorage`. Phase 3 replaces it with hashed credentials and a server-issued session. Patients still never sign in.
- No real API calls, no real WhatsApp/SMS/email sending — simulate these (e.g., show a "message sent" toast/log entry, don't actually send anything).
- No real persistence required across sessions — in-memory state or local mock JSON is fine. Data can reset on refresh; that's acceptable for a prototype.
- Field names and data shapes used in the mock data should match what's listed in "Data Model (Mock)" below — this becomes the reference for the real database schema later, so consistency now saves rework.

## 0. Target Repo Alignment (read this first)

This prototype is not a throwaway — the frontend code Bolt.new produces is meant to be ported into an existing scaffolded repo (`Rophe_Appointment_System`). Build accordingly:

**Tech stack — match exactly:**
- Next.js 16, App Router (not Pages Router), React 19, TypeScript, Tailwind CSS (v3)
- Tailwind is the only CSS framework — no second styling system
- Component layer: **shadcn/ui** (copy-in components built on Radix primitives), already vendored into `components/ui/`. Compose from these rather than adding another component library. Supporting libs already in use and fair game: `lucide-react` (icons), `react-hook-form` + `zod` (forms), `sonner` (toasts), `date-fns`, `class-variance-authority` / `clsx` / `tailwind-merge`.

**Folder/naming conventions to follow**, so output can be copied into `client/src/` with minimal restructuring:
```
src/
  app/            # pages & layouts (App Router) — one folder per route
  components/     # reusable UI components
    ui/           # shadcn/ui primitives (generated — don't hand-edit casually)
  hooks/          # shared React hooks
  lib/            # helpers, types, status colors, and the mock API client (see below)
  styles/
```
Routes as actually built (these are canonical — the screen list in Section 3 maps onto them):

| Screen | Route |
|---|---|
| Staff sign-in | `/login` (public; renders without app chrome) |
| Staff dashboard | `/` (doctors are redirected to `/doctor`) |
| Patients list / detail / add / edit | `/patients`, `/patients/[id]`, `/patients/new`, `/patients/[id]/edit` |
| Appointments calendar / book / reschedule | `/appointments`, `/appointments/book`, `/appointments/[id]/reschedule` |
| Message log | `/messages` |
| Pending requests | `/requests` |
| Doctor dashboard / availability / schedule | `/doctor`, `/doctor/availability`, `/doctor/schedule` |
| Patient-facing page | `/portal/appointment/[id]` |

**Critical: build the mock data layer as a swappable API client.** The real backend already has starter endpoints defined:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/patients` | List patients |
| POST | `/api/patients` | Create a patient |
| GET | `/api/appointments` | List appointments |
| POST | `/api/appointments` | Book an appointment |
| PATCH | `/api/appointments/:id/status` | Update appointment status |

Instead of calling mock data directly from components, put all data access behind functions in `lib/api.ts` with names and signatures that mirror these endpoints exactly. Internally these functions just return/mutate mock in-memory data now. When the real backend is ready, only `lib/api.ts` needs to change from mock logic to real `fetch(NEXT_PUBLIC_API_URL + ...)` calls — components stay untouched.

The mock client as built (functions beyond the starter table need adding to the real API too):

| Function | Future endpoint |
|---|---|
| `getPatients()` | GET `/api/patients` |
| `getPatient(id)` | GET `/api/patients/:id` |
| `createPatient(input)` | POST `/api/patients` |
| `updatePatient(id, input)` | PATCH `/api/patients/:id` |
| `getAppointments()` | GET `/api/appointments` |
| `getAppointment(id)` | GET `/api/appointments/:id` |
| `bookAppointment(input)` | POST `/api/appointments` |
| `updateAppointment(id, input)` | PATCH `/api/appointments/:id` |
| `updateAppointmentStatus(id, status)` | PATCH `/api/appointments/:id/status` |
| `getMessages()` | GET `/api/messages` |
| `sendMessage(input)` | POST `/api/messages` — simulated in the prototype; the real one hands off to the WhatsApp/SMS/email provider |
| `updateMessageDeliveryStatus(id, status)` | PATCH `/api/messages/:id` — **called by the provider's delivery webhook**, not by the UI |
| `onMessagesChanged(listener)` | No endpoint — prototype-only subscription standing in for the websocket/poll that pushes delivery receipts to an open message log |
| `getPendingRequests()` | GET `/api/requests` — returns the whole queue, resolved rows included |
| `createPatientRequest(input)` | POST `/api/requests` — submitted from the patient-facing page; never touches the appointment |
| `respondToRequest(id, decision)` | PATCH `/api/requests/:id` — confirming cascades to the linked appointment |
| `getDoctorAvailability(doctorId)` | GET `/api/doctors/:id/availability` |
| `setDoctorDayAvailability(doctorId, dayOfWeek, windows)` | PUT `/api/doctors/:id/availability/:day` — replaces that day's windows wholesale |
| `getDoctors()` | GET `/api/doctors` |
| `signIn({ email, password })` | POST `/api/auth/login` — browser-side credential check in the prototype; the real one issues a session cookie |
| `getStaffUsers()` | GET `/api/staff` — used only to list demo accounts on the login screen |

Conventions every function follows, so the swap stays mechanical: `async`, returns a Promise resolved after a short simulated latency, reads return copies of the mock arrays, writes mutate the arrays in `lib/mockData.ts` and return the new/updated record. Inputs are typed (`CreatePatientInput`, `BookAppointmentInput`, `RequestDecision`) and all entity shapes live in `lib/types.ts`.

This single constraint is what makes "build on after" actually true — skipping it means re-wiring every component later instead of swapping one file.

---

## 1. Product Overview

A single web application (desktop, tablet, and mobile browser) replacing Rophe Specialist Care's paper appointment diary and manual patient follow-up process. It has five connected areas: Patient Records, Appointment & Scheduling, Automated Messaging (simulated in prototype), Dashboard, and Follow-up & Reporting.

## 2. User Roles & Access Pattern

Build **one application**. Staff sign in at `/login`; the signed-in account's role decides the navigation, the landing page, and which actions are available. Patients never sign in — they open a link.

| Role | Who | How they get in | Prototype access |
|---|---|---|---|
| Front-desk Staff | Primary/admin user | Sign-in | Full access to all modules below |
| Doctor | Host doctor | Sign-in | Read-focused: schedule, availability settings, patient history, dashboard |
| Patient | No account | Link to `/portal/appointment/:id` | Single lightweight page only — no dashboard access |

**Seeded demo accounts** (all use password `rophe123`, defined in `lib/mockData.ts`):

| Email | Name | Role |
|---|---|---|
| `frontdesk@rophe.care` | Abena Owusu | Front-desk Staff |
| `reception@rophe.care` | Kofi Boateng | Front-desk Staff |
| `dr.mensah@rophe.care` | Dr. Akosua Mensah | Doctor (linked to `doc-1`) |

The login screen lists these and fills the form on tap, so a reviewer never has to be told the password. Signing out returns to `/login`; the account menu also has a "Preview patient view" shortcut, which is how you reach the patient page during a demo now that the role switcher is gone.

## 3. Screens to Build

### 3.1 Front-desk Staff View
1. **Dashboard (home screen)** — today's appointments, upcoming appointments this week, missed-visit list, pending follow-ups action list, quick stats (attendance rate this week, appointments booked today).
2. **Patients** — searchable/filterable list of all patients → click into a **Patient Detail** page showing contact info, preferred channel, DOB, full visit history, and linked appointments.
3. **Add/Edit Patient** — form: name, phone (required), WhatsApp number, email (optional), DOB, preferred communication channel (dropdown: WhatsApp/SMS/Email), notes.
4. **Appointments — Calendar View** — day/week/list toggle, color-coded by status (booked, confirmed, attended, missed, rescheduled), click a slot to book, click an appointment to view/edit/cancel/reschedule.
5. **Book/Reschedule Appointment** — form: select patient (search or "new patient"), appointment type, date/time (constrained to doctor's declared available slots — show unavailable slots as disabled/greyed), duration, notes.
6. **Message Log** — table: patient, channel, message type (confirmation/reminder/follow-up/birthday), timestamp, delivery status (sent/delivered/failed — mocked).
7. **Pending Requests** — list of patient-submitted reschedule/cancellation requests awaiting staff confirm/decline.

### 3.2 Doctor View
1. **Dashboard** — same shape as staff dashboard but read-focused, lighter, less clutter.
2. **My Availability** — set/edit available days and time slots (simple weekly grid, click to toggle slots open/closed).
3. **My Schedule** — day/week/list views of their own appointments.
4. **Patient History (read-only)** — view a patient's visit history from the schedule.

### 3.3 Patient-Facing Page (no login)
1. **Appointment View** — single page reached via a "secure link" (a mock URL param, `/portal/appointment/:appointmentId`, in the prototype). Shows: date, time, doctor name, clinic location/address, appointment type.
2. **Actions on this page:** "Confirm Attendance" button, "Request Reschedule" (opens a simple date/time preference picker), "Request Cancellation" (with optional reason field). All three should show a confirmation message like *"Request sent — our staff will confirm shortly"* rather than instantly changing the schedule (this mirrors the real system: staff retains control).
3. **Clinic info footer** — location, contact number, map or address text.

## 4. Data Model (Mock)

Seed data should follow these shapes. Use realistic Ghanaian names/phone formats since the clinic is in Ghana. Field names use camelCase to match Prisma/TypeScript conventions already used in the target repo (`server/prisma/schema.prisma`), so this doubles as a draft of the future Prisma models.

**Patient**
```
{
  id, fullName, phone (required), whatsappNumber, email (optional),
  dateOfBirth, preferredChannel: "whatsapp" | "sms" | "email",
  registeredDate, notes
}
```

**Appointment**
```
{
  id, patientId, doctorId, appointmentType, date, time, durationMinutes,
  status: "booked" | "confirmed" | "attended" | "missed" | "rescheduled" | "cancelled",
  createdAt, notes
}
```

> **Added during build:** `"cancelled"`. The calendar needs a cancel action (Section 3.1 #4), and the original five statuses had no state for "called off in advance." Reusing `"missed"` would have corrupted the dashboard's attendance-rate stat, and deleting the row would destroy the audit trail. Confirm this with the clinic — see Section 8.

**DoctorAvailability**
```
{
  doctorId, dayOfWeek, startTime, endTime, isAvailable
}
```

> **Clarified during build:** a day may hold **several** rows, so the doctor can work 08:00–12:30 and 14:00–17:00 with a lunch gap — the availability grid writes back the fewest merged windows covering the slots she left open. A closed day simply has no rows. The field shape is unchanged from the original spec.

**Message (simulated log)**
```
{
  id, patientId, appointmentId, channel: "whatsapp" | "sms" | "email",
  type: "confirmation" | "reminder" | "follow-up" | "birthday",
  sentAt, deliveryStatus: "sent" | "delivered" | "failed", contentPreview
}
```

> **`deliveryStatus` means three different levels of confidence, and the distinction is the point of the audit log:**
> - **sent** — handed to the provider and accepted. *Nobody has confirmed the patient received it.*
> - **delivered** — the provider confirmed it reached the patient's device (WhatsApp's second tick, an SMS delivery receipt, acceptance by the recipient's mail server).
> - **failed** — rejected or undeliverable: wrong number, handset off past the expiry window, blocked sender, bounced email.
>
> This matters when someone no-shows: a reminder stuck on "sent" is possibly the clinic's problem, one marked "delivered" is not. Every message starts at `sent` and resolves ~1.5–3s later, simulating the provider callback (`SIMULATED_FAILURE_RATE` in `lib/api.ts` controls how often one fails — set it to 0 for a clean demo).

**PatientRequest**
```
{
  id, appointmentId, patientId, requestType: "reschedule" | "cancellation",
  requestedDate, requestedTime, reason, status: "pending" | "confirmed" | "declined"
}
```

## 5. Seed Data Requirements

- **10–20 patients** with varied preferred channels (mix of WhatsApp/SMS/email), some with missing email (SMS-only fallback scenario).
- **Appointments spanning past and future dates**, with a realistic mix of all 5 statuses — include enough "missed" appointments to populate the follow-up action list meaningfully, and enough "attended" history to make a patient's visit history look real.
- **A doctor availability pattern** that isn't a flat 9-5 — reflect the "shifts with her availability" detail from the proposal (e.g., some days fully booked/unavailable, some with only afternoon slots).
- **Message log with 15+ entries** across all types and channels, including at least one "failed" delivery status to show that state exists.
- **2-3 pending patient requests** (mix of reschedule and cancellation) sitting in the staff queue, unresolved.

## 6. Key Interaction Flows to Demonstrate

1. **Core booking flow:** Staff searches/finds patient → checks doctor availability → books slot → system shows a simulated confirmation message being "sent."
2. **Missed appointment → follow-up:** Staff marks an appointment "missed" → it appears on the dashboard follow-up action list → staff triggers a follow-up message (simulated) → appears in message log.
3. **Patient self-service request:** From the patient-facing page, patient requests a reschedule → it appears in the staff "Pending Requests" queue → staff confirms or declines → status updates accordingly.
4. **Doctor availability change:** Doctor toggles a day/slot off → previously bookable slots in the staff calendar view immediately reflect as unavailable.

## 7. Explicitly Out of Scope for This Prototype

- Real authentication/login
- Real WhatsApp/SMS/email sending (simulate only)
- Real data persistence/database
- Payments, clinical notes, multi-doctor support, or any item listed under "Future Enhancements" in the client proposal

## 8. UI Lock Criteria (client sign-off checklist)

Before treating the UI as locked and moving to database design, get explicit client confirmation on:
- [ ] Navigation structure and module names make sense to staff/doctor
- [ ] Booking flow matches how the doctor's availability actually works in practice
- [ ] Dashboard shows the right things staff actually check daily
- [ ] Patient-facing page has all information a patient needs, and nothing confusing
- [ ] Message log fields are what staff would actually want to audit
- [ ] Patient form fields match what's really captured

 at registration (cross-check against proposal's open question #1: sample paper data)
- [ ] Appointment statuses (booked/confirmed/attended/missed/rescheduled/**cancelled**) match clinic's actual workflow language — in particular, does the clinic distinguish "cancelled in advance" from "missed"? The attendance-rate stat depends on the answer.

## 8b. Open Questions Raised During the Build

Decisions made to keep building, each reversible. Confirm these alongside the Section 8 checklist:

1. **`cancelled` appointment status added** (Section 4). The clinic needs a state for "called off in advance"; reusing `missed` would corrupt the attendance-rate stat and wrongly trigger follow-up chasing. → *Does the clinic distinguish the two?*
2. **"Booked today" stat** counts appointments *scheduled for* today with status `booked`, not appointments *created* today. → *Which does front desk actually want?* One-line change either way.
3. ~~**Clinic contact details are placeholders**~~ **Resolved** — real details supplied and in `src/lib/clinic.ts`: Baiden Ave 1st St, Accra · 020 152 9933. The clinic logo (`public/images/rophe-logo.png`) is now the top-nav mark, the patient-page header, and the browser favicon.
4. **"Confirm Attendance" changes the appointment to `confirmed`** rather than queuing a staff request. It doesn't alter the schedule, so staff keep control of date/time, and it avoids a queue full of items needing no decision. → *Confirm this matches how the clinic wants confirmations handled.*
5. **Patients are notified when staff confirm or decline a request** (simulated message). Every other action affecting an appointment messages the patient, and a silent decline leaves someone waiting. → *Confirm the clinic wants this, since it adds message-log volume.*
6. **Appointment types** are a fixed list (Consultation, Follow-up, Hypertension Review, Diabetes Review, General Check-up). → *Is this the real list?*
7. **Availability is a repeating weekly pattern, with no one-off exceptions.** `DoctorAvailability` keys on `dayOfWeek`, so the doctor sets the hours she *normally* works and they apply to every week. There is no way to say "I'm away Thursday the 21st" — closing that slot would close every Thursday. In practice a clinic needs both. → *How does the doctor currently handle a single day off, and should Phase 2 add date-specific exceptions (an `AvailabilityException` table keyed on a real date) or leave front desk to move the affected appointments by hand?* The availability screen currently states the limitation in plain English rather than pretending it doesn't exist.

## 9. Design Notes

**Brand palette — sampled from `public/images/rophe-logo.png`, defined in `tailwind.config.ts`:**

| Token | Hex | Source in the logo |
|---|---|---|
| `brand-600` | `#485889` | The "ROPHE" wordmark navy (exact sample) |
| `brand-400` | `#7c8cbb` | The stethoscope ring |
| `brand-800` | `#2b375a` | Darkened for primary buttons and the sign-in CTA |
| `clinic-red-500` | `#e8171e` | The cross and "SPECIALIST CARE" |

**Scope: the brand navy is used on the sign-in screen only.** It was trialled across the whole app and reverted — at the tints needed for hovers and active states, a navy that matches the logo sits too close to slate grey to read as a colour at all (`brand-100` vs `slate-100` measured 1.08:1, effectively invisible), which made the availability grid's open and closed slots indistinguishable. The rest of the app keeps its original teal accent, which holds far more chroma at 50–100 and stays legible against grey.

So: **teal** for every in-app interactive element (buttons, hovers, focus rings, active nav, selected slots); **brand navy** for `/login`; **clinic red** for the logo and nothing else — red reads as destructive in an interface. Appointment/delivery/request status colours stay on their own semantic scale (`lib/status-styles.ts`).

- Keep the UI clean, minimal-training-required — this is explicitly called out in the proposal as a client priority.
- Prioritize desktop for staff/doctor views (front desk likely uses a desktop/tablet); prioritize mobile-first for the patient-facing page (patients open it from a phone message link).
- Use color coding for appointment status consistently across calendar, dashboard, and patient detail views.
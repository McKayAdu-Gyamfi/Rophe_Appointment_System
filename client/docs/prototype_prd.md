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
| Patient recalls | `/recalls` |
| Staff accounts | `/staff` |
| Accept a staff invitation | `/invite/[token]` (public; renders without app chrome) |
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
| `getPatientRecalls()` | GET `/api/recalls` — every patient with a visit summary attached; the screen filters |
| `getPatientVisitSummary(id)` | GET `/api/patients/:id/visits` — one patient's last-visit/recall standing |
| `getDoctorAvailability(doctorId)` | GET `/api/doctors/:id/availability` |
| `setDoctorDayAvailability(doctorId, dayOfWeek, windows)` | PUT `/api/doctors/:id/availability/:day` — replaces that day's windows wholesale |
| `getDoctors()` | GET `/api/doctors` |
| `signIn({ email, password })` | POST `/api/auth/login` — browser-side credential check in the prototype; the real one issues a session cookie |
| `getStaffUsers()` | GET `/api/staff` — the staff list, and the demo accounts on the login screen |
| `inviteStaffUser(input)` | POST `/api/staff/invitations` — creates an account with no password and returns a one-time token |
| `getStaffInvitation(token)` | GET `/api/staff/invitations/:token` — what the joiner is accepting |
| `acceptStaffInvitation(token, password)` | POST `/api/staff/invitations/:token/accept` — the only call that can set a password |
| `resendStaffInvitation(id)` | POST `/api/staff/invitations/:id/resend` — issues a new token, invalidating the old |
| `revokeStaffInvitation(id)` | DELETE `/api/staff/invitations/:id` — only ever removes an unaccepted invitation |

Conventions every function follows, so the swap stays mechanical: `async`, returns a Promise resolved after a short simulated latency, reads return copies of the mock arrays, writes mutate the arrays in `lib/mockData.ts` and return the new/updated record. Inputs are typed (`CreatePatientInput`, `BookAppointmentInput`, `RequestDecision`) and all entity shapes live in `lib/types.ts`.

This single constraint is what makes "build on after" actually true — skipping it means re-wiring every component later instead of swapping one file.

---

## 1. Product Overview

A single web application (desktop, tablet, and mobile browser) replacing Rophe Specialist Care's paper appointment diary and manual patient follow-up process. It has five connected areas: Patient Records, Appointment & Scheduling, Automated Messaging (simulated in prototype), Dashboard, and Follow-up & Reporting.

## 2. User Roles & Access Pattern

Build **one application**. Staff sign in at `/login`; the signed-in account's role decides the navigation, the landing page, and which actions are available. Patients never sign in — they open a link.

| Role | Who | How they get in | Prototype access |
|---|---|---|---|
| Front-desk Staff | Primary/admin user | Sign-in | Full access to all modules below, including inviting new staff |
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
8. **Staff Accounts** — list of staff and pending invitations; invite a new doctor or front-desk colleague. Added after clinic feedback — see Section 4b.
9. **Patient Recalls** — the six-month sweep. Patients the clinic has not seen for `RECALL_MONTHS`, with how long they have been quiet, why, and their preferred channel; select a batch and send. Added after clinic feedback — see Section 4a.

### 3.2 Doctor View
1. **Dashboard** — same shape as staff dashboard but read-focused, lighter, less clutter.
2. **My Availability** — set/edit available days and time slots (simple weekly grid, click to toggle slots open/closed).
3. **My Schedule** — day/week/list views of their own appointments.
4. **Patient History (read-only)** — view a patient's visit history from the schedule.

### 3.2b Staff Invitation Page (no login)
1. **Accept invitation** — reached from a one-time link at `/invite/:token`. Shows who invited them, the email they will sign in with, their role and staff ID, all read-only, and the one thing they supply: a password of their own choosing. Renders without app chrome, like `/login`.
2. An expired, withdrawn or already-used link says so plainly and points at the front desk, rather than failing as a blank page.

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
  type: "confirmation" | "reminder" | "follow-up" | "recall" | "birthday",
  sentAt, deliveryStatus: "sent" | "delivered" | "failed", contentPreview
}
```

> **Added during build:** `"recall"`. Six-month outreach is not tied to any one
> appointment, so it cannot be a `follow-up` (which chases a specific missed
> visit) without making both untrackable in the log. It has its own template,
> and its own merge field `{{last_visit}}`.

> **`deliveryStatus` means three different levels of confidence, and the distinction is the point of the audit log:**
> - **sent** — handed to the provider and accepted. *Nobody has confirmed the patient received it.*
> - **delivered** — the provider confirmed it reached the patient's device (WhatsApp's second tick, an SMS delivery receipt, acceptance by the recipient's mail server).
> - **failed** — rejected or undeliverable: wrong number, handset off past the expiry window, blocked sender, bounced email.
>
> This matters when someone no-shows: a reminder stuck on "sent" is possibly the clinic's problem, one marked "delivered" is not. Every message starts at `sent` and resolves ~1.5–3s later, simulating the provider callback (`SIMULATED_FAILURE_RATE` in `lib/api.ts` controls how often one fails — set it to 0 for a clean demo).

**StaffUser** *(added Section 4b — the account, not the person's clinical record)*
```
{
  id, fullName, email, password?, role: "front-desk" | "doctor",
  staffId, jobTitle, doctorId?,
  status: "invited" | "active",
  inviteToken?, invitedAt, invitedBy, activatedAt?
}
```

> `password` is **optional on purpose**: it does not exist between the moment
> front desk creates the account and the moment the joiner sets one. The type
> carries that fact so nothing downstream can assume a password is present.
> `inviteToken` is single-use and deleted on activation; neither it nor the
> password appears in `StaffSession`, which is what the app holds in memory.

**PatientRequest**
```
{
  id, appointmentId, patientId, requestType: "reschedule" | "cancellation",
  requestedDate, requestedTime, reason, status: "pending" | "confirmed" | "declined"
}
```

## 4a. Clinic Feedback — Visit Length & the Six-Month Recall

Two pieces of feedback from the clinic (WhatsApp, August 2026) that changed the
model rather than just the wording. Both are recorded here because both rest on
a definition the software had to be given.

### Appointment length follows the patient, not the booker

> *"First time patients is 40mins · Follow-up is 15mins"*

Duration was previously a free dropdown defaulting to 30 minutes, and **40 was
not even an option** — the clinic's own first-visit length could not be
expressed. It is now derived from two facts the system already holds, in
`lib/appointment-types.ts`:

| Situation | Minutes |
|---|---|
| Patient has no completed visit on record | **40** |
| Returning · Follow up, and every "… review" | **15** |
| Returning · General checkup | 30 (unchanged) |

The booking form pre-fills this and **states why** ("First visit — the clinic
allows 40 minutes for a new patient"). Front desk can still override for a
complicated case; the override sticks, is marked as hand-set, and offers one
click back to the rule.

A first visit wins over the appointment type. This matters more under the
clinic's own type list (Section 4c) than it did under the guessed one: the type
now names the *service*, not the stage, so a brand-new patient books "Dietician
review" like everyone else — and still needs the full 40 minutes.

Note that "first visit" means **no *attended* visit**. A patient who booked last
month and no-showed is still someone the doctor has never met.

### "Not showing up for the past 6 months"

The original request was ambiguous, and the thread settled it:

> **Question:** *is it they booked an appointment and never came … or after their
> first consultation they never came back?*
>
> **Answer:** *"It covers all you have mentioned — whether they booked and never
> showed up, whether they just never came again after they came once … the 6
> months is basically covering when last they visited the clinic."*

So there is **one clock — time since they were last actually seen** — and the
route they took into silence changes only what staff say on the call, not
whether the patient is on the list. The recall screen therefore shows a
*reason* on every row rather than splitting the list into separate reports:

| Reason | Meaning |
|---|---|
| Stopped returning | Attended at least once, then stopped |
| Never attended | Booked at least once, never actually came |

These are exactly the two cases the doctor described, and there is no third.

**Three exclusions, all deliberate:**

1. **A patient with a visit already booked is never on the list.** They are
   coming back; calling to ask why they never return reads as a clinic that
   does not check its own diary.
2. **A patient who no-showed last week is not on it either.** They belong to the
   dashboard's *missed-visit follow-up* list, which chases within days. The
   recall sweep is the long tail behind it. So eligibility is measured from the
   last contact of *any* kind, while the date on screen stays what the doctor
   asked for — when they were last actually seen.
3. **A record with no appointment at all is not a recall.** *Confirmed with the
   clinic:* registration and booking always happen together — nobody goes on the
   register without a visit and a booking in the same breath. So a patient row
   with zero appointments is not someone who went quiet, it is an unfinished
   registration or a duplicate. Its only date is the day someone typed it in,
   which says nothing about whether the clinic ever had a relationship with that
   person. These sit in a **Needs checking** tab to be corrected or removed, and
   never receive a message — a recall system that texts people six months after
   a half-finished form is chasing its own bad data.

**A recall is a batch job, not a row action.** Front desk selects everyone due
and sends in one sweep, each on the patient's preferred channel, using the
clinic-owned `recall` template. Anyone contacted within `RECALL_COOLDOWN_DAYS`
moves to a *Contacted* tab so the next sweep skips them — a recall system that
texts the same person weekly stops being read.

**Thresholds** (`lib/visits.ts`, one line each to change): `RECALL_MONTHS = 6`,
`LAPSING_MONTHS = 5` (a warning band, so the list never arrives cold),
`RECALL_COOLDOWN_DAYS = 30`.

Nothing is stored: "lapsed" is not a state a patient is put into, it is what
falls out of the diary the moment nobody books them. A stored flag would need
something to remember to clear it when they finally come back.

## 4b. Clinic Feedback — Staff Accounts

> *"The front-desk staff should be able to add a new user (that is a doctor), or
> another front desk staff … where they set up like their email and then the new
> person creates their own password."*

Front desk creates the account; the joiner creates the credentials. The split is
the requirement, and it is also the only version worth building — any flow where
a colleague picks your password ends with that password being read out across a
desk, and with no way to tell afterwards who actually signed in.

**The flow, in two halves:**

1. **`/staff` (front desk).** Full name, work email, role (Front desk or Doctor),
   job title, and a specialty for doctors. **There is no password field, and its
   absence is the feature.** Submitting creates an account with `status:
   "invited"`, no password at all, and a single-use token. The prototype shows
   the resulting link on screen to copy, because nothing here can send email; in
   Phase 3 the same call sends it and the link is never displayed.
2. **`/invite/:token` (the joiner, no sign-in).** Shows who invited them and what
   they are accepting — email, role, staff ID, all read-only — and takes a
   password of their own. Accepting consumes the token, sets `status: "active"`,
   and sends them to sign in. Deliberately *not* auto-signed-in: their first act
   should prove the credentials work while they are still at the desk.

**Consequences that fall out of `password` being optional:**

- An `invited` account **cannot sign in**. It says so in plain words rather than
  "wrong credentials", which would send a new joiner hunting for a password
  nobody ever gave them. This is the one place the login screen names a real
  cause — justified because the person was sent the invitation.
- Invitations can be **withdrawn** (a typo in the address, someone who did not
  join) or **re-issued** (a link that went astray, which invalidates the old
  one). Neither action can ever touch an active colleague's account.
- Inviting a **doctor** also creates the `Doctor` record their schedule joins
  against — a doctor account with no Doctor row would sign in to a schedule that
  cannot exist. Withdrawing that invitation removes the placeholder again.

## 4c. Clinic Feedback — Appointment Types

The clinic supplied its real list, replacing the five guessed types:

| # | Type | Returning-patient length |
|---|---|---|
| 1 | Dietician review | 15 min |
| 2 | Diabetes review | 15 min |
| 3 | Urologist review | 15 min |
| 4 | General checkup | 30 min |
| 5 | Follow up | 15 min |
| 6 | Other specialist review | 15 min |

Two things about this list changed how the duration rule reads, both recorded in
`lib/appointment-types.ts`:

- **There is no "Consultation" or "New patient" entry.** The type names the
  service, not whether the clinic has met this person. So the 40-minute rule
  cannot key off the type at all — it keys off the patient's own history, which
  is what `lib/visits.ts` already answers. The design happened to be right for a
  reason that only became visible with the real list.
- **Four of the six are reviews**, and a review is a return visit by definition:
  nobody has a diabetes review before something diagnosed the diabetes. That is
  why they sit on the 15-minute side, and it is a firmer argument than the one
  available under the old list. Still flagged for sign-off (open question 8).

**Seed data was migrated, not just relabelled.** The old seed had every patient
registered in 2024 with their only appointment in the last month — which meant
"Follow up" rows following up on nothing, and a recall screen reporting "last
seen 2 years ago" for patients the clinic sees regularly. Established patients
now carry an earlier attended visit, so return visits are genuinely return
visits and price at 15 minutes.

## 5. Seed Data Requirements

- **10–20 patients** with varied preferred channels (mix of WhatsApp/SMS/email), some with missing email (SMS-only fallback scenario).
- **Appointments spanning past and future dates**, with a realistic mix of all 5 statuses — include enough "missed" appointments to populate the follow-up action list meaningfully, and enough "attended" history to make a patient's visit history look real.
- **A doctor availability pattern** that isn't a flat 9-5 — reflect the "shifts with her availability" detail from the proposal (e.g., some days fully booked/unavailable, some with only afternoon slots).
- **Message log with 15+ entries** across all types and channels, including at least one "failed" delivery status to show that state exists.
- **2-3 pending patient requests** (mix of reschedule and cancellation) sitting in the staff queue, unresolved.
- **A recall cohort** (added with Section 4a) — six patients whose history reaches back past the six-month line: came once and never returned (8 months), attended regularly then stopped (13 months), booked twice and never attended, one inside the five-month warning band, and one already contacted this month so the cooldown is visible. Plus one record with no appointment at all, which exercises the *Needs checking* tab rather than the sweep. Their dates are relative to today, so the tail stays six months long as the prototype ages.

## 6. Key Interaction Flows to Demonstrate

1. **Core booking flow:** Staff searches/finds patient → checks doctor availability → books slot → system shows a simulated confirmation message being "sent."
2. **Missed appointment → follow-up:** Staff marks an appointment "missed" → it appears on the dashboard follow-up action list → staff triggers a follow-up message (simulated) → appears in message log.
3. **Patient self-service request:** From the patient-facing page, patient requests a reschedule → it appears in the staff "Pending Requests" queue → staff confirms or declines → status updates accordingly.
4. **Doctor availability change:** Doctor toggles a day/slot off → previously bookable slots in the staff calendar view immediately reflect as unavailable.

## 7. Explicitly Out of Scope for This Prototype

- Real authentication/login
- Real WhatsApp/SMS/email sending (simulate only)
- Real data persistence/database
- Payments, clinical notes, or any item listed under "Future Enhancements" in the client proposal
- ~~Multi-doctor support~~ **Partly superseded:** staff accounts now support several doctors (Section 4b), but booking and availability still run against one. See open question 11 — this is the gap to close or confirm.

## 8. UI Lock Criteria (client sign-off checklist)

Before treating the UI as locked and moving to database design, get explicit client confirmation on:
- [ ] Navigation structure and module names make sense to staff/doctor
- [ ] Booking flow matches how the doctor's availability actually works in practice
- [ ] Dashboard shows the right things staff actually check daily
- [ ] Patient-facing page has all information a patient needs, and nothing confusing
- [ ] Message log fields are what staff would actually want to audit
- [ ] Patient form fields match what's really captured

 at registration (cross-check against proposal's open question #1: sample paper data)
- [ ] The 40/15-minute rule is right, and the two named Reviews really do belong on the 15-minute side (open question 8)
- [ ] The recall list shows who the doctor meant, and the exclusions — already booked in, no-showed recently, no appointment on record — match how the clinic would work it (open question 9)
- [ ] The six appointment types are complete and worded as the clinic would say them (Section 4c)
- [ ] Adding a colleague works the way the clinic expects — front desk sets up the email, the joiner sets their own password, and nobody at the desk ever handles it (Section 4b)
- [ ] Appointment statuses (booked/confirmed/attended/missed/rescheduled/**cancelled**) match clinic's actual workflow language — in particular, does the clinic distinguish "cancelled in advance" from "missed"? The attendance-rate stat depends on the answer.

## 8b. Open Questions Raised During the Build

Decisions made to keep building, each reversible. Confirm these alongside the Section 8 checklist:

1. **`cancelled` appointment status added** (Section 4). The clinic needs a state for "called off in advance"; reusing `missed` would corrupt the attendance-rate stat and wrongly trigger follow-up chasing. → *Does the clinic distinguish the two?*
2. **"Booked today" stat** counts appointments *scheduled for* today with status `booked`, not appointments *created* today. → *Which does front desk actually want?* One-line change either way.
3. ~~**Clinic contact details are placeholders**~~ **Resolved** — real details supplied and in `src/lib/clinic.ts`: Baiden Ave 1st St, Accra · 020 152 9933. The clinic logo (`public/images/rophe-logo.png`) is now the top-nav mark, the patient-page header, and the browser favicon.
4. **"Confirm Attendance" changes the appointment to `confirmed`** rather than queuing a staff request. It doesn't alter the schedule, so staff keep control of date/time, and it avoids a queue full of items needing no decision. → *Confirm this matches how the clinic wants confirmations handled.*
5. **Patients are notified when staff confirm or decline a request** (simulated message). Every other action affecting an appointment messages the patient, and a silent decline leaves someone waiting. → *Confirm the clinic wants this, since it adds message-log volume.*
6. ~~**Appointment types** are a fixed list (Consultation, Follow-up, Hypertension Review, Diabetes Review, General Check-up).~~ **Resolved** — the clinic supplied its real list (Section 4c). "Consultation" and "Hypertension Review" are gone; the seed was migrated onto the new vocabulary, with old hypertension reviews landing in *Other specialist review*. **Follow-on:** *Other specialist review* is a catch-all with nowhere to record which specialist — should it capture that, or does the notes field cover it?
7. **Availability is a repeating weekly pattern, with no one-off exceptions.** `DoctorAvailability` keys on `dayOfWeek`, so the doctor sets the hours she *normally* works and they apply to every week. There is no way to say "I'm away Thursday the 21st" — closing that slot would close every Thursday. In practice a clinic needs both. → *How does the doctor currently handle a single day off, and should Phase 2 add date-specific exceptions (an `AvailabilityException` table keyed on a real date) or leave front desk to move the affected appointments by hand?* The availability screen currently states the limitation in plain English rather than pretending it doesn't exist.

8. **The 15-minute rule was extended to every "… review".** The clinic named only "Follow up". Under its real type list (Section 4c) four of the six types are reviews, and a review is a return visit by definition — nobody has a diabetes review before something diagnosed the diabetes — so they inherit the 15 minutes. General checkup is the one non-review and keeps 30. → *Are all four reviews really 15 minutes — a dietician review in particular — and is 30 right for a returning patient's general checkup?* One line each in `lib/appointment-types.ts`.

9. **Exclusions from the recall list.** A patient with a visit already booked never appears; neither does one whose last diary contact of any kind was inside the six months, which keeps recent no-shows on the dashboard's follow-up list where they are chased within days. → *Confirm both. If the clinic wants recent no-shows on the recall list too it is one condition in `lib/visits.ts`, but the same patient will then be chased from two screens.*

   ~~A third category, "registered but never booked", was also on the recall list.~~ **Resolved** — the clinic confirmed registration and booking always happen together, so such a record cannot arise legitimately. It is now a data-quality flag (*Needs checking*), not outreach. **Follow-on worth asking:** if these are unfinished registrations, should front desk be able to delete a patient record with no appointments, or is a "merge duplicate" action what they actually need? Neither exists yet.

10. **The 30-minute calendar grid does not divide by either clinic duration.** A 40-minute first visit holds two slots and gives 20 minutes back; a 15-minute follow-up holds one and gives 15 back. The booking form states this per booking rather than hiding it. Moving the grid to 15 minutes would pack follow-ups properly, but it doubles every row of the doctor's availability screen and 40 still would not divide cleanly. → *Does the doctor actually run back-to-back 15-minute follow-ups, or is a half-hour column per patient how the clinic really works?* This is the one question here that would change more than a constant.

11. **Inviting a doctor outruns the rest of the prototype.** Staff accounts now support several doctors, each with a Doctor record — but booking and availability still assume one (`DOCTOR_ID = "doc-1"` on the availability screen, `docs[0]` in the booking form), and multi-doctor support is listed as out of scope in Section 7. So a newly invited doctor gets an account, a role and a landing page, but no separate diary. → *Is multi-doctor scheduling now in scope for Phase 2? The clinic's own appointment types name a dietician and a urologist, which suggests more than one clinician is already seeing patients.* This is the largest open item on the list.

12. **Nothing can edit or deactivate an active staff account.** Invitations can be withdrawn, but a colleague who leaves cannot be switched off, and a role cannot be corrected after acceptance. → *Does the clinic need deactivation, and who may do it — any front-desk account, or an admin role the prototype does not yet have?*

13. **The recall cooldown is 30 days and never gives up.** Someone contacted inside that window drops off the sweep, then returns to it. → *Is a month the right gap before a second attempt, and after how many silent attempts should the clinic stop trying?*

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
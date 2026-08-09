# Bolt.new Build Prompts — Rophe Appointment System Prototype

Use these in order, one at a time, in the same Bolt.new project/thread. Attach `prototype_prd.md` on Prompt 1 only — after that, Bolt has the project context and you just reference section numbers. Wait for each step to finish and check the preview before moving to the next prompt. If something comes out wrong, fix it with a follow-up before moving on — don't stack a new screen on top of a broken one.

---

### Prompt 1 — Scaffold + mock API layer + seed data
*(attach prototype-prd.md to this message)*

```
Use the attached PRD to scaffold a Next.js 16 App Router project with TypeScript, Tailwind CSS, and shadcn/ui as the component layer — no additional UI or CSS frameworks beyond those.

Set up the folder structure exactly as described in Section 0: app/, components/, lib/, styles/.

Create the mock API client in lib/api.ts with these functions, matching the signatures in Section 0's endpoint table plus the additional ones noted (getPatients, createPatient, getAppointments, bookAppointment, updateAppointmentStatus, getMessages, getPendingRequests, respondToRequest). Each function should read/write from in-memory mock data — no real network calls.

Create the mock seed data in lib/mockData.ts (or a data/ folder) matching the shapes in Section 4, following the seed requirements in Section 5: 10-20 patients with varied preferred channels, appointments spanning past and future dates with a realistic mix of all 5 statuses, a non-flat doctor availability pattern, 15+ message log entries including at least one failed delivery, and 2-3 pending patient requests. Use realistic Ghanaian names and phone number formats.

Create empty placeholder route files for every screen listed in Section 3 (dashboard, patients list, patient detail, add/edit patient, appointments calendar, book/reschedule, message log, pending requests, doctor dashboard, doctor availability, doctor schedule, patient-facing appointment view) — just a page title and "Coming soon" text in each for now. Don't build the actual UI yet.

Also add a role switcher in the top nav (dropdown or toggle: "Viewing as: Front-desk Staff / Doctor / Patient") using React state — no real auth.
```

---

### Prompt 2 — App shell & navigation
```
Build the app shell: top nav with the role switcher from before, and a sidebar (or nav bar) that shows different links depending on the selected role, matching Section 2's access table:
- Front-desk Staff: Dashboard, Patients, Appointments, Message Log, Pending Requests
- Doctor: Dashboard, My Availability, My Schedule
- Patient: no nav — this role only ever sees the single patient-facing page directly

Keep it clean and minimal-training-required per Section 9's design notes. Use consistent color coding groundwork now for appointment statuses (booked, confirmed, attended, missed, rescheduled) — define the color mapping as a shared constant in lib/ so every screen uses the same colors.
```

---

### Prompt 3 — Front-desk Dashboard
```
Build the Front-desk Staff Dashboard screen (Section 3.1 #1) using lib/api.ts:
- Today's appointments
- Upcoming appointments this week
- Missed-visit list
- Pending follow-ups action list
- Quick stats: attendance rate this week, appointments booked today

Use the shared status color mapping. Make it the default landing page when role = Front-desk Staff.
```

---

### Prompt 4 — Patients list & patient detail
```
Build the Patients screen (Section 3.1 #2):
- Searchable/filterable list of all patients (search by name or phone)
- Click a patient to open their Patient Detail page: contact info, preferred channel, DOB, full visit history, and linked appointments

Pull all data from lib/api.ts (getPatients).
```

---

### Prompt 5 — Add/Edit patient form
```
Build the Add/Edit Patient form (Section 3.1 #3): name, phone (required), WhatsApp number, email (optional), date of birth, preferred communication channel (dropdown: WhatsApp/SMS/Email), notes. Wire it to createPatient in lib/api.ts. Accessible both from the Patients list ("Add Patient" button) and inline from the booking flow (build that hook now, we'll use it in the next prompt).
```

---

### Prompt 6 — Appointments calendar view
```
Build the Appointments screen (Section 3.1 #4) with day/week/list view toggle. Color-code appointments by status using the shared color mapping. Clicking an open slot starts a new booking; clicking an existing appointment opens it for view/edit/cancel/reschedule. Respect the doctor's availability from the mock data — slots outside availability should render as disabled/greyed and not be clickable for new bookings.
```

---

### Prompt 7 — Book/reschedule appointment flow
```
Build the Book/Reschedule Appointment form (Section 3.1 #5): select patient (search existing or "+ New Patient" which opens the form from Prompt 5), appointment type, date/time constrained to the doctor's available slots, duration, notes. On submit, call bookAppointment in lib/api.ts and simulate sending a confirmation message — show a toast like "Confirmation sent via [patient's preferred channel]" and add a corresponding entry to the mock message log (don't actually send anything).

Implement the core booking flow end to end per Section 6 #1: search/find patient → check availability → book → simulated confirmation.
```

---

### Prompt 8 — Missed appointment → follow-up flow
```
On the Appointments and Dashboard screens, let staff mark an appointment as "missed." When marked missed, it should appear on the Dashboard's follow-up action list (Section 6 #2). Add a "Send Follow-up" action from that list which calls the mock API, adds a follow-up entry to the message log, and shows a confirmation toast — mirroring the confirmation flow from Prompt 7 but with type "follow-up."
```

---

### Prompt 9 — Message Log
```
Build the Message Log screen (Section 3.1 #6): table of patient, channel, message type (confirmation/reminder/follow-up/birthday), timestamp, delivery status (sent/delivered/failed). Pull from getMessages() in lib/api.ts. Make it filterable by channel and message type. Include the failed-delivery entries from seed data so that status is visibly represented.
```

---

### Prompt 10 — Pending Requests queue
```
Build the Pending Requests screen (Section 3.1 #7): list of patient-submitted reschedule/cancellation requests from getPendingRequests(). Each row needs Confirm and Decline actions calling respondToRequest() in lib/api.ts. On confirm, update the linked appointment's status/date-time accordingly; on decline, just update the request status. Show the 2-3 seeded pending requests here.
```

---

### Prompt 11 — Doctor Dashboard & Schedule
```
Build the Doctor role screens (Section 3.2 #1 and #3): a lighter, read-focused Dashboard (same data shape as staff dashboard but simplified), and My Schedule with day/week/list views of the doctor's own appointments. Make this the default landing page when role = Doctor.
```

---

### Prompt 12 — Doctor Availability
```
Build the My Availability screen (Section 3.2 #2): a simple weekly grid where the doctor clicks to toggle time slots open/closed per day. Wire it so that toggling a slot immediately reflects in the Appointments calendar view (staff side) as available/unavailable — implement Section 6 #4's flow: doctor turns off a slot, staff calendar immediately shows it as unbookable.
```

---

### Prompt 13 — Doctor: patient history (read-only)
```
Add read-only patient visit history access from the Doctor's schedule (Section 3.2 #4) — clicking a patient's name in an appointment should show their visit history in a read-only view (reuse the Patient Detail component from Prompt 4 but strip out any edit actions when role = Doctor).
```

---

### Prompt 14 — Patient-facing page
```
Build the Patient-facing Appointment page (Section 3.3), reached at /portal/appointment/[id] with no login. Mobile-first design per Section 9. Show: date, time, doctor name, clinic location/address, appointment type, plus a clinic info footer (location, contact number).

Add three actions: Confirm Attendance, Request Reschedule (opens a simple date/time preference picker), Request Cancellation (with optional reason field). Each should call respondToRequest-style mock functions that create a new entry in getPendingRequests() — NOT change the appointment directly — and show a confirmation message like "Request sent — our staff will confirm shortly." This implements Section 6 #3's flow end to end: link this page's requests to the Pending Requests queue from Prompt 10 so a request made here actually shows up there.

When role switcher = "Patient," route directly to this page (using one of the seeded appointment IDs) instead of showing the staff/doctor nav.
```

---

### Prompt 15 — Full flow pass & polish
```
Do a full pass over the app:
1. Verify all four flows in Section 6 work end to end without errors: booking, missed→follow-up, patient self-service request, doctor availability change.
2. Check responsive behavior — staff/doctor views should work well on desktop and tablet, the patient-facing page should be mobile-first per Section 9.
3. Make sure the status color mapping is visually consistent across the dashboard, calendar, and patient detail views.
4. Clean up any remaining "Coming soon" placeholders.
5. Double check every screen reads data through lib/api.ts (no data hardcoded directly in components) — this matters because lib/api.ts is what gets swapped for real backend calls later.
```

---

## Notes while building

- If Bolt drifts from the folder structure or stack (e.g. adds a UI library, uses Pages Router), correct it immediately in your next prompt — don't let it compound across screens.
- If a screen comes out wrong, iterate on it directly ("On the Dashboard, move the quick stats above the appointment list") rather than re-running the whole prompt.
- Once Prompt 15 is done and the client has reviewed and signed off using the UI Lock Criteria checklist (PRD Section 8), you're ready to move to the database design PRD — built from what actually got shipped here, not the original proposal.
# Rophe server — Phase 2

Backend for the Rophe Specialist Care appointment system. The Phase 1 frontend
prototype is the specification: every endpoint here exists to replace one
function in `client/src/lib/api.ts`, with the same name and the same response
shape, so the frontend swap is a change to that one file.

---

## Getting started

```bash
cd server
npm install
cp .env.example .env          # then set DATABASE_URL and SESSION_SECRET
createdb rophe                # or point DATABASE_URL at a hosted Postgres
npm run prisma:migrate        # apply migrations
npm run prisma:seed           # demo data, ported from the prototype
npm run dev                   # → http://localhost:4000
```

Check it: <http://localhost:4000/api/health> → `{"status":"ok",…}`

**Demo accounts** (password `rophe123` for all active accounts):

| Email | Role |
|---|---|
| `frontdesk@rophe.care` | Front desk |
| `reception@rophe.care` | Front desk |
| `dr.mensah@rophe.care` | Doctor |
| `gifty.amponsah@rophe.care` | **Invited** — cannot sign in; invite token is `demo-invite-token` |

`npm run prisma:reset` drops, re-migrates and re-seeds when the data gets messy.

---

## Conventions — read before adding an endpoint

We are two people building two halves of one API. These exist so the halves fit
together without a reconciliation pass at the end.

### 1. Responses have one shape

Success is the bare payload. Failure is always:

```json
{ "error": { "code": "NOT_FOUND", "message": "…", "details": {} } }
```

Throw from anywhere — `src/lib/httpError.ts` has `badRequest`, `notFound`,
`conflict`, `forbidden`, `unauthenticated`, `gone`. The central handler turns
them into responses. `message` is read by a human (front-desk staff, through
the UI), so write it as a sentence.

Never return a raw Prisma error. It carries table and column names, and staff
cannot act on it. `errorHandler` already translates P2002/P2025/P2003.

### 2. Controllers never read `req.body`

They read the parsed result of a Zod schema:

```ts
export const createPatientSchema = z.object({ fullName: z.string().min(1), … });

router.post("/", requireFrontDesk, validateBody(createPatientSchema), asyncHandler(create));
```

Shared field schemas — email, phone, `HH:mm` time, date, channel — live in
`src/middleware/validate.ts`. Add to them rather than re-deciding what a valid
Ghanaian phone number is.

### 3. Every async handler is wrapped

Express 4 does not catch rejected promises; an unwrapped `async` handler that
throws will hang the request. Always `asyncHandler(...)`.

### 4. Auth is middleware, not a check inside the handler

```ts
router.get("/",     requireAuth,      asyncHandler(list));
router.post("/",    requireFrontDesk, asyncHandler(create));
router.get("/mine", requireDoctor,    asyncHandler(mySchedule));
```

After `requireAuth`, `req.auth` is always present and always an ACTIVE account —
no null checks needed. It carries `userId`, `role`, and `doctorId` for doctors.

> **Never take a `doctorId` from the request body for a doctor-scoped action.**
> Use `resolveDoctorId(req, requested)`: a doctor may only act on their own
> record; front desk and admin must say which doctor. The prototype hardcodes
> `"doc-1"` on three screens, which means an invited doctor sees somebody
> else's diary — that bug is fixed by reading the session, and this helper is
> how.

### 5. Database rows never go on the wire directly

Map them. `src/mappers/` builds the response field by field, so a new column is
invisible to the API until someone adds it deliberately. That is what keeps
`passwordHash` and `inviteTokenHash` out of a response.

Mappers are also where Prisma's `SCREAMING_CASE` enums become the frontend's
`kebab-case` ones, once, rather than in every screen.

### 6. Secrets are hashed, never stored or logged

- Passwords → Argon2id (`hashPassword` / `verifyPassword`)
- Session, invite and portal tokens → 32 random bytes, stored as SHA-256

`src/lib/crypto.ts` has all of it, and explains why the two use different
primitives. The request logger deliberately omits query strings, because portal
links carry a token.

---

## Layout

```
src/
  config/env.ts          validated at boot; missing vars stop the process
  lib/
    prisma.ts            shared client
    crypto.ts            hashing + token generation
    httpError.ts         the error vocabulary
  middleware/
    auth.ts              requireAuth / requireRole / resolveDoctorId
    validate.ts          asyncHandler, validateBody, shared field schemas
    errorHandler.ts      the one place a failure becomes a response
    requestLogger.ts
  services/              business logic that outlives a single endpoint
  controllers/           request → service → response
  routes/                URL → middleware chain → controller
  mappers/               database row → API shape
  index.ts               mounts routes; the only file both tracks touch
```

Everything about one feature lives in its own files. `src/index.ts` is the only
shared file, and only one line of it — keep merges boring.

---

## Who builds what

Foundation (schema, migration, seed, conventions, auth) is **done**. The rest
splits cleanly:

**Track A — identity & scheduling**
staff accounts & invitations · doctors · availability & exceptions ·
appointment types · appointments (read + write, conflict validation)

**Track B — patients & communications**
patients · provider adapters · message log & delivery webhooks · templates ·
patient requests · recalls · portal access tokens

The only cross-track dependency is auth, and it already exists.

---

## Notes for whoever gets there first

**Times.** Stored as `startsAt` (UTC instant) + `durationMinutes`. Ghana is
UTC+0 with no DST, so this costs nothing locally and makes overlap queries
sane. The API splits it back into the `date` / `time` pair the frontend reads —
do that in a mapper, not in a controller.

**Appointment types are rows, not an enum.** Durations live with them, so the
15/30-minute rule is data. The 40-minute first-visit rule is
`ClinicSettings.firstVisitMinutes` and overrides the type, because a first visit
is about the patient's history, not the service.

**Recall is computed, never stored.** "Lapsed" falls out of the diary; a stored
flag would need something to remember to clear it. The index that makes it work
is `Appointment(patientId, status, startsAt)`.

**The portal token is a fix, not a feature.** `/portal/appointment/:id` in the
prototype is a bare record ID — anyone with the URL reads a real patient's name
and phone. `PortalAccessToken` replaces it: hashed, expiring, revocable.

**Message bodies are stored rendered.** Editing a template must never rewrite
what was already sent, which is why `Message.body` is text and not a template
reference.

---

## Messaging Providers

The system uses a `MessageProvider` interface to abstract sending notifications (WhatsApp, SMS, Email) and receiving delivery receipts.

To add a real provider (like Twilio or the WhatsApp Business API):
1. Implement the `MessageProvider` interface defined in `src/services/messageProvider/types.ts`.
2. Add the initialization logic to `src/services/messageProvider/index.ts`.
3. Select your provider using the `MESSAGE_PROVIDER` environment variable.

The default provider is `noop`, which simply logs outbound messages to the console instead of sending them. This allows the system to run locally and end-to-end without signing any provider contracts.


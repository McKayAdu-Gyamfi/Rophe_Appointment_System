# Rophe Appointment System

A web application for **Rophe Specialist Care** (Accra) that digitizes clinic
appointment scheduling and automates patient follow-up via WhatsApp, SMS, and
email.

This repository is a monorepo with two applications:

```
rophe/
├── client/     # Frontend — Next.js (App Router), React, TypeScript, Tailwind CSS
├── server/     # Backend  — Node.js, Express, TypeScript, Prisma
└── README.md
```

- **client** calls **server** over HTTP.
- **server** reads/writes a **PostgreSQL** database through Prisma.

---

## Tech stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind |
| Backend  | Node.js · Express · TypeScript               |
| Database | PostgreSQL (via Prisma ORM)                  |

---

## Folder structure

```
rophe/
├── client/
│   ├── src/
│   │   ├── app/           # pages & layouts (App Router)
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/    # reusable UI components
│   │   ├── lib/           # helpers (e.g. api.ts — calls the backend)
│   │   └── styles/
│   ├── public/            # static assets
│   ├── .env.example
│   └── package.json
│
└── server/
    ├── src/
    │   ├── config/        # env config
    │   ├── controllers/   # request handlers (business logic)
    │   ├── routes/        # URL → controller mappings
    │   ├── middleware/    # error handling, etc.
    │   ├── lib/           # Prisma client
    │   └── index.ts       # app entry point
    ├── prisma/
    │   └── schema.prisma  # database models
    ├── .env.example
    └── package.json
```

---

## Prerequisites

- **Node.js 20.9+** and npm
- **PostgreSQL** installed and running
- **Git**

Check your versions:

```bash
node -v
npm -v
psql --version
```

---

## Setup

Clone the repository, then set up each app.

```bash
git clone https://github.com/YOUR-USERNAME/rophe-appointment-system.git
cd rophe-appointment-system
```

### 1. Backend — `server/`

```bash
cd server
npm install
cp .env.example .env            # then edit DATABASE_URL for your Postgres
npm run prisma:generate         # generate the Prisma client
npm run prisma:migrate          # create the database tables
npm run dev                     # → http://localhost:4000
```

Verify: open <http://localhost:4000/api/health> → `{"status":"ok"}`.

### 2. Frontend — `client/`

Open a **second terminal**:

```bash
cd client
npm install
cp .env.example .env.local      # sets NEXT_PUBLIC_API_URL
npm run dev                     # → http://localhost:3000
```

Open <http://localhost:3000>. The home page shows the backend connection status.

---

## Environment variables

**server/.env**

```
PORT=4000
CLIENT_URL="http://localhost:3000"
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rophe?schema=public"
```

**client/.env.local**

```
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
```

> `.env` and `.env.local` are gitignored — never commit them.

---

## Daily development

Run both apps at once, in two terminals:

```bash
# terminal 1 — backend
cd server && npm run dev

# terminal 2 — frontend
cd client && npm run dev
```

---

## Scripts

### server/

| Command                   | Description                        |
| ------------------------- | ---------------------------------- |
| `npm run dev`             | Start API in watch mode            |
| `npm run build`           | Compile TypeScript → `dist/`       |
| `npm start`               | Run compiled server                |
| `npm run prisma:migrate`  | Apply database migrations          |
| `npm run prisma:studio`   | Open a visual database browser     |

### client/

| Command         | Description                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Start Next.js dev server     |
| `npm run build` | Production build             |
| `npm start`     | Serve the production build   |

---

## API endpoints (starter)

| Method | Endpoint                        | Description              |
| ------ | ------------------------------- | ----------------------- |
| GET    | `/api/health`                   | Health check            |
| GET    | `/api/patients`                 | List patients           |
| POST   | `/api/patients`                 | Create a patient        |
| GET    | `/api/appointments`             | List appointments       |
| POST   | `/api/appointments`             | Book an appointment     |
| PATCH  | `/api/appointments/:id/status`  | Update appointment status |

---

## Deployment & CI

This repository is configured for automated CI/CD.

### Continuous Integration (GitHub Actions)
On every pull request, and on pushes to `main` and `dev`, `.github/workflows/ci.yml`:
- installs and builds the server (`tsc`);
- lints, typechecks and builds the client.

Both jobs are verified green from a clean clone. The server job needs no
database: Prisma's own postinstall generates the client from the schema.

### Order of deployment

The two halves each need the other's URL, so there is one ordering that avoids
a redeploy:

1. **Render** — provision the API and database from the blueprint. Note the
   API URL. `CLIENT_URL` is `sync: false`, so it starts unset.
2. **Vercel** — import the repo, set **Root Directory** to `client`, set
   `NEXT_PUBLIC_API_URL` to `https://<your-api>.onrender.com/api`, deploy.
3. **Back on Render** — set `CLIENT_URL` to the Vercel origin (scheme and host
   only, no trailing path) and redeploy.

Step 3 is not optional. The API sends its session cookie with
`credentials: true`, which forbids a wildcard CORS origin, so every browser
request fails until `CLIENT_URL` names the real client. The server also refuses
to boot in production while `CLIENT_URL` still points at localhost, so a
forgotten step 3 fails loudly at deploy rather than quietly at sign-in.

### Backend & Database (Render)
`render.yaml` provisions a managed PostgreSQL database and the API, generates
`SESSION_SECRET` and `MESSAGE_WEBHOOK_SECRET` per environment, sets
`MESSAGE_PROVIDER=noop` so the first deploy sends nothing, runs
`prisma migrate deploy` on every build, and health-checks `/api/health`.

Two values are yours to set, both by hand:

| Variable | Why it is not generated |
| --- | --- |
| `CLIENT_URL` | Only known once Vercel has deployed. See step 3 above. |
| `MESSAGE_WEBHOOK_SECRET` | Generated by Render, but the **same value must be pasted into the messaging provider's dashboard** — the delivery webhook is public, and this secret is the only thing that stops anyone marking the clinic's messages delivered. Irrelevant while `MESSAGE_PROVIDER=noop`. |

### Frontend (Vercel)
Root Directory `client`, and `NEXT_PUBLIC_API_URL` pointing at the API's
`/api` path. The client has no other environment variables.

### Seeding a deployed environment
`prisma migrate deploy` creates the schema but no rows, and the app needs at
least a `ClinicSettings` row, the appointment types and one account that can
sign in. Run the seed **once**, against the deployed database, from a machine
with its `DATABASE_URL`:

```bash
cd server && DATABASE_URL="<render connection string>" npm run prisma:seed
```

The seed is destructive — it clears the tables it owns before inserting — so
never run it against an environment the clinic is already using. Change the
demo password on every seeded account before the clinic touches it.

### First-run checklist
- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Signing in from the Vercel URL succeeds (proves `CLIENT_URL` and cookies)
- [ ] `MESSAGE_PROVIDER` is `noop` until a provider contract exists
- [ ] Demo passwords changed
- [ ] WhatsApp Business verification started if that channel is wanted — Meta's
      business verification and per-template approval routinely take weeks

---

© 2026 Rophe Specialist Care.

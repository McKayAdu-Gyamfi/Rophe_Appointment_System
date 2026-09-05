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
On every push to `main` or pull request, the `.github/workflows/ci.yml` pipeline will:
- Check backend types and build the server.
- Lint and typecheck the frontend, and build the Next.js client.

### Backend & Database (Render)
A `render.yaml` blueprint is included in the root to automate the deployment of the API and provision a managed PostgreSQL database.
1. Connect your repository to [Render](https://render.com/).
2. Render will automatically detect the `render.yaml` blueprint.
3. Deploy the service. Render will provision the database, generate a secure `SESSION_SECRET`, set `MESSAGE_PROVIDER=noop` safely for the first launch, and run Prisma migrations automatically.

### Frontend (Vercel)
1. Import the repository into [Vercel](https://vercel.com/).
2. Set the **Root Directory** to `client`.
3. Set the **Environment Variable**: `NEXT_PUBLIC_API_URL` to your Render API URL (e.g., `https://rophe-api.onrender.com/api`).
4. Deploy.

Once Vercel finishes deploying, take its URL and set it as the `CLIENT_URL` environment variable on your Render API to allow secure cross-origin requests.

---

© 2026 Rophe Specialist Care.

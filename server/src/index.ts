import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { authRoutes } from "./routes/authRoutes";
import { doctorRoutes } from "./routes/doctorRoutes";
import { appointmentTypeRoutes } from "./routes/appointmentTypeRoutes";
import { clinicSettingsRoutes } from "./routes/clinicSettingsRoutes";
import { patientRoutes } from "./routes/patientRoutes";
import { templateRoutes } from "./routes/templateRoutes";
import { requestRoutes } from "./routes/requestRoutes";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";

const app = express();

// ---- Global middleware ----
//
// credentials:true is required for the session cookie to travel; with it, the
// CORS origin must be an explicit URL and can never be "*". Both halves of the
// API depend on that, so it is set once here.
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(requestLogger);

// ---- Health check ----
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "rophe-server", env: env.nodeEnv });
});

// ---- Feature routes ----
//
// Track A adds: /api/staff, /api/doctors, /api/appointments, /api/appointment-types
// Track B adds: /api/patients, /api/messages, /api/templates, /api/requests,
//               /api/recalls, /api/portal
// Mount them here; everything else about a route lives in its own folder, so
// this line should be the only merge conflict either of you sees.
app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointment-types", appointmentTypeRoutes);
app.use("/api/clinic-settings", clinicSettingsRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/requests", requestRoutes);

// ---- Fallbacks ----
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Rophe server running on http://localhost:${env.port} [${env.nodeEnv}]`);
});

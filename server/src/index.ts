import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { patientRoutes } from "./routes/patientRoutes";
import { appointmentRoutes } from "./routes/appointmentRoutes";
import { notFound, errorHandler } from "./middleware/errorHandler";

const app = express();

// ---- Global middleware ----
app.use(cors({ origin: env.clientUrl }));
app.use(express.json());

// ---- Health check ----
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "rophe-server" });
});

// ---- Feature routes ----
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);

// ---- Fallbacks ----
app.use(notFound);
app.use(errorHandler);

// ---- Start ----
app.listen(env.port, () => {
  console.log(`Rophe server running on http://localhost:${env.port}`);
});

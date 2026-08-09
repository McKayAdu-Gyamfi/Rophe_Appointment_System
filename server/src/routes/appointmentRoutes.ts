import { Router } from "express";
import {
  listAppointments,
  createAppointment,
  updateAppointmentStatus,
} from "../controllers/appointmentController";

export const appointmentRoutes = Router();

appointmentRoutes.get("/", listAppointments);
appointmentRoutes.post("/", createAppointment);
appointmentRoutes.patch("/:id/status", updateAppointmentStatus);

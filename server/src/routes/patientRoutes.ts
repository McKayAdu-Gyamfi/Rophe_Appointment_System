import { Router } from "express";
import { listPatients, createPatient } from "../controllers/patientController";

export const patientRoutes = Router();

patientRoutes.get("/", listPatients);
patientRoutes.post("/", createPatient);

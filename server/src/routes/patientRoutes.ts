import { Router } from "express";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import * as patientController from "../controllers/patientController";
import { getPatientSummary } from "../controllers/recallController";
import { asyncHandler } from "../middleware/validate";

const router = Router();

router.get("/", requireAuth, patientController.list);
router.get("/:id", requireAuth, patientController.get);
router.get("/:id/summary", requireAuth, asyncHandler(getPatientSummary));
router.post("/", requireFrontDesk, patientController.create);
router.patch("/:id", requireFrontDesk, patientController.update);

export { router as patientRoutes };

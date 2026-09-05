import { Router } from "express";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import * as patientController from "../controllers/patientController";

const router = Router();

router.get("/", requireAuth, patientController.list);
router.get("/:id", requireAuth, patientController.get);
router.post("/", requireFrontDesk, patientController.create);
router.patch("/:id", requireFrontDesk, patientController.update);

export { router as patientRoutes };

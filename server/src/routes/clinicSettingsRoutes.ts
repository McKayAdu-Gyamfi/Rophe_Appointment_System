import { Router } from "express";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import * as clinicSettingsController from "../controllers/clinicSettingsController";

const router = Router();

router.get("/", requireAuth, clinicSettingsController.getSettings);
router.patch("/", requireFrontDesk, clinicSettingsController.updateSettings);

export { router as clinicSettingsRoutes };

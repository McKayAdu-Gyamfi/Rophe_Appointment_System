import { Router } from "express";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import * as appointmentTypeController from "../controllers/appointmentTypeController";

const router = Router();

router.get("/", requireAuth, appointmentTypeController.list);
router.post("/", requireFrontDesk, appointmentTypeController.create);
router.patch("/reorder", requireFrontDesk, appointmentTypeController.reorder);
router.patch("/:id", requireFrontDesk, appointmentTypeController.update);
router.delete("/:id", requireFrontDesk, appointmentTypeController.remove);

export { router as appointmentTypeRoutes };

import { Router } from "express";
import { listDoctors, getDoctor, updateDoctor } from "../controllers/doctorController";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import { asyncHandler } from "../middleware/validate";

const router = Router();

router.get("/", requireAuth, asyncHandler(listDoctors));
router.get("/:id", requireAuth, asyncHandler(getDoctor));
router.patch("/:id", requireFrontDesk, asyncHandler(updateDoctor));

export { router as doctorRoutes };

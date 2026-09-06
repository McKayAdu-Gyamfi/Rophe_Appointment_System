import { Router } from "express";
import { listDoctors, getDoctor, updateDoctor } from "../controllers/doctorController";
import {
  createException,
  createExceptionSchema,
  deleteException,
  getAvailability,
  setDay,
  setDaySchema,
} from "../controllers/availabilityController";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import { asyncHandler, validateBody } from "../middleware/validate";

const router = Router();

router.get("/", requireAuth, asyncHandler(listDoctors));
router.get("/:id", requireAuth, asyncHandler(getDoctor));
router.patch("/:id", requireFrontDesk, asyncHandler(updateDoctor));

// Availability. Each handler resolves the doctor through resolveDoctorId, so
// requireAuth is enough here — a doctor is narrowed to their own record and
// front desk must name whose hours they are changing.
router.get("/:id/availability", requireAuth, asyncHandler(getAvailability));
router.put(
  "/:id/availability/:day",
  requireAuth,
  validateBody(setDaySchema),
  asyncHandler(setDay),
);
router.post(
  "/:id/exceptions",
  requireAuth,
  validateBody(createExceptionSchema),
  asyncHandler(createException),
);
router.delete("/:id/exceptions/:exceptionId", requireAuth, asyncHandler(deleteException));

export { router as doctorRoutes };

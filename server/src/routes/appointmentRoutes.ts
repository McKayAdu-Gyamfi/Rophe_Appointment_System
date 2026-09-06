import { Router } from "express";
import {
  book,
  bookSchema,
  createPortalLink,
  get,
  list,
  setStatus,
  statusSchema,
  update,
  updateSchema,
} from "../controllers/appointmentController";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import { asyncHandler, validateBody } from "../middleware/validate";

export const appointmentRoutes = Router();

// Reads are scoped inside the controller: a doctor sees their own diary, front
// desk the whole clinic.
appointmentRoutes.get("/", requireAuth, list);
appointmentRoutes.get("/:id", requireAuth, asyncHandler(get));

// Booking and rescheduling are front-desk work — a doctor does not manage the
// diary, and the status route is where they mark a visit attended.
appointmentRoutes.post("/", requireFrontDesk, validateBody(bookSchema), asyncHandler(book));
appointmentRoutes.patch("/:id", requireFrontDesk, validateBody(updateSchema), asyncHandler(update));
appointmentRoutes.patch(
  "/:id/status",
  requireAuth,
  validateBody(statusSchema),
  asyncHandler(setStatus),
);

// Front desk minting the patient's own link — returned once, stored hashed.
appointmentRoutes.post("/:id/portal-link", requireFrontDesk, asyncHandler(createPortalLink));

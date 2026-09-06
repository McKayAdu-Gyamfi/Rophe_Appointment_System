import { Router } from "express";
import {
  confirmPortalAppointment,
  createPortalRequest,
  getPortalAppointment,
  portalRequestSchema,
} from "../controllers/portalController";
import { rateLimit } from "../middleware/rateLimit";
import { asyncHandler, validateBody } from "../middleware/validate";

export const portalRoutes = Router();

// Public and unauthenticated, so the token space is walkable in principle.
// 32 random bytes make that hopeless already; the limiter makes it pointless,
// and keeps a broken retry loop in someone's phone from becoming an outage.
const portalReads = rateLimit({
  max: 60,
  windowMs: 60_000,
  message: "Too many requests. Wait a minute and open your link again.",
});

const portalWrites = rateLimit({
  max: 10,
  windowMs: 60_000,
  message: "Too many attempts. Wait a minute, or call the clinic.",
});

portalRoutes.get("/:token", portalReads, asyncHandler(getPortalAppointment));
portalRoutes.post("/:token/confirm", portalWrites, asyncHandler(confirmPortalAppointment));
portalRoutes.post(
  "/:token/requests",
  portalWrites,
  validateBody(portalRequestSchema),
  asyncHandler(createPortalRequest),
);

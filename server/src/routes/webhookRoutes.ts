import { Router } from "express";
import { messageDelivery } from "../controllers/webhookController";
import { rateLimit } from "../middleware/rateLimit";
import { asyncHandler } from "../middleware/validate";

export const webhookRoutes = Router();

// Public by necessity — the provider has no session. Authenticated by the
// adapter's signature check, not by requireAuth.
// Generous: a provider legitimately bursts delivery receipts. Low enough that
// an unauthenticated flood cannot sit on the database.
const webhookLimit = rateLimit({
  max: 600,
  windowMs: 60_000,
  message: "Too many callbacks.",
});

webhookRoutes.post("/messages/:provider", webhookLimit, asyncHandler(messageDelivery));

import { Router } from "express";
import { messageDelivery } from "../controllers/webhookController";
import { asyncHandler } from "../middleware/validate";

export const webhookRoutes = Router();

// Public by necessity — the provider has no session. Authenticated by the
// adapter's signature check, not by requireAuth.
webhookRoutes.post("/messages/:provider", asyncHandler(messageDelivery));

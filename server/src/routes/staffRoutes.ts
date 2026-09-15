import { Router } from "express";
import {
  accept,
  acceptSchema,
  getInvitation,
  invite,
  inviteSchema,
  list,
  resend,
  revoke,
} from "../controllers/staffController";
import { requireFrontDesk } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { asyncHandler, validateBody } from "../middleware/validate";

export const staffRoutes = Router();

staffRoutes.get("/", requireFrontDesk, asyncHandler(list));

staffRoutes.post(
  "/invitations",
  requireFrontDesk,
  validateBody(inviteSchema),
  asyncHandler(invite),
);

// Public, so the invite-token space is reachable from outside. 32 random bytes
// make walking it hopeless; this makes it pointless.
const invitationLimit = rateLimit({
  max: 20,
  windowMs: 60_000,
  message: "Too many attempts. Wait a minute and open your invitation again.",
});

// Public: the joiner is holding a token, not a session. The token is the
// credential, and findByInviteToken checks it is unused and unexpired.
staffRoutes.get("/invitations/:token", invitationLimit, asyncHandler(getInvitation));
staffRoutes.post(
  "/invitations/:token/accept",
  invitationLimit,
  validateBody(acceptSchema),
  asyncHandler(accept),
);

staffRoutes.post("/invitations/:id/resend", requireFrontDesk, asyncHandler(resend));
staffRoutes.delete("/invitations/:id", requireFrontDesk, asyncHandler(revoke));

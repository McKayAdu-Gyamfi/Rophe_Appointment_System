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
import { asyncHandler, validateBody } from "../middleware/validate";

export const staffRoutes = Router();

staffRoutes.get("/", requireFrontDesk, asyncHandler(list));

staffRoutes.post(
  "/invitations",
  requireFrontDesk,
  validateBody(inviteSchema),
  asyncHandler(invite),
);

// Public: the joiner is holding a token, not a session. The token is the
// credential, and findByInviteToken checks it is unused and unexpired.
staffRoutes.get("/invitations/:token", asyncHandler(getInvitation));
staffRoutes.post(
  "/invitations/:token/accept",
  validateBody(acceptSchema),
  asyncHandler(accept),
);

staffRoutes.post("/invitations/:id/resend", requireFrontDesk, asyncHandler(resend));
staffRoutes.delete("/invitations/:id", requireFrontDesk, asyncHandler(revoke));

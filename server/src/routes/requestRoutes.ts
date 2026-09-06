import { Router } from "express";
import { list, respond, respondRequestSchema } from "../controllers/requestController";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import { asyncHandler, validateBody } from "../middleware/validate";

export const requestRoutes = Router();

requestRoutes.get("/", requireAuth, asyncHandler(list));
// Patients raise requests through /api/portal/:token/requests — a caller with
// no token cannot say which appointment it is speaking for.
requestRoutes.patch("/:id", requireFrontDesk, validateBody(respondRequestSchema), asyncHandler(respond));

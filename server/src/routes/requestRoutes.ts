import { Router } from "express";
import { create, list, respond, createRequestSchema, respondRequestSchema } from "../controllers/requestController";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import { asyncHandler, validateBody } from "../middleware/validate";

export const requestRoutes = Router();

requestRoutes.get("/", requireAuth, asyncHandler(list));
requestRoutes.post("/", validateBody(createRequestSchema), asyncHandler(create));
requestRoutes.patch("/:id", requireFrontDesk, validateBody(respondRequestSchema), asyncHandler(respond));

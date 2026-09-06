import { Router } from "express";
import { list, send, sendSchema } from "../controllers/messageController";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import { asyncHandler, validateBody } from "../middleware/validate";

export const messageRoutes = Router();

messageRoutes.get("/", requireAuth, list);
messageRoutes.post("/", requireFrontDesk, validateBody(sendSchema), asyncHandler(send));

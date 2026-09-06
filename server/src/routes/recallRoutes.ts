import { Router } from "express";
import { listRecalls } from "../controllers/recallController";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/validate";

export const recallRoutes = Router();

recallRoutes.get("/", requireAuth, asyncHandler(listRecalls));

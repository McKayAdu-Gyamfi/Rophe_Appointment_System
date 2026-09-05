import { Router } from "express";
import { list, revert, update, updateTemplateSchema } from "../controllers/templateController";
import { requireAuth, requireFrontDesk } from "../middleware/auth";
import { asyncHandler, validateBody } from "../middleware/validate";

export const templateRoutes = Router();

templateRoutes.get("/", requireAuth, asyncHandler(list));
templateRoutes.patch("/:type", requireFrontDesk, validateBody(updateTemplateSchema), asyncHandler(update));
templateRoutes.post("/:type/revert/:version", requireFrontDesk, asyncHandler(revert));

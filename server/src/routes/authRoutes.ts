import { Router } from "express";
import { me, signIn, signInSchema, signOut } from "../controllers/authController";
import { asyncHandler, validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";

export const authRoutes = Router();

authRoutes.post("/login", validateBody(signInSchema), asyncHandler(signIn));
authRoutes.post("/logout", asyncHandler(signOut));
authRoutes.get("/me", requireAuth, asyncHandler(me));

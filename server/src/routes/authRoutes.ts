import { Router } from "express";
import { me, signIn, signInSchema, signOut } from "../controllers/authController";
import { asyncHandler, validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

export const authRoutes = Router();

// Password guessing is the attack this exists for. Ten a minute is far more
// than a person mistyping their own password and far less than useful to a
// script working through a list.
const signInLimit = rateLimit({
  max: 10,
  windowMs: 60_000,
  message: "Too many sign-in attempts. Wait a minute and try again.",
});

authRoutes.post("/login", signInLimit, validateBody(signInSchema), asyncHandler(signIn));
authRoutes.post("/logout", asyncHandler(signOut));
authRoutes.get("/me", requireAuth, asyncHandler(me));

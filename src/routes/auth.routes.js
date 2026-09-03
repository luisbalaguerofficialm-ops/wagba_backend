import express from "express";

import {
  registerUser,
  loginUser,
  googleAuth,
} from "../controllers/auth.controller.js";

import { rateLimiter, refreshTokenLimit } from "../middlewares/rateLimit.js";

const router = express.Router();

// ==========================================
// EMAIL/PASSWORD SIGNUP
// ==========================================

router.post("/register", rateLimiter, registerUser);

// ==========================================
// EMAIL/PASSWORD LOGIN
// ==========================================

router.post("/login", rateLimiter, loginUser);

// ==========================================
// GOOGLE LOGIN / SIGNUP
// ==========================================

router.post("/google", rateLimiter, googleAuth);

// ==========================================
// REFRESH TOKEN
// ==========================================

// router.post(
//   "/refresh-token",
//   refreshTokenLimit,
//   refreshToken,
// );

export default router;

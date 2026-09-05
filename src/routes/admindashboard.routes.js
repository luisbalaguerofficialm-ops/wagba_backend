import express from "express";

import { getAdminDashboard } from "../controllers/adminDashboard.controller.js";

import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ============================================================
// ADMIN DASHBOARD
// ============================================================

router.get("/", protect, authorize("admin", "manager"), getAdminDashboard);

export default router;

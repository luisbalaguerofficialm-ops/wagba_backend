import express from "express";

import {
  getUsers,
  getUserById,
  deleteUser,
  addUserNote,
} from "../controllers/customers.controller.js";
import { protect, authorize } from "../middlewares/authMiddleware.js"; // JWT protect middleware

const router = express.Router();

// ==========================================================
// CUSTOMER / USER ADMIN ROUTES
// Base URL:
// /api/v3/customers
// ==========================================================

// Get all users
router.get("/", protect, authorize("admin, manager"), getUsers);

// Get single user
router.get("/:id", protect, authorize("admin, manager"), getUserById);

// Add note to user
router.post("/:id/notes", protect, authorize("admin, manager"), addUserNote);

// Delete user
router.delete("/:id", protect, authorize("admin, manager"), deleteUser);

export default router;

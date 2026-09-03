import express from "express";

import {
  createRider,
  getOrderAndAvailableRiders,
  assignRiderToOrder,
} from "../controllers/rider.controller.js";

import upload from "../middlewares/upload.js"; // Adjust the path if necessary

import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================================
// CREATE RIDER
// POST /api/riders
// ==========================================================
// Content-Type: multipart/form-data
// Image field: image
//
// Example form-data:
// name          John Doe
// email         john@example.com
// phone         08012345678
// vehicleType   Motorcycle
// image         <file>
// ==========================================================

router.post(
  "/",
  protect,
  authorize("admin", "manager"),
  upload.single("image"),
  createRider,
);

// ==========================================================
// GET ORDER + AVAILABLE RIDERS
// GET /api/riders/orders/:orderId/available-riders
// ==========================================================

router.get(
  "/orders/:orderId/available-riders",
  protect,
  authorize("admin", "manager"),
  getOrderAndAvailableRiders,
);

// ==========================================================
// ASSIGN RIDER TO ORDER
// PATCH /api/riders/orders/:orderId/assign-rider
// ==========================================================

router.patch(
  "/orders/:orderId/assign-rider",
  protect,
  authorize("admin", "manager"),
  assignRiderToOrder,
);

// ==========================================================
// EXPORT ROUTER
// ==========================================================

export default router;

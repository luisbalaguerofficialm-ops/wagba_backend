import express from "express";
import orderController from "../controllers/order.controller.js";
import { protect } from "../middlewares/authMiddleware.js"; // JWT protect middleware

const router = express.Router();

// ==========================================================
// ORDERS ROUTES
// Base: /api/orders
// ==========================================================

// Create a new order
router.post("/", protect, orderController.createOrder);

// Process checkout
router.post("/checkout", protect, orderController.processCheckout);

// Get all orders
router.get("/", protect, orderController.getOrders);

// Bulk update order status
// IMPORTANT: Keep this BEFORE /:id routes
router.patch("/bulk-status", protect, orderController.bulkUpdateStatus);

// Get a single order
router.get("/:id", protect, orderController.getOrderById);

// Update a single order status
router.patch("/:id/status", protect, orderController.updateOrderStatus);

// Delete a single order
router.delete("/:id", protect, orderController.deleteOrder);

export default router;

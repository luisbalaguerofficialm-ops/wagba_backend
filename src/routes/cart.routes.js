import express from "express";

import {
  getCart,
  addToCart,
  increaseQuantity,
  decreaseQuantity,
  removeFromCart,
  clearCart,
} from "../controllers/cart.controller.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get current user's cart
router.get("/", protect, getCart);

// Add product to cart
router.post("/add", protect, addToCart);

// Increase quantity
router.patch("/increase/:productId", protect, increaseQuantity);

// Decrease quantity
router.patch("/decrease/:productId", protect, decreaseQuantity);

// Remove product completely
router.delete("/remove/:productId", protect, removeFromCart);

// Clear entire cart
router.delete("/clear", protect, clearCart);

export default router;

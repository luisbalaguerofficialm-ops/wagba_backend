import express from "express";

import {
  getOrderSummaryForReview,
  submitReview,
  getAllReviews,
  addCommentToReview,
  toggleReaction,
} from "../controllers/review.controller.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================
// PUBLIC
// ==========================================

// Get all reviews
router.get("/", getAllReviews);

// ==========================================
// AUTHENTICATED
// ==========================================

// Get order information before reviewing
router.get("/order/:orderId", protect, getOrderSummaryForReview);

// Submit review
router.post("/", protect, submitReview);

// Add comment
router.post("/:id/comments", protect, addCommentToReview);

// Like / love review
router.post("/:id/react", protect, toggleReaction);

export default router;

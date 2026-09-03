import express from "express";

import {
  addFavorite,
  removeFavorite,
  toggleFavorite,
  getMyFavorites,
  checkFavorite,
} from "../controllers/favorite.controller.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get logged-in user's favorites
router.get("/", protect, getMyFavorites);

// Add favorite
router.post("/add", protect, addFavorite);

// Toggle favorite
router.post("/toggle", protect, toggleFavorite);

// Check favorite status
router.get("/check/:productId", protect, checkFavorite);

// Remove favorite
router.delete("/remove/:productId", protect, removeFavorite);

export default router;

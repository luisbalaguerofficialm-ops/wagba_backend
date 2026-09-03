import express from "express";
import multer from "multer";
import {
  createRestaurant,
  getMyRestaurant,
  updateMyRestaurant,
} from "../controllers/restaurant.controller.js";
import { protect, authorize } from "../middlewares/authMiddleware.js"; // adjust to your actual export name

const router = express.Router();

import upload from "../middlewares/upload.js";
// Accepts two separate file fields: logo and coverImage
const restaurantImageUpload = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

router.post(
  "/",
  protect,
  authorize("admin"),
  restaurantImageUpload,
  createRestaurant,
);
router.get("/me", protect, authorize("admin"), getMyRestaurant);
router.patch(
  "/me",
  protect,
  authorize("admin"),
  restaurantImageUpload,
  updateMyRestaurant,
);

export default router;

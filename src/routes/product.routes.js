import express from "express";
import {
  createProduct,
  getProductCategories,
  getRestaurantProducts,
} from "../controllers/product.controller.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

import upload from "../middlewares/upload.js";

const router = express.Router();

// multer stores the file in memory as a buffer, since your controller
// pipes req.file.buffer straight to Cloudinary via streamifier
// const upload = multer({ storage: multer.memoryStorage() });

// Public - no auth needed to see available categories
router.get("/categories", getProductCategories);

// Protected - restaurant must be logged in
router.get("/", protect, getRestaurantProducts);
router.post(
  "/",
  protect,
  authorize("admin", "manager"),
  upload.single("image"),
  createProduct,
);

export default router;

import express from "express";

import {
  createProduct,
  getProductCategories,
  getAllProducts,
  getRestaurantProducts,
  getProductById,
  updateProductById,
  deleteProductById,
  deleteAllProducts,
} from "../controllers/product.controller.js";

import { protect, authorize } from "../middlewares/authMiddleware.js";

import upload from "../middlewares/upload.js";

const router = express.Router();

// ============================================================
// PUBLIC ROUTES
// ============================================================

// Get product categories
// GET /api/products/categories
router.get("/categories", getProductCategories);

// Get all available products
// GET /api/products
//
// Supports:
// ?category=meals
// ?subcategory=rice
// ?featured=true
// ?available=true
// ?restaurant=REST_ID
// ?search=jollof
// ?page=1
// ?limit=20
router.get("/", getAllProducts);

// ============================================================
// PROTECTED RESTAURANT ROUTES
// ============================================================

// Get all products belonging to logged-in restaurant
// GET /api/products/restaurant/all
router.get(
  "/restaurant/all",
  protect,
  authorize("admin", "manager"),
  getRestaurantProducts,
);

// Create product
// POST /api/products
//
// Content-Type: multipart/form-data
// image = product image
router.post(
  "/",
  protect,
  authorize("admin", "manager"),
  upload.single("image"),
  createProduct,
);

// Delete all products belonging to logged-in restaurant
// DELETE /api/products/restaurant/all
router.delete(
  "/restaurant/all",
  protect,
  authorize("admin", "manager"),
  deleteAllProducts,
);

// ============================================================
// SINGLE PRODUCT ROUTES
// ============================================================

// Get single product
// GET /api/products/:id
router.get("/:id", getProductById);

// Update single product
// PUT /api/products/:id
//
// Content-Type: multipart/form-data
// image = optional new product image
router.put(
  "/:id",
  protect,
  authorize("admin", "manager"),
  upload.single("image"),
  updateProductById,
);

// Delete single product
// DELETE /api/products/:id
router.delete(
  "/:id",
  protect,
  authorize("admin", "manager"),
  deleteProductById,
);

export default router;

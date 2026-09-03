import Product from "../models/product.js";

import productCategories from "../constants/productCategories.js";
import cloudinary from "../configs/cloudinary.js";
import streamifier from "streamifier";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

export const createProduct = tryCatchFn(async (req, res) => {
  const {
    productName,
    category,
    subcategory,
    description,
    price,
    prepTime,
    calories,
    rating,
    available,
    featured,
  } = req.body;

  // ==========================================
  // REQUIRED FIELDS
  // ==========================================

  if (
    !productName ||
    !category ||
    !subcategory ||
    !description ||
    price === undefined ||
    prepTime === undefined
  ) {
    throw responseHandler.errorResponse(
      "Please provide all required product fields",
      400,
    );
  }

  // ==========================================
  // NORMALIZE
  // ==========================================

  const normalizedCategory = category.trim().toLowerCase();

  const normalizedSubcategory = subcategory.trim().toLowerCase();

  // ==========================================
  // CHECK CATEGORY
  // ==========================================

  const categoryConfig = productCategories[normalizedCategory];

  if (!categoryConfig) {
    throw responseHandler.errorResponse("Invalid product category", 400);
  }

  // ==========================================
  // CHECK SUBCATEGORY
  // ==========================================

  if (!categoryConfig.subcategories.includes(normalizedSubcategory)) {
    throw responseHandler.errorResponse(
      `Invalid subcategory for ${categoryConfig.label}`,
      400,
    );
  }

  // ==========================================
  // VALIDATE PRICE
  // ==========================================

  const productPrice = Number(price);

  if (Number.isNaN(productPrice) || productPrice < 0) {
    throw responseHandler.errorResponse(
      "Please provide a valid product price",
      400,
    );
  }

  // ==========================================
  // PREP TIME
  // ==========================================

  const preparationTime = Number(prepTime);

  if (Number.isNaN(preparationTime) || preparationTime < 0) {
    throw responseHandler.errorResponse(
      "Please provide a valid preparation time",
      400,
    );
  }

  // ==========================================
  // CALORIES
  // ==========================================

  const productCalories =
    calories !== undefined && calories !== "" ? Number(calories) : 0;

  if (Number.isNaN(productCalories) || productCalories < 0) {
    throw responseHandler.errorResponse("Please provide valid calories", 400);
  }

  // ==========================================
  // RATING
  // ==========================================

  const productRating =
    rating !== undefined && rating !== "" ? Number(rating) : 0;

  if (Number.isNaN(productRating) || productRating < 0 || productRating > 5) {
    throw responseHandler.errorResponse("Rating must be between 0 and 5", 400);
  }

  // ==========================================
  // IMAGE
  // ==========================================

  if (!req.file) {
    throw responseHandler.errorResponse("Product image is required", 400);
  }

  let productImage = null;

  // ✅ HANDLE IMAGE UPLOAD (if provided)
  if (req.file) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "product" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );

      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    productImage = result.secure_url;
  }

  // ==========================================
  // RESTAURANT
  // ==========================================

  // Assuming your authentication
  // middleware sets req.user

  const restaurantId = req.user.restaurant;

  if (!restaurantId) {
    throw responseHandler.errorResponse("Restaurant account not found", 403);
  }

  // ==========================================
  // CREATE PRODUCT
  // ==========================================

  const product = await Product.create({
    productName: productName.trim(),
    category: normalizedCategory,
    subcategory: normalizedSubcategory,
    description: description.trim(),
    price: productPrice,
    prepTime: preparationTime,
    calories: productCalories,
    rating: productRating,
    available: available !== undefined ? Boolean(available) : true,
    featured: featured !== undefined ? Boolean(featured) : false,
    restaurant: restaurantId,
    image: productImage,
  });

  // ==========================================
  // RESPONSE
  // ==========================================

  return responseHandler.successResponse(
    res,
    {
      product,
    },
    "Product created successfully",
    201,
  );
});

export const getProductCategories = tryCatchFn(async (req, res) => {
  return responseHandler.successResponse(
    res,
    productCategories,
    "Product categories retrieved successfully",
  );
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public / Admin
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching product",
        error: error.message,
      });
  }
};

export const getRestaurantProducts = tryCatchFn(async (req, res) => {
  const { category, subcategory, featured } = req.query;

  const filter = {
    restaurant: req.user.restaurant,
  };

  // ==========================================
  // CATEGORY
  // ==========================================

  if (category) {
    const normalizedCategory = category.trim().toLowerCase();

    if (!productCategories[normalizedCategory]) {
      throw responseHandler.errorResponse("Invalid category", 400);
    }

    filter.category = normalizedCategory;
  }

  // ==========================================
  // SUBCATEGORY
  // ==========================================

  if (subcategory) {
    const normalizedSubcategory = subcategory.trim().toLowerCase();

    if (!category) {
      throw responseHandler.errorResponse(
        "Category is required when filtering by subcategory",
        400,
      );
    }

    const categoryConfig = productCategories[category.trim().toLowerCase()];

    if (!categoryConfig.subcategories.includes(normalizedSubcategory)) {
      throw responseHandler.errorResponse(
        "Invalid subcategory for selected category",
        400,
      );
    }

    filter.subcategory = normalizedSubcategory;
  }

  // ==========================================
  // FEATURED
  // ==========================================

  if (featured === "true") {
    filter.featured = true;
  }

  // ==========================================
  // FETCH
  // ==========================================

  const products = await Product.find(filter).sort({
    createdAt: -1,
  });

  return responseHandler.successResponse(
    res,
    {
      products,
      count: products.length,
    },
    "Products retrieved successfully",
  );
});

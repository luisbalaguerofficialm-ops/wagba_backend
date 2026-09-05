import Product from "../models/product.js";
import productCategories from "../constants/productCategories.js";
import cloudinary from "../configs/cloudinary.js";
import streamifier from "streamifier";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";
import { createNotification } from "../controllers/notification.controller.js";

// ============================================================
// HELPER: UPLOAD IMAGE TO CLOUDINARY
// ============================================================

const uploadProductImage = async (file) => {
  if (!file) return null;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "product",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      },
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

// ============================================================
// HELPER: BOOLEAN VALUE
// ============================================================

const parseBoolean = (value, defaultValue = undefined) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  return defaultValue;
};

// ============================================================
// HELPER: PRODUCT NOTIFICATION
// ============================================================

const notifyProductActivity = async ({
  user,
  title,
  message,
  product,
  action,
}) => {
  if (!user?._id || !product) return;

  await createNotification({
    userId: user._id,
    title,
    message,
    category: "activity",
    type: "activity",
    metadata: {
      productId: product._id,
      productName: product.productName,
      category: product.category,
      subcategory: product.subcategory,
      price: product.price,
      currency: "NGN",
      restaurantId: product.restaurant,
      available: product.available,
      featured: product.featured,
      action,
    },
  });
};

// ============================================================
// CREATE PRODUCT
// ============================================================

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

  // ==========================================================
  // REQUIRED FIELDS
  // ==========================================================

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

  // ==========================================================
  // RESTAURANT
  // ==========================================================

  const restaurantId = req.user?.restaurant;

  if (!restaurantId) {
    throw responseHandler.errorResponse("Restaurant account not found", 403);
  }

  // ==========================================================
  // NORMALIZE
  // ==========================================================

  const normalizedCategory = category.trim().toLowerCase();
  const normalizedSubcategory = subcategory.trim().toLowerCase();

  // ==========================================================
  // CHECK CATEGORY
  // ==========================================================

  const categoryConfig = productCategories[normalizedCategory];

  if (!categoryConfig) {
    throw responseHandler.errorResponse("Invalid product category", 400);
  }

  // ==========================================================
  // CHECK SUBCATEGORY
  // ==========================================================

  if (!categoryConfig.subcategories.includes(normalizedSubcategory)) {
    throw responseHandler.errorResponse(
      `Invalid subcategory for ${categoryConfig.label}`,
      400,
    );
  }

  // ==========================================================
  // PRICE
  // ==========================================================

  const productPrice = Number(price);

  if (Number.isNaN(productPrice) || productPrice < 0) {
    throw responseHandler.errorResponse(
      "Please provide a valid product price",
      400,
    );
  }

  // ==========================================================
  // PREP TIME
  // ==========================================================

  const preparationTime = Number(prepTime);

  if (Number.isNaN(preparationTime) || preparationTime < 0) {
    throw responseHandler.errorResponse(
      "Please provide a valid preparation time",
      400,
    );
  }

  // ==========================================================
  // CALORIES
  // ==========================================================

  const productCalories =
    calories !== undefined && calories !== "" ? Number(calories) : 0;

  if (Number.isNaN(productCalories) || productCalories < 0) {
    throw responseHandler.errorResponse("Please provide valid calories", 400);
  }

  // ==========================================================
  // RATING
  // ==========================================================

  const productRating =
    rating !== undefined && rating !== "" ? Number(rating) : 0;

  if (Number.isNaN(productRating) || productRating < 0 || productRating > 5) {
    throw responseHandler.errorResponse("Rating must be between 0 and 5", 400);
  }

  // ==========================================================
  // IMAGE
  // ==========================================================

  if (!req.file) {
    throw responseHandler.errorResponse("Product image is required", 400);
  }

  const uploadedImage = await uploadProductImage(req.file);

  // ==========================================================
  // CREATE PRODUCT
  // ==========================================================

  const product = await Product.create({
    productName: productName.trim(),
    category: normalizedCategory,
    subcategory: normalizedSubcategory,
    description: description.trim(),
    price: productPrice,
    prepTime: preparationTime,
    calories: productCalories,
    rating: productRating,
    available: parseBoolean(available, true),
    featured: parseBoolean(featured, false),
    restaurant: restaurantId,
    image: uploadedImage.url,
  });

  // ==========================================================
  // PERSONAL NOTIFICATION
  // ==========================================================

  await notifyProductActivity({
    user: req.user,
    title: "Product Created Successfully",
    message: `${product.productName} has been successfully added to your restaurant menu.`,
    product,
    action: "created",
  });

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return responseHandler.successResponse(
    res,
    {
      product,
    },
    "Product created successfully",
    201,
  );
});

// ============================================================
// GET PRODUCT CATEGORIES
// ============================================================

export const getProductCategories = tryCatchFn(async (req, res) => {
  return responseHandler.successResponse(
    res,
    productCategories,
    "Product categories retrieved successfully",
  );
});

// ============================================================
// GET ALL PRODUCTS
// PUBLIC / CUSTOMER
//
// Example:
// GET /api/products
// GET /api/products?category=meals
// GET /api/products?subcategory=rice
// GET /api/products?featured=true
// GET /api/products?available=true
// GET /api/products?search=jollof
// ============================================================

export const getAllProducts = tryCatchFn(async (req, res) => {
  const {
    category,
    subcategory,
    featured,
    available,
    restaurant,
    search,
    page = 1,
    limit = 10,
  } = req.query;

  const filter = {};

  // ==========================================================
  // CATEGORY
  // ==========================================================

  if (category) {
    const normalizedCategory = category.trim().toLowerCase();

    if (!productCategories[normalizedCategory]) {
      throw responseHandler.errorResponse("Invalid product category", 400);
    }

    filter.category = normalizedCategory;
  }

  // ==========================================================
  // SUBCATEGORY
  // ==========================================================

  if (subcategory) {
    const normalizedSubcategory = subcategory.trim().toLowerCase();

    if (!category) {
      throw responseHandler.errorResponse(
        "Category is required when filtering by subcategory",
        400,
      );
    }

    const normalizedCategory = category.trim().toLowerCase();

    const categoryConfig = productCategories[normalizedCategory];

    if (!categoryConfig.subcategories.includes(normalizedSubcategory)) {
      throw responseHandler.errorResponse(
        "Invalid subcategory for selected category",
        400,
      );
    }

    filter.subcategory = normalizedSubcategory;
  }

  // ==========================================================
  // FEATURED
  // ==========================================================

  const featuredValue = parseBoolean(featured);

  if (featuredValue !== undefined) {
    filter.featured = featuredValue;
  }

  // ==========================================================
  // AVAILABLE
  // ==========================================================

  const availableValue = parseBoolean(available);

  if (availableValue !== undefined) {
    filter.available = availableValue;
  } else {
    // Customers should normally only see available products
    filter.available = true;
  }

  // ==========================================================
  // RESTAURANT
  // ==========================================================

  if (restaurant) {
    filter.restaurant = restaurant;
  }

  // ==========================================================
  // SEARCH
  // ==========================================================

  if (search?.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");

    filter.$or = [
      {
        productName: searchRegex,
      },
      {
        description: searchRegex,
      },
      {
        category: searchRegex,
      },
      {
        subcategory: searchRegex,
      },
    ];
  }

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const currentPage = Math.max(Number(page) || 1, 1);
  const itemsPerPage = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const skip = (currentPage - 1) * itemsPerPage;

  // ==========================================================
  // FETCH
  // ==========================================================

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({
        featured: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),

    Product.countDocuments(filter),
  ]);

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return responseHandler.successResponse(
    res,
    {
      products,
      pagination: {
        page: currentPage,
        limit: itemsPerPage,
        total,
        totalPages: Math.ceil(total / itemsPerPage),
        hasNextPage: currentPage < Math.ceil(total / itemsPerPage),
        hasPreviousPage: currentPage > 1,
      },
    },
    "Products retrieved successfully",
  );
});

// ============================================================
// GET RESTAURANT PRODUCTS
// RESTAURANT / ADMIN
// ============================================================

export const getRestaurantProducts = tryCatchFn(async (req, res) => {
  const { category, subcategory, featured } = req.query;

  const restaurantId = req.user?.restaurant;

  if (!restaurantId) {
    throw responseHandler.errorResponse("Restaurant account not found", 403);
  }

  const filter = {
    restaurant: restaurantId,
  };

  // ==========================================================
  // CATEGORY
  // ==========================================================

  if (category) {
    const normalizedCategory = category.trim().toLowerCase();

    if (!productCategories[normalizedCategory]) {
      throw responseHandler.errorResponse("Invalid category", 400);
    }

    filter.category = normalizedCategory;
  }

  // ==========================================================
  // SUBCATEGORY
  // ==========================================================

  if (subcategory) {
    const normalizedSubcategory = subcategory.trim().toLowerCase();

    if (!category) {
      throw responseHandler.errorResponse(
        "Category is required when filtering by subcategory",
        400,
      );
    }

    const normalizedCategory = category.trim().toLowerCase();

    const categoryConfig = productCategories[normalizedCategory];

    if (!categoryConfig.subcategories.includes(normalizedSubcategory)) {
      throw responseHandler.errorResponse(
        "Invalid subcategory for selected category",
        400,
      );
    }

    filter.subcategory = normalizedSubcategory;
  }

  // ==========================================================
  // FEATURED
  // ==========================================================

  if (featured === "true") {
    filter.featured = true;
  }

  // ==========================================================
  // FETCH
  // ==========================================================

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

// ============================================================
// GET PRODUCT BY ID
//
// GET /api/products/:id
// ============================================================

export const getProductById = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);

  if (!product) {
    throw responseHandler.errorResponse("Product not found", 404);
  }

  return responseHandler.successResponse(
    res,
    {
      product,
    },
    "Product retrieved successfully",
  );
});

// ============================================================
// UPDATE PRODUCT BY ID
//
// PUT /api/products/:id
// PATCH /api/products/:id
//
// Restaurant can only update its own product.
// ============================================================

export const updateProductById = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  const restaurantId = req.user?.restaurant;

  if (!restaurantId) {
    throw responseHandler.errorResponse("Restaurant account not found", 403);
  }

  // ==========================================================
  // FIND PRODUCT
  // ==========================================================

  const product = await Product.findOne({
    _id: id,
    restaurant: restaurantId,
  });

  if (!product) {
    throw responseHandler.errorResponse(
      "Product not found or you do not have permission to update it",
      404,
    );
  }

  // ==========================================================
  // KEEP OLD VALUES
  // ==========================================================

  const previousProduct = {
    productName: product.productName,
    category: product.category,
    subcategory: product.subcategory,
    price: product.price,
    available: product.available,
    featured: product.featured,
  };

  // ==========================================================
  // PRODUCT NAME
  // ==========================================================

  if (req.body.productName !== undefined) {
    const productName = req.body.productName.trim();

    if (!productName) {
      throw responseHandler.errorResponse("Product name cannot be empty", 400);
    }

    product.productName = productName;
  }

  // ==========================================================
  // CATEGORY
  // ==========================================================

  let normalizedCategory = product.category;

  if (req.body.category !== undefined) {
    normalizedCategory = req.body.category.trim().toLowerCase();

    if (!productCategories[normalizedCategory]) {
      throw responseHandler.errorResponse("Invalid product category", 400);
    }

    product.category = normalizedCategory;
  }

  // ==========================================================
  // SUBCATEGORY
  // ==========================================================

  let normalizedSubcategory = product.subcategory;

  if (req.body.subcategory !== undefined) {
    normalizedSubcategory = req.body.subcategory.trim().toLowerCase();

    const categoryConfig = productCategories[normalizedCategory];

    if (!categoryConfig) {
      throw responseHandler.errorResponse("Invalid product category", 400);
    }

    if (!categoryConfig.subcategories.includes(normalizedSubcategory)) {
      throw responseHandler.errorResponse(
        `Invalid subcategory for ${categoryConfig.label}`,
        400,
      );
    }

    product.subcategory = normalizedSubcategory;
  } else {
    // If category changed, make sure existing subcategory
    // still belongs to the new category.
    const categoryConfig = productCategories[normalizedCategory];

    if (
      categoryConfig &&
      !categoryConfig.subcategories.includes(normalizedSubcategory)
    ) {
      throw responseHandler.errorResponse(
        `Invalid subcategory for ${categoryConfig.label}`,
        400,
      );
    }
  }

  // ==========================================================
  // DESCRIPTION
  // ==========================================================

  if (req.body.description !== undefined) {
    const description = req.body.description.trim();

    if (!description) {
      throw responseHandler.errorResponse("Description cannot be empty", 400);
    }

    product.description = description;
  }

  // ==========================================================
  // PRICE
  // ==========================================================

  if (req.body.price !== undefined) {
    const productPrice = Number(req.body.price);

    if (Number.isNaN(productPrice) || productPrice < 0) {
      throw responseHandler.errorResponse(
        "Please provide a valid product price",
        400,
      );
    }

    product.price = productPrice;
  }

  // ==========================================================
  // PREP TIME
  // ==========================================================

  if (req.body.prepTime !== undefined) {
    const preparationTime = Number(req.body.prepTime);

    if (Number.isNaN(preparationTime) || preparationTime < 0) {
      throw responseHandler.errorResponse(
        "Please provide a valid preparation time",
        400,
      );
    }

    product.prepTime = preparationTime;
  }

  // ==========================================================
  // CALORIES
  // ==========================================================

  if (req.body.calories !== undefined) {
    const productCalories =
      req.body.calories === "" ? 0 : Number(req.body.calories);

    if (Number.isNaN(productCalories) || productCalories < 0) {
      throw responseHandler.errorResponse("Please provide valid calories", 400);
    }

    product.calories = productCalories;
  }

  // ==========================================================
  // RATING
  // ==========================================================

  if (req.body.rating !== undefined) {
    const productRating = req.body.rating === "" ? 0 : Number(req.body.rating);

    if (Number.isNaN(productRating) || productRating < 0 || productRating > 5) {
      throw responseHandler.errorResponse(
        "Rating must be between 0 and 5",
        400,
      );
    }

    product.rating = productRating;
  }

  // ==========================================================
  // AVAILABLE
  // ==========================================================

  if (req.body.available !== undefined) {
    product.available = parseBoolean(req.body.available, product.available);
  }

  // ==========================================================
  // FEATURED
  // ==========================================================

  if (req.body.featured !== undefined) {
    product.featured = parseBoolean(req.body.featured, product.featured);
  }

  // ==========================================================
  // IMAGE
  // ==========================================================

  if (req.file) {
    const uploadedImage = await uploadProductImage(req.file);

    product.image = uploadedImage.url;
  }

  // ==========================================================
  // SAVE
  // ==========================================================

  await product.save();

  // ==========================================================
  // NOTIFICATION
  // ==========================================================

  await notifyProductActivity({
    user: req.user,
    title: "Product Updated Successfully",
    message: `${product.productName} has been successfully updated.`,
    product,
    action: "updated",
  });

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return responseHandler.successResponse(
    res,
    {
      product,
      changes: {
        productNameChanged: previousProduct.productName !== product.productName,

        categoryChanged: previousProduct.category !== product.category,

        subcategoryChanged: previousProduct.subcategory !== product.subcategory,

        priceChanged: previousProduct.price !== product.price,

        availabilityChanged: previousProduct.available !== product.available,

        featuredChanged: previousProduct.featured !== product.featured,

        imageUpdated: Boolean(req.file),
      },
    },
    "Product updated successfully",
  );
});

// ============================================================
// DELETE SINGLE PRODUCT
//
// DELETE /api/products/:id
// ============================================================

export const deleteProductById = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  const restaurantId = req.user?.restaurant;

  if (!restaurantId) {
    throw responseHandler.errorResponse("Restaurant account not found", 403);
  }

  // ==========================================================
  // FIND PRODUCT
  // ==========================================================

  const product = await Product.findOne({
    _id: id,
    restaurant: restaurantId,
  });

  if (!product) {
    throw responseHandler.errorResponse(
      "Product not found or you do not have permission to delete it",
      404,
    );
  }

  // ==========================================================
  // SAVE PRODUCT INFO BEFORE DELETE
  // ==========================================================

  const deletedProduct = {
    _id: product._id,
    productName: product.productName,
    category: product.category,
    subcategory: product.subcategory,
    price: product.price,
    restaurant: product.restaurant,
  };

  // ==========================================================
  // DELETE
  // ==========================================================

  await Product.deleteOne({
    _id: product._id,
  });

  // ==========================================================
  // NOTIFICATION
  // ==========================================================

  await createNotification({
    userId: req.user._id,
    title: "Product Deleted",
    message: `${deletedProduct.productName} has been removed from your restaurant menu.`,
    category: "activity",
    type: "activity",
    metadata: {
      productId: deletedProduct._id,
      productName: deletedProduct.productName,
      category: deletedProduct.category,
      subcategory: deletedProduct.subcategory,
      price: deletedProduct.price,
      currency: "NGN",
      restaurantId: deletedProduct.restaurant,
      action: "deleted",
    },
  });

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return responseHandler.successResponse(
    res,
    {
      product: deletedProduct,
    },
    "Product deleted successfully",
  );
});

// ============================================================
// DELETE ALL PRODUCTS
//
// DELETE /api/products/restaurant/all
//
// Deletes ONLY products belonging to the logged-in restaurant.
// ============================================================

export const deleteAllProducts = tryCatchFn(async (req, res) => {
  const restaurantId = req.user?.restaurant;

  if (!restaurantId) {
    throw responseHandler.errorResponse("Restaurant account not found", 403);
  }

  // ==========================================================
  // COUNT PRODUCTS
  // ==========================================================

  const productCount = await Product.countDocuments({
    restaurant: restaurantId,
  });

  if (productCount === 0) {
    throw responseHandler.errorResponse(
      "No products found for this restaurant",
      404,
    );
  }

  // ==========================================================
  // DELETE ALL
  // ==========================================================

  const result = await Product.deleteMany({
    restaurant: restaurantId,
  });

  // ==========================================================
  // NOTIFICATION
  // ==========================================================

  await createNotification({
    userId: req.user._id,
    title: "All Products Deleted",
    message: `${result.deletedCount} product${result.deletedCount === 1 ? "" : "s"} have been removed from your restaurant menu.`,
    category: "activity",
    type: "activity",
    metadata: {
      restaurantId,
      deletedCount: result.deletedCount,
      currency: "NGN",
      action: "delete_all",
    },
  });

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return responseHandler.successResponse(
    res,
    {
      deletedCount: result.deletedCount,
    },
    "All restaurant products deleted successfully",
  );
});

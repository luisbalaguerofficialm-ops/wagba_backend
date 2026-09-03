import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    // =====================================
    // PRODUCT INFORMATION
    // =====================================
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters"],
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["meals", "soft-drinks", "sides", "beverages", "meats", "combo"],
      lowercase: true,
      trim: true,
    },

    subcategory: {
      type: String,
      required: [true, "Subcategory is required"],
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // =====================================
    // PRODUCT DETAILS
    // =====================================
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },

    prepTime: {
      type: Number,
      required: [true, "Preparation time is required"],
      min: [0, "Preparation time cannot be negative"],
    },

    calories: {
      type: Number,
      default: 0,
      min: [0, "Calories cannot be negative"],
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    // =====================================
    // IMAGE
    // =====================================
    image: {
      type: String,
      required: [true, "Product image is required"],
      trim: true,
    },

    // =====================================
    // PRODUCT STATUS
    // =====================================
    available: {
      type: Boolean,
      default: true,
      index: true,
    },

    featured: {
      type: Boolean,
      default: false,
      index: true,
    },

    // =====================================
    // RESTAURANT
    // =====================================
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// =====================================
// SEARCH INDEX
// =====================================
// Allows text searches such as:
//
// "jollof"
// "chicken"
// "rice"
// "egusi soup"
//
// Search is performed against productName
// and description.
productSchema.index({
  productName: "text",
  description: "text",
});

// =====================================
// FILTERING INDEXES
// =====================================

// Restaurant + Category + Subcategory
productSchema.index({
  restaurant: 1,
  category: 1,
  subcategory: 1,
});

// Restaurant + Category
productSchema.index({
  restaurant: 1,
  category: 1,
});

// Restaurant + Featured
productSchema.index({
  restaurant: 1,
  featured: 1,
});

// Restaurant + Availability
productSchema.index({
  restaurant: 1,
  available: 1,
});

// Category + Availability
productSchema.index({
  category: 1,
  available: 1,
});

// Price filtering
productSchema.index({
  price: 1,
});

// Rating filtering/sorting
productSchema.index({
  rating: -1,
});

// =====================================
// PREVENT OVERWRITE MODEL ERROR
// =====================================
const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;

import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema(
  {
    // =====================================
    // OWNER
    // =====================================
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Restaurant owner is required"],
      index: true,
    },

    // =====================================
    // BUSINESS INFORMATION
    // =====================================
    name: {
      type: String,
      required: [true, "Restaurant name is required"],
      trim: true,
      minlength: [2, "Restaurant name must be at least 2 characters"],
      maxlength: [100, "Restaurant name cannot exceed 100 characters"],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    email: {
      type: String,
      required: [true, "Restaurant email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    phone: {
      type: String,
      required: [true, "Restaurant phone number is required"],
      trim: true,
    },

    cuisineType: {
      type: [String],
      default: [],
    },

    // =====================================
    // MEDIA
    // =====================================
    logo: {
      type: String,
      trim: true,
      default: null,
    },

    coverImage: {
      type: String,
      trim: true,
      default: null,
    },

    // =====================================
    // LOCATION
    // =====================================
    address: {
      type: String,
      required: [true, "Restaurant address is required"],
      trim: true,
    },

    state: {
      type: String,
      required: [true, "State is required"],
      lowercase: true,
      trim: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },

    // =====================================
    // OPERATIONS
    // =====================================
    openingTime: {
      type: String, // e.g. "08:00"
      trim: true,
    },

    closingTime: {
      type: String, // e.g. "22:00"
      trim: true,
    },

    // =====================================
    // RATINGS
    // =====================================
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalRatings: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================
    // STATUS
    // =====================================
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// =====================================
// AUTO-GENERATE SLUG FROM NAME
// =====================================
restaurantSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// =====================================
// SEARCH INDEX
// =====================================
restaurantSchema.index({
  name: "text",
  description: "text",
});

// =====================================
// FILTERING INDEXES
// =====================================
restaurantSchema.index({ state: 1, isActive: 1 });
restaurantSchema.index({ isActive: 1, isVerified: 1 });
restaurantSchema.index({ rating: -1 });
restaurantSchema.index({ location: "2dsphere" });

// =====================================
// PREVENT OVERWRITE MODEL ERROR
// =====================================
const Restaurant =
  mongoose.models.Restaurant || mongoose.model("Restaurant", restaurantSchema);

export default Restaurant;

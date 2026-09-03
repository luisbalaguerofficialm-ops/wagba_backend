import mongoose from "mongoose";

// ==========================================================
// IDENTITY DOCUMENT SCHEMA
// ==========================================================

const identityDocumentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Document name is required"],
      trim: true,
    },

    url: {
      type: String,
      required: [true, "Document URL is required"],
      trim: true,
    },

    status: {
      type: String,
      enum: ["Verified", "Pending", "Rejected"],
      default: "Pending",
    },
  },
  {
    _id: true,
  },
);

// ==========================================================
// RIDER ACTIVITY SCHEMA
// ==========================================================

const riderActivitySchema = new mongoose.Schema(
  {
    time: {
      type: String,
      required: [true, "Activity time is required"],
      trim: true,
    },

    title: {
      type: String,
      required: [true, "Activity title is required"],
      trim: true,
    },

    subtitle: {
      type: String,
      default: "",
      trim: true,
    },

    type: {
      type: String,
      enum: ["delivered", "pickup", "break", "login"],
      default: "delivered",
    },
  },
  {
    timestamps: true,
  },
);

// ==========================================================
// RIDER DELIVERY SCHEMA
// ==========================================================

const deliverySchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, "Order ID is required"],
      trim: true,
    },

    dateTime: {
      type: Date,
      default: Date.now,
    },

    restaurant: {
      type: String,
      required: [true, "Restaurant name is required"],
      trim: true,
    },

    amount: {
      type: Number,
      required: [true, "Delivery amount is required"],
      min: 0,
    },

    status: {
      type: String,
      enum: ["DELIVERED", "CANCELLED", "PENDING", "IN_TRANSIT"],
      default: "DELIVERED",
    },

    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },

    feedbackReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// ==========================================================
// RIDER SCHEMA
// ==========================================================

const riderSchema = new mongoose.Schema(
  {
    // ======================================================
    // RIDER IDENTIFICATION
    // ======================================================

    riderCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },

    // ======================================================
    // PERSONAL INFORMATION
    // ======================================================

    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    homeAddress: {
      type: String,
      required: [true, "Home address is required"],
      trim: true,
    },

    // ======================================================
    // VEHICLE DETAILS
    // ======================================================

    vehicleType: {
      type: String,
      enum: ["bike", "bicycle", "car"],
      required: [true, "Vehicle type is required"],
    },

    vehicleModel: {
      type: String,
      default: "",
      trim: true,
    },

    registrationNumber: {
      type: String,
      uppercase: true,
      default: "",
      trim: true,
    },

    color: {
      type: String,
      default: "",
      trim: true,
    },

    // ======================================================
    // UPLOADED DOCUMENTS
    // ======================================================

    profilePhoto: {
      type: String,
      default: "",
      trim: true,
    },

    profilePhotoPublicId: {
      type: String,
      default: "",
      trim: true,
    },

    identityDocuments: {
      type: [identityDocumentSchema],
      default: [],
    },

    insuranceDocument: {
      type: String,
      default: "",
      trim: true,
    },

    insuranceDocumentPublicId: {
      type: String,
      default: "",
      trim: true,
    },

    // ======================================================
    // PERFORMANCE & RATINGS
    // ======================================================

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedOrdersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    cancelledOrdersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    hasTopRatedBadge: {
      type: Boolean,
      default: false,
    },

    topRatedBadgeSubtitle: {
      type: String,
      default: "",
      trim: true,
    },

    // ======================================================
    // ACCOUNT STATUS
    // ======================================================

    status: {
      type: String,
      enum: ["offline", "available", "on_delivery", "awaiting_assignment"],
      default: "offline",
      index: true,
    },

    statusMessage: {
      type: String,
      default: "",
      trim: true,
    },

    assignedZone: {
      type: String,
      enum: ["all", "downtown", "north", "east"],
      default: "all",
      index: true,
    },

    // ======================================================
    // CURRENT ASSIGNMENT
    // ======================================================

    currentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    // ======================================================
    // RIDER ACTIVITY
    // ======================================================

    activities: {
      type: [riderActivitySchema],
      default: [],
    },

    // ======================================================
    // DELIVERY HISTORY
    // ======================================================

    deliveries: {
      type: [deliverySchema],
      default: [],
    },

    // ======================================================
    // ACCOUNT FLAGS
    // ======================================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true,
  },
);

// ==========================================================
// INDEXES
// ==========================================================

riderSchema.index({
  status: 1,
  assignedZone: 1,
});

riderSchema.index({
  phone: 1,
});

riderSchema.index({
  createdAt: -1,
});

// ==========================================================
// GENERATE RIDER CODE
// ==========================================================

riderSchema.pre("validate", async function (next) {
  if (this.riderCode) {
    return next();
  }

  try {
    let riderCode;
    let exists = true;

    while (exists) {
      const randomNumber = Math.floor(100000 + Math.random() * 900000);

      riderCode = `WAG-RID-${randomNumber}`;

      exists = await mongoose.models.Rider.exists({
        riderCode,
      });
    }

    this.riderCode = riderCode;

    return next();
  } catch (error) {
    return next(error);
  }
});

// ==========================================================
// MODEL
// ==========================================================

const Rider = mongoose.models.Rider || mongoose.model("Rider", riderSchema);

export default Rider;

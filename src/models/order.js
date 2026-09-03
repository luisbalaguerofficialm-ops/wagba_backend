import mongoose from "mongoose";

// ==========================================================
// ORDER ITEM SCHEMA
// ==========================================================
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    image: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  },
);

// ==========================================================
// ORDER SCHEMA
// ==========================================================
const OrderSchema = new mongoose.Schema(
  {
    // ======================================================
    // USER
    // ======================================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ======================================================
    // ORDER ID
    // ======================================================
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // ======================================================
    // CUSTOMER INFORMATION
    // ======================================================
    customer: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
      },

      phone: {
        type: String,
        trim: true,
      },
    },

    // ======================================================
    // DELIVERY ADDRESS
    // ======================================================
    addressType: {
      type: String,
      enum: ["home", "work"],
      default: "home",
    },

    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    isForFriend: {
      type: Boolean,
      default: false,
    },

    // ======================================================
    // PAYMENT METHOD
    // ======================================================
    paymentMethod: {
      type: String,
      enum: ["Transfer", "transfer", "wallet", "Wallet"],
      required: true,
    },

    // ======================================================
    // TRANSFER DETAILS
    // ======================================================
    transferDetails: {
      userAccountNumber: {
        type: String,
        trim: true,
      },

      userAccountName: {
        type: String,
        trim: true,
      },

      transferredToBank: {
        type: String,
        trim: true,
      },

      transferredToAccountNumber: {
        type: String,
        trim: true,
      },
    },

    // ======================================================
    // RECEIVING BANK
    // ======================================================
    receivingBank: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ======================================================
    // SENDER BANK ACCOUNT
    // ======================================================
    senderAccountDetails: {
      accountNumber: {
        type: String,
        trim: true,
      },

      accountName: {
        type: String,
        trim: true,
      },
    },

    // ======================================================
    // ORDER ITEMS
    // ======================================================
    items: {
      type: [orderItemSchema],
      required: true,

      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },

        message: "Order must contain at least one item.",
      },
    },

    // ======================================================
    // PRICING
    // ======================================================
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    deliveryFee: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ======================================================
    // PAYMENT STATUS
    // ======================================================
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending", "Pending_Verification", "Failed", "Refunded"],

      default: "Pending",

      index: true,
    },

    // ======================================================
    // ORDER STATUS
    // ======================================================
    orderStatus: {
      type: String,

      enum: [
        "Pending",
        "Processing",
        "Preparing",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Awaiting_Transfer",
      ],

      default: "Pending",

      index: true,
    },
  },

  {
    timestamps: true,
  },
);

// ==========================================================
// GENERATE ORDER ID AUTOMATICALLY
// ==========================================================
OrderSchema.pre("validate", async function (next) {
  if (this.orderId) {
    return next();
  }

  try {
    let orderId;
    let exists = true;

    while (exists) {
      const randomNumber = Math.floor(100000 + Math.random() * 900000);

      orderId = `WAG-${Date.now()}-${randomNumber}`;

      exists = await mongoose.models.Order.exists({
        orderId,
      });
    }

    this.orderId = orderId;

    next();
  } catch (error) {
    next(error);
  }
});

// ==========================================================
// AUTOMATIC CUSTOMER INFORMATION
// ==========================================================
// If customer information wasn't supplied when creating
// the order, get it from the User document.
// ==========================================================
OrderSchema.pre("validate", async function (next) {
  try {
    if (!this.userId) {
      return next();
    }

    // If all customer information already exists,
    // don't query the User again.
    if (this.customer?.name && this.customer?.email && this.customer?.phone) {
      return next();
    }

    const User = mongoose.model("User");

    const user = await User.findById(this.userId).select(
      "name fullName firstName lastName email phone",
    );

    if (!user) {
      return next(new Error("User associated with this order was not found."));
    }

    const customerName =
      user.name ||
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      "Customer";

    this.customer = {
      name: customerName,
      email: user.email || "",
      phone: user.phone || "",
    };

    next();
  } catch (error) {
    next(error);
  }
});

// ==========================================================
// INDEXES
// ==========================================================

// User's latest orders
OrderSchema.index({
  userId: 1,
  createdAt: -1,
});

// Admin order dashboard
OrderSchema.index({
  orderStatus: 1,
  createdAt: -1,
});

// Payment tracking
OrderSchema.index({
  paymentStatus: 1,
  createdAt: -1,
});

// Date sorting
OrderSchema.index({
  createdAt: -1,
});

// ==========================================================
// MODEL
// ==========================================================
const Order = mongoose.model("Order", OrderSchema);

export default Order;

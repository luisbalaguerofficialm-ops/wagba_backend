import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    // ==========================================
    // PERSONAL NOTIFICATION OWNER
    // ==========================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ==========================================
    // BROADCAST NOTIFICATION
    // ==========================================

    isBroadcast: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ==========================================
    // CATEGORY
    // ==========================================

    category: {
      type: String,
      enum: ["transaction", "security", "system", "activity", "orders"],
      default: "system",
      index: true,
    },

    // ==========================================
    // TYPE
    // ==========================================

    type: {
      type: String,
      enum: [
        "system",
        "security",
        "transaction",
        "activity",
        "authentication",
        "order",
        "payment",
        "delivery",
        "restaurant",
      ],
      default: "system",
      index: true,
    },

    // ==========================================
    // TITLE
    // ==========================================

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      index: true,
    },

    // ==========================================
    // MESSAGE
    // ==========================================

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    // ==========================================
    // PERSONAL NOTIFICATION READ STATUS
    // ==========================================

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ==========================================
    // BROADCAST READ USERS
    // ==========================================

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ==========================================
    // TARGET AUDIENCE
    // ==========================================

    target: {
      type: String,
      enum: ["All Users", "Verified Users", "Inactive Users", "Specific User"],
      default: "Specific User",
      index: true,
    },

    // ==========================================
    // SPECIFIC USER
    // ==========================================

    specificUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ==========================================
    // DELIVERY CHANNELS
    // ==========================================

    channels: [
      {
        type: String,
        enum: ["InApp", "SMS", "Email"],
      },
    ],

    // ==========================================
    // DELIVERY STATUS
    // ==========================================

    status: {
      type: String,
      enum: ["Pending", "Delivered", "Failed"],
      default: "Pending",
      index: true,
    },

    // ==========================================
    // NUMBER OF RECIPIENTS
    // ==========================================

    sentToCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // DELIVERY TIME
    // ==========================================

    deliveryTime: {
      type: Date,
      default: null,
    },

    // ==========================================
    // CREATED BY
    // ==========================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdByType: {
      type: String,
      enum: ["system", "admin", "manager", "superadmin"],
      default: "system",
    },

    // ==========================================
    // EXTRA DATA
    //
    // Useful for:
    // Order ID
    // Payment reference
    // Amount
    // Payment method
    // Transaction reference
    // Restaurant ID
    // Delivery information
    // ==========================================

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ==========================================
// INDEXES
// ==========================================

NotificationSchema.index({
  title: "text",
  message: "text",
});

NotificationSchema.index({
  createdAt: -1,
});

NotificationSchema.index({
  status: 1,
  category: 1,
});

NotificationSchema.index({
  user: 1,
  read: 1,
});

NotificationSchema.index({
  isBroadcast: 1,
  target: 1,
});

// ==========================================
// SYNC TYPE / CATEGORY
// ==========================================

NotificationSchema.pre("save", function (next) {
  if (!this.type && this.category) {
    this.type = this.category;
  }

  if (!this.category && this.type) {
    if (["payment", "transaction"].includes(this.type)) {
      this.category = "transaction";
    } else if (["order", "delivery"].includes(this.type)) {
      this.category = "orders";
    } else {
      this.category = "system";
    }
  }

  next();
});

// ==========================================
// MODEL
// ==========================================

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);

export default Notification;

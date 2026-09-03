import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    // ==========================================
    // PERSONAL NOTIFICATION OWNER
    // Null when this is a broadcast notification
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
      index: true,
    },

    // ==========================================
    // TYPE
    // Kept for backward compatibility
    // ==========================================

    type: {
      type: String,
      enum: [
        "system",
        "security",
        "transaction",
        "activity",
        "authentication",
        "support",
        "order",
      ],
      index: true,
    },

    // ==========================================
    // TITLE
    // ==========================================

    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ==========================================
    // MESSAGE
    // ==========================================

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================
    // PERSONAL NOTIFICATIONS ONLY
    // ==========================================

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ==========================================
    // BROADCAST NOTIFICATIONS ONLY
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
    // EXTRA METADATA
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
    this.category = this.type;
  }

  next();
});

// ==========================================
// MODEL
// Prevent OverwriteModelError during
// hot reload / development
// ==========================================

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);

// ==========================================
// EXPORT
// ==========================================

export default Notification;

import mongoose from "mongoose";

// Sub-schema for user comments on a review
const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Comment text is required"],
      trim: true,
      maxlength: [500, "Comment text cannot exceed 500 characters"],
    },
  },
  { timestamps: true },
);

// Main Review Schema
const reviewSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true, // Prevents duplicate reviews for the same order
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: [true, "Please provide a rating"],
      min: 1,
      max: 5,
    },
    tags: [
      {
        type: String,
        enum: [
          "Great Taste",
          "Fast Delivery",
          "Perfect Portion",
          "Well Packaged",
          "Hot Food",
        ],
      },
    ],
    comment: {
      type: String,
      maxlength: [500, "Review comment cannot exceed 500 characters"],
      default: "",
    },
    images: [{ type: String }], // Array of uploaded image URLs
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    // Official response from management/store
    ownerReply: {
      text: { type: String, default: null },
      repliedAt: { type: Date, default: null },
    },
    // Reaction arrays storing user ObjectIds
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    loves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Embedded user comments on this review
    comments: [commentSchema],
  },
  { timestamps: true },
);

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;

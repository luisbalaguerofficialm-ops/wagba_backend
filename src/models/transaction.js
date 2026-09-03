import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: ["TOPUP_CARD", "TOPUP_PAYSTACK", "TRANSFER", "WITHDRAWAL"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    reference: {
      type: String,
      unique: true,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

export default mongoose.model("Transaction", transactionSchema);

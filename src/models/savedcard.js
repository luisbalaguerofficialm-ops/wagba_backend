import mongoose from "mongoose";

const savedCardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paystackCardRef: {
      type: String,
      required: true,
      unique: true, // Paystack returns this for saved cards
    },
    last4: {
      type: String,
      required: true,
    },
    cardType: {
      type: String,
      enum: ["Visa", "MasterCard", "Verve", "Others"],
      required: true,
    },
    cardBrand: {
      type: String,
      enum: ["Credit", "Debit", "Unknown"],
      default: "Unknown",
    },
    expiryMonth: {
      type: String,
      required: true,
    },
    expiryYear: {
      type: String,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.model("SavedCard", savedCardSchema);

import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    bankCode: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      required: true,
    },
    recipientCode: {
      type: String, // Paystack Transfer Recipient Code (NUBAN)
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Prevent duplicate bank account registrations per user
bankAccountSchema.index(
  { userId: 1, accountNumber: 1, bankCode: 1 },
  { unique: true },
);

export default mongoose.model("BankAccount", bankAccountSchema);

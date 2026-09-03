import mongoose from "mongoose";

const bitcoinTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paystackReference: {
      type: String,
      required: true,
    },
    amountUsd: {
      type: Number,
      required: true,
    },
    bitcoinAmount: {
      type: Number,
      required: true,
    },
    exchangeRate: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    walletAddress: {
      type: String, // Where the BTC is sent
    },
    txHash: {
      type: String, // Bitcoin blockchain transaction hash
    },
  },
  { timestamps: true },
);

export default mongoose.model("BitcoinTransaction", bitcoinTransactionSchema);

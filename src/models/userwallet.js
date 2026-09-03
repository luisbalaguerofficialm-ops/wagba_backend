import mongoose from "mongoose";

const userWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0.0,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },

    phoneNumber: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("UserWallet", userWalletSchema);

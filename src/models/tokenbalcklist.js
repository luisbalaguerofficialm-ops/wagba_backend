import mongoose from "mongoose";

const tokenBlacklistSchema = new mongoose.Schema(
  {
    // ==========================================
    // BLACKLISTED ACCESS TOKEN
    // ==========================================

    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ==========================================
    // TOKEN EXPIRATION
    // MongoDB TTL automatically deletes the
    // document when this date is reached.
    // ==========================================

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// ==========================================
// TTL INDEX
// MongoDB automatically removes the token
// after expiresAt is reached.
// ==========================================

tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ==========================================
// MODEL
// ==========================================

const TokenBlacklist =
  mongoose.models.TokenBlacklist ||
  mongoose.model("TokenBlacklist", tokenBlacklistSchema);

export default TokenBlacklist;

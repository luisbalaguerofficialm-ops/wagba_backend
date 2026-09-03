import mongoose from "mongoose";

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["Admin", "Manager", "Support", "Delivery Lead"],
    },

    permissions: {
      manageOrders: {
        type: Boolean,
        default: false,
      },

      editProducts: {
        type: Boolean,
        default: false,
      },

      viewRevenue: {
        type: Boolean,
        default: false,
      },

      deleteUsers: {
        type: Boolean,
        default: false,
      },
    },
  },
  { _id: false },
);

const systemSettingsSchema = new mongoose.Schema(
  {
    // ==========================================
    // GENERAL OPTIONS
    // ==========================================

    platformStatus: {
      type: Boolean,
      default: true,
    },

    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    defaultCurrency: {
      type: String,
      enum: ["NGN", "USD"],
      default: "NGN",
    },

    serviceFeePercentage: {
      type: Number,
      default: 2.5,
      min: 0,
      max: 100,
    },

    // ==========================================
    // ROLE-BASED ACCESS CONTROL
    // ==========================================

    rolePermissions: {
      type: [rolePermissionSchema],
      default: [],
    },

    // ==========================================
    // PAYMENT SETTINGS
    // ==========================================

    onlinePaymentsEnabled: {
      type: Boolean,
      default: true,
    },

    paymentDestination: {
      type: String,
      enum: ["Bank Account", "Cryptocurrency Wallet"],
      default: "Bank Account",
    },

    // ==========================================
    // BANK ACCOUNT
    // ==========================================

    bankAccount: {
      accountName: {
        type: String,
        default: "Wagba Logistics Ltd",
        trim: true,
      },

      bankName: {
        type: String,
        default: "Zenith Bank",
        trim: true,
      },

      accountNumber: {
        type: String,
        default: "1012345678",
        trim: true,
      },

      accountType: {
        type: String,
        enum: ["Savings", "Current"],
        default: "Current",
      },

      currency: {
        type: String,
        enum: ["NGN", "USD"],
        default: "NGN",
      },
    },

    // ==========================================
    // CRYPTOCURRENCY WALLET
    // ==========================================

    cryptoWallet: {
      asset: {
        type: String,
        enum: ["Bitcoin", "USDT", "Ethereum"],
        default: "USDT",
      },

      network: {
        type: String,
        default: "",
        trim: true,
      },

      walletAddress: {
        type: String,
        default: "",
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Prevent OverwriteModelError during development/hot reload
const SystemSettings =
  mongoose.models.SystemSettings ||
  mongoose.model("SystemSettings", systemSettingsSchema);

export default SystemSettings;

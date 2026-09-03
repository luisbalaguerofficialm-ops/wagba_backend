import express from "express";

import {
  getSettings,
  updateSettings,
  updateBankDetails,
  updateCryptoWallet,
  addRole,
} from "../controllers/systemsettings.controller.js";

import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================
// SYSTEM SETTINGS
// ==========================================

// GET settings
// PUT settings
router
  .route("/")
  .get(protect, authorize("admin"), getSettings)
  .put(protect, authorize("admin"), updateSettings);

// ==========================================
// BANK DETAILS
// ==========================================

router.patch("/bank", protect, authorize("admin"), updateBankDetails);

// ==========================================
// CRYPTO WALLET
// ==========================================

router.patch("/crypto", protect, authorize("admin"), updateCryptoWallet);

// ==========================================
// ROLES
// ==========================================

router.post("/roles", protect, authorize("admin"), addRole);

// ==========================================
// EXPORT
// ==========================================

export default router;

import express from "express";

import {
  processPayment,
  verifyAndCompletePayment,
  topUpFromSavedCard,
  transferWalletFunds,
  getBanksList,
  verifyBankAccountDetails,
  saveBankAccount,
  getUserBankAccounts,
  withdrawFunds,
} from "../controllers/payment.controller.js";

const router = express.Router();

// ==========================================
// PAYSTACK PAYMENT
// ==========================================

// Initialize Paystack card payment
router.post("/process-payment", processPayment);

// Verify completed Paystack payment
router.get("/verify-payment", verifyAndCompletePayment);

// Top up wallet using a previously saved Paystack authorization
router.post("/topup-saved-card", topUpFromSavedCard);

// ==========================================
// WALLET TRANSFERS
// ==========================================

// Wallet-to-wallet transfer
router.post("/transfer", transferWalletFunds);

// ==========================================
// BANK ACCOUNTS
// ==========================================

// Get supported Nigerian banks
router.get("/banks", getBanksList);

// Verify bank account number and account name
router.post("/verify-account", verifyBankAccountDetails);

// Save verified bank account
router.post("/save-account", saveBankAccount);

// Get user's saved bank accounts
router.get("/user-accounts/:userId", getUserBankAccounts);

// ==========================================
// WALLET WITHDRAWAL
// ==========================================

// Withdraw wallet balance to bank account
router.post("/withdraw", withdrawFunds);

export default router;

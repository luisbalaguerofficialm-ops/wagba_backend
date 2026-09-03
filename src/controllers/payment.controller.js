import responseHandler from "../libs/responseHandler.js";
import mongoose from "mongoose";

import {
  initializePayment,
  verifyPayment,
  chargeAuthorization,
  fetchSupportedBanks,
  resolveAccountNumber,
  createTransferRecipient,
  initiateTransfer,
} from "../services/paystackservices.js";

import { purchaseBitcoin } from "../services/bitcoinService.js";

import User from "../models/user.js";
import UserWallet from "../models/userwallet.js";
import SavedCard from "../models/savedcard.js";
import BankAccount from "../models/bankaccount.js";
import Transaction from "../models/transaction.js";

/**
 * ============================================================
 * 1. INITIALIZE PAYMENT
 * ============================================================
 *
 * IMPORTANT:
 * We do NOT store the full card number, CVV, or other
 * sensitive card details in our database.
 *
 * Paystack handles the actual card collection through checkout.
 */
export const processPayment = async (req, res) => {
  try {
    const { amount, email, userId } = req.body;

    // -----------------------------------------
    // Validate required fields
    // -----------------------------------------
    if (!amount || !email || !userId) {
      return responseHandler.errorResponse(
        res,
        "Amount, email and userId are required",
        400,
      );
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return responseHandler.errorResponse(
        res,
        "Amount must be a valid number greater than zero",
        400,
      );
    }

    // -----------------------------------------
    // Check user exists
    // -----------------------------------------
    const user = await User.findById(userId);

    if (!user) {
      return responseHandler.errorResponse(res, "User not found", 404);
    }

    // -----------------------------------------
    // Initialize Paystack payment
    // -----------------------------------------
    const paymentResponse = await initializePayment(parsedAmount, email, {
      userId: userId.toString(),
      type: "WALLET_TOPUP",
    });

    return responseHandler.successResponse(
      res,
      paymentResponse,
      "Payment initialized successfully",
      200,
    );
  } catch (error) {
    console.error("processPayment error:", error);

    return responseHandler.errorResponse(
      res,
      error.message || "Payment initialization failed",
      500,
      error,
    );
  }
};

/**
 * ============================================================
 * 2. VERIFY AND COMPLETE PAYMENT
 * ============================================================
 */
export const verifyAndCompletePayment = async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return responseHandler.errorResponse(
        res,
        "Payment reference is required",
        400,
      );
    }

    // -----------------------------------------
    // Verify transaction with Paystack
    // -----------------------------------------
    const verification = await verifyPayment(reference);

    if (!verification) {
      return responseHandler.errorResponse(
        res,
        "Payment verification failed",
        400,
      );
    }

    // -----------------------------------------
    // Check Paystack transaction status
    // -----------------------------------------
    if (verification.status !== "success") {
      return responseHandler.errorResponse(
        res,
        verification.gateway_response || "Payment was not successful",
        400,
      );
    }

    // -----------------------------------------
    // Get user ID from metadata
    // -----------------------------------------
    const userId =
      verification.metadata?.userId || verification.metadata?.user_id;

    if (!userId) {
      return responseHandler.errorResponse(
        res,
        "User information was not found in payment metadata",
        400,
      );
    }

    // -----------------------------------------
    // Make sure user exists
    // -----------------------------------------
    const user = await User.findById(userId);

    if (!user) {
      return responseHandler.errorResponse(
        res,
        "User associated with this payment was not found",
        404,
      );
    }

    // -----------------------------------------
    // Prevent duplicate processing
    // -----------------------------------------
    const existingTransaction = await Transaction.findOne({
      reference,
    });

    if (existingTransaction && existingTransaction.status === "success") {
      const existingWallet = await UserWallet.findOne({
        userId,
      });

      return responseHandler.successResponse(
        res,
        {
          paymentStatus: "success",
          currentBalance: existingWallet?.balance || 0,
          reference,
          alreadyProcessed: true,
        },
        "Payment has already been processed",
        200,
      );
    }

    // -----------------------------------------
    // Paystack amount is in kobo
    // Convert to NGN
    // -----------------------------------------
    const amount = Number(verification.amount) / 100;

    if (!Number.isFinite(amount) || amount <= 0) {
      return responseHandler.errorResponse(
        res,
        "Invalid payment amount returned by Paystack",
        400,
      );
    }

    // -----------------------------------------
    // Credit wallet
    // -----------------------------------------
    const wallet = await UserWallet.findOneAndUpdate(
      { userId },
      {
        $inc: {
          balance: amount,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    // -----------------------------------------
    // Save reusable Paystack authorization
    // NEVER save card number or CVV
    // -----------------------------------------
    if (verification.authorization && verification.authorization.reusable) {
      const auth = verification.authorization;

      await SavedCard.findOneAndUpdate(
        {
          userId,
          paystackAuthCode: auth.authorization_code,
        },
        {
          userId,
          paystackAuthCode: auth.authorization_code,
          email: verification.customer?.email || user.email,
          last4: auth.last4,
          cardBrand: auth.card_type,
          expiryMonth: auth.exp_month,
          expiryYear: auth.exp_year,
          isDefault: true,
        },
        {
          upsert: true,
          new: true,
        },
      );
    }

    // -----------------------------------------
    // Record transaction
    // -----------------------------------------
    await Transaction.create({
      recipientId: userId,
      type: "TOPUP_PAYSTACK",
      amount,
      reference,
      status: "success",
    });

    // -----------------------------------------
    // Optional Bitcoin purchase
    // -----------------------------------------
    let btcTransaction = null;

    try {
      btcTransaction = await purchaseBitcoin(amount, userId, reference);
    } catch (bitcoinError) {
      console.error("Bitcoin purchase failed:", bitcoinError);

      // We don't fail the successful wallet top-up
      // just because the optional Bitcoin operation failed.
    }

    return responseHandler.successResponse(
      res,
      {
        paymentStatus: verification.status,
        currentBalance: wallet.balance,
        amount,
        reference,
        bitcoinTransaction: btcTransaction,
      },
      "Payment verified and wallet credited successfully",
      200,
    );
  } catch (error) {
    console.error("verifyAndCompletePayment error:", error);

    return responseHandler.errorResponse(
      res,
      error.message || "Payment verification failed",
      500,
      error,
    );
  }
};

/**
 * ============================================================
 * 3. CHARGE SAVED CARD
 * ============================================================
 */
export const topUpFromSavedCard = async (req, res) => {
  try {
    const { userId, cardId, amount } = req.body;

    if (!userId || !cardId || !amount) {
      return responseHandler.errorResponse(
        res,
        "userId, cardId and amount are required",
        400,
      );
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return responseHandler.errorResponse(
        res,
        "Amount must be greater than zero",
        400,
      );
    }

    // -----------------------------------------
    // Find saved card
    // -----------------------------------------
    const card = await SavedCard.findOne({
      _id: cardId,
      userId,
    });

    if (!card) {
      return responseHandler.errorResponse(res, "Saved card not found", 404);
    }

    if (!card.paystackAuthCode) {
      return responseHandler.errorResponse(
        res,
        "This card cannot be charged directly",
        400,
      );
    }

    const reference = `TOPUP_CARD_${Date.now()}_${Math.floor(
      Math.random() * 10000,
    )}`;

    // -----------------------------------------
    // Charge Paystack authorization
    // -----------------------------------------
    const chargeResult = await chargeAuthorization(
      parsedAmount,
      card.email,
      card.paystackAuthCode,
      reference,
    );

    if (chargeResult.status && chargeResult.data?.status === "success") {
      // -----------------------------------------
      // Credit wallet
      // -----------------------------------------
      const wallet = await UserWallet.findOneAndUpdate(
        { userId },
        {
          $inc: {
            balance: parsedAmount,
          },
        },
        {
          new: true,
          upsert: true,
        },
      );

      // -----------------------------------------
      // Record transaction
      // -----------------------------------------
      await Transaction.create({
        recipientId: userId,
        type: "TOPUP_CARD",
        amount: parsedAmount,
        reference,
        status: "success",
      });

      return responseHandler.successResponse(
        res,
        {
          balance: wallet.balance,
          reference,
        },
        "Wallet credited successfully via saved card",
        200,
      );
    }

    return responseHandler.errorResponse(
      res,
      chargeResult.message ||
        chargeResult.data?.gateway_response ||
        "Saved card charge failed",
      400,
    );
  } catch (error) {
    console.error("topUpFromSavedCard error:", error);

    return responseHandler.errorResponse(
      res,
      error.response?.data?.message ||
        error.message ||
        "Saved card charge failed",
      500,
      error,
    );
  }
};

/**
 * ============================================================
 * 4. INTERNAL WALLET-TO-WALLET TRANSFER
 * ============================================================
 */
export const transferWalletFunds = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { senderUserId, recipientIdentifier, amount } = req.body;

    const parsedAmount = Number(amount);

    if (
      !senderUserId ||
      !recipientIdentifier ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        "Invalid transfer details",
        400,
      );
    }

    // -----------------------------------------
    // Find sender wallet
    // -----------------------------------------
    const senderWallet = await UserWallet.findOne({
      userId: senderUserId,
    }).session(session);

    if (!senderWallet) {
      await session.abortTransaction();

      return responseHandler.errorResponse(res, "Sender wallet not found", 404);
    }

    if (senderWallet.balance < parsedAmount) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        "Insufficient wallet balance",
        400,
      );
    }

    // -----------------------------------------
    // Find recipient wallet
    // -----------------------------------------
    const recipientWallet = await UserWallet.findOne({
      $or: [
        {
          walletId: recipientIdentifier,
        },
        {
          phoneNumber: recipientIdentifier,
        },
      ],
    }).session(session);

    if (!recipientWallet) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        "Recipient wallet not found",
        404,
      );
    }

    // -----------------------------------------
    // Prevent self transfer
    // -----------------------------------------
    if (senderWallet.userId.toString() === recipientWallet.userId.toString()) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        "Cannot transfer funds to yourself",
        400,
      );
    }

    // -----------------------------------------
    // Deduct sender
    // -----------------------------------------
    senderWallet.balance -= parsedAmount;

    await senderWallet.save({
      session,
    });

    // -----------------------------------------
    // Credit recipient
    // -----------------------------------------
    recipientWallet.balance += parsedAmount;

    await recipientWallet.save({
      session,
    });

    const reference = `TRF_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // -----------------------------------------
    // Record transaction
    // -----------------------------------------
    await Transaction.create(
      [
        {
          senderId: senderWallet.userId,
          recipientId: recipientWallet.userId,
          type: "TRANSFER",
          amount: parsedAmount,
          reference,
          status: "success",
        },
      ],
      {
        session,
      },
    );

    await session.commitTransaction();

    return responseHandler.successResponse(
      res,
      {
        newBalance: senderWallet.balance,
        reference,
      },
      "Transfer completed successfully",
      200,
    );
  } catch (error) {
    console.error("transferWalletFunds error:", error);

    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return responseHandler.errorResponse(
      res,
      error.message || "Transfer failed",
      500,
      error,
    );
  } finally {
    await session.endSession();
  }
};

/**
 * ============================================================
 * 5. GET SUPPORTED BANKS
 * ============================================================
 */
export const getBanksList = async (req, res) => {
  try {
    const banks = await fetchSupportedBanks();

    return responseHandler.successResponse(
      res,
      banks.data || banks,
      "Banks retrieved successfully",
      200,
    );
  } catch (error) {
    console.error("getBanksList error:", error);

    return responseHandler.errorResponse(
      res,
      error.message || "Could not retrieve banks",
      500,
      error,
    );
  }
};

/**
 * ============================================================
 * 6. VERIFY BANK ACCOUNT
 * ============================================================
 *
 * This is the function your bank.routes.js should import:
 *
 * verifyBankAccountDetails
 */
export const verifyBankAccountDetails = async (req, res) => {
  try {
    const { accountNumber, bankCode, userId } = req.body;

    if (!accountNumber || !bankCode || !userId) {
      return responseHandler.errorResponse(
        res,
        "Account number, bank code and user ID are required",
        400,
      );
    }

    const cleanAccountNumber = String(accountNumber).replace(/\D/g, "");

    if (cleanAccountNumber.length !== 10) {
      return responseHandler.errorResponse(
        res,
        "Account number must be 10 digits",
        400,
      );
    }

    // -----------------------------------------
    // Check user
    // -----------------------------------------
    const user = await User.findById(userId);

    if (!user) {
      return responseHandler.errorResponse(res, "User profile not found", 404);
    }

    // -----------------------------------------
    // Resolve account with Paystack
    // -----------------------------------------
    const resolution = await resolveAccountNumber(cleanAccountNumber, bankCode);

    if (!resolution?.status || !resolution?.data) {
      return responseHandler.errorResponse(
        res,
        resolution?.message || "Could not resolve account details",
        400,
      );
    }

    const resolvedAccountName = resolution.data.account_name;

    if (!resolvedAccountName) {
      return responseHandler.errorResponse(
        res,
        "Account name could not be retrieved",
        400,
      );
    }

    // -----------------------------------------
    // Compare account name to user profile
    // -----------------------------------------
    const fullName = String(user.fullName || "").trim();

    if (!fullName) {
      return responseHandler.errorResponse(
        res,
        "Your profile does not contain a full name",
        400,
      );
    }

    const profileNameParts = fullName
      .toLowerCase()
      .split(/\s+/)
      .filter((part) => part.length > 2);

    const resolvedNameLower = resolvedAccountName.toLowerCase();

    const isNameMatch = profileNameParts.some((part) =>
      resolvedNameLower.includes(part),
    );

    if (!isNameMatch) {
      return responseHandler.errorResponse(
        res,
        `Account name "${resolvedAccountName}" does not match your registered profile name "${fullName}".`,
        400,
      );
    }

    return responseHandler.successResponse(
      res,
      {
        accountNumber: cleanAccountNumber,
        accountName: resolvedAccountName,
        bankCode,
        verified: true,
      },
      "Account verified successfully",
      200,
    );
  } catch (error) {
    console.error("verifyBankAccountDetails error:", error);

    return responseHandler.errorResponse(
      res,
      error.response?.data?.message ||
        error.message ||
        "Invalid account details or network error",
      400,
      error,
    );
  }
};

/**
 * ============================================================
 * 7. SAVE VERIFIED BANK ACCOUNT
 * ============================================================
 */
export const saveBankAccount = async (req, res) => {
  try {
    const { userId, accountNumber, accountName, bankCode, bankName } = req.body;

    if (!userId || !accountNumber || !accountName || !bankCode || !bankName) {
      return responseHandler.errorResponse(res, "All fields are required", 400);
    }

    const cleanAccountNumber = String(accountNumber).replace(/\D/g, "");

    if (cleanAccountNumber.length !== 10) {
      return responseHandler.errorResponse(
        res,
        "Account number must be 10 digits",
        400,
      );
    }

    // -----------------------------------------
    // Check user
    // -----------------------------------------
    const user = await User.findById(userId);

    if (!user) {
      return responseHandler.errorResponse(res, "User not found", 404);
    }

    // -----------------------------------------
    // Create Paystack transfer recipient
    // -----------------------------------------
    const recipientRes = await createTransferRecipient(
      accountName,
      cleanAccountNumber,
      bankCode,
    );

    if (!recipientRes?.status || !recipientRes?.data?.recipient_code) {
      return responseHandler.errorResponse(
        res,
        recipientRes?.message ||
          "Failed to register bank recipient with Paystack",
        400,
      );
    }

    // -----------------------------------------
    // Remove default from existing accounts
    // -----------------------------------------
    await BankAccount.updateMany(
      {
        userId,
      },
      {
        $set: {
          isDefault: false,
        },
      },
    );

    // -----------------------------------------
    // Save bank account
    // -----------------------------------------
    const bankAccount = await BankAccount.create({
      userId,
      accountNumber: cleanAccountNumber,
      accountName,
      bankCode,
      bankName,
      recipientCode: recipientRes.data.recipient_code,
      isDefault: true,
    });

    return responseHandler.successResponse(
      res,
      bankAccount,
      "Bank account saved successfully",
      201,
    );
  } catch (error) {
    console.error("saveBankAccount error:", error);

    return responseHandler.errorResponse(
      res,
      error.message || "Could not save bank account",
      500,
      error,
    );
  }
};

/**
 * ============================================================
 * 8. GET USER BANK ACCOUNTS
 * ============================================================
 */
export const getUserBankAccounts = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return responseHandler.errorResponse(res, "User ID is required", 400);
    }

    const bankAccounts = await BankAccount.find({
      userId,
    }).sort({
      createdAt: -1,
    });

    return responseHandler.successResponse(
      res,
      bankAccounts,
      "User bank accounts retrieved successfully",
      200,
    );
  } catch (error) {
    console.error("getUserBankAccounts error:", error);

    return responseHandler.errorResponse(
      res,
      error.message || "Could not retrieve bank accounts",
      500,
      error,
    );
  }
};

/**
 * ============================================================
 * 9. WITHDRAW FUNDS
 * ============================================================
 */
export const withdrawFunds = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { userId, bankAccountId, amount } = req.body;

    const MIN_WITHDRAWAL = 2000;
    const PROCESSING_FEE = 50;

    const requestedAmount = Number(amount);

    if (
      !userId ||
      !bankAccountId ||
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0
    ) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        "Invalid withdrawal details",
        400,
      );
    }

    if (requestedAmount < MIN_WITHDRAWAL) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL.toLocaleString()}`,
        400,
      );
    }

    if (requestedAmount <= PROCESSING_FEE) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        "Withdrawal amount must be greater than the processing fee",
        400,
      );
    }

    // -----------------------------------------
    // Get wallet
    // -----------------------------------------
    const wallet = await UserWallet.findOne({
      userId,
    }).session(session);

    if (!wallet) {
      await session.abortTransaction();

      return responseHandler.errorResponse(res, "Wallet not found", 404);
    }

    if (wallet.balance < requestedAmount) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        "Insufficient wallet balance",
        400,
      );
    }

    // -----------------------------------------
    // Get bank account
    // -----------------------------------------
    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      userId,
    }).session(session);

    if (!bankAccount) {
      await session.abortTransaction();

      return responseHandler.errorResponse(res, "Bank account not found", 404);
    }

    if (!bankAccount.recipientCode) {
      await session.abortTransaction();

      return responseHandler.errorResponse(
        res,
        "Bank account is not configured for withdrawals",
        400,
      );
    }

    const netPayoutAmount = requestedAmount - PROCESSING_FEE;

    // -----------------------------------------
    // Deduct wallet
    // -----------------------------------------
    wallet.balance -= requestedAmount;

    await wallet.save({
      session,
    });

    const reference = `WTH_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // -----------------------------------------
    // Create pending transaction
    // -----------------------------------------
    const [transaction] = await Transaction.create(
      [
        {
          senderId: userId,
          type: "WITHDRAWAL",
          amount: requestedAmount,
          reference,
          status: "pending",
          metadata: {
            processingFee: PROCESSING_FEE,
            netPayoutAmount,
            bankAccount: {
              accountNumber: bankAccount.accountNumber,
              bankName: bankAccount.bankName,
              accountName: bankAccount.accountName,
            },
          },
        },
      ],
      {
        session,
      },
    );

    // -----------------------------------------
    // Commit local DB changes
    // -----------------------------------------
    await session.commitTransaction();

    // -----------------------------------------
    // Send money through Paystack
    // -----------------------------------------
    try {
      const transferRes = await initiateTransfer(
        netPayoutAmount,
        bankAccount.recipientCode,
        reference,
        "Wagba Wallet Withdrawal",
      );

      if (transferRes?.status === true) {
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: "success",
        });

        return responseHandler.successResponse(
          res,
          {
            reference,
            amountWithdrawn: requestedAmount,
            netReceived: netPayoutAmount,
            fee: PROCESSING_FEE,
            newBalance: wallet.balance,
          },
          "Withdrawal processed successfully",
          200,
        );
      }

      // Paystack returned unsuccessful response
      throw new Error(transferRes?.message || "Paystack transfer failed");
    } catch (paystackError) {
      console.error("Paystack withdrawal error:", paystackError);

      // -----------------------------------------
      // Restore wallet balance
      // -----------------------------------------
      await UserWallet.findOneAndUpdate(
        {
          userId,
        },
        {
          $inc: {
            balance: requestedAmount,
          },
        },
      );

      // -----------------------------------------
      // Mark transaction failed
      // -----------------------------------------
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: "failed",
        "metadata.error": paystackError.message,
      });

      return responseHandler.errorResponse(
        res,
        "Transfer failed. Funds have been restored to your wallet.",
        500,
      );
    }
  } catch (error) {
    console.error("withdrawFunds error:", error);

    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return responseHandler.errorResponse(
      res,
      error.message || "Withdrawal failed",
      500,
      error,
    );
  } finally {
    await session.endSession();
  }
};

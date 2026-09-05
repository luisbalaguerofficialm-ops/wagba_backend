import mongoose from "mongoose";

import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

import { createNotification } from "../controllers/notification.controller.js";

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
 * HELPER: CREATE PAYMENT NOTIFICATION
 * ============================================================
 */

const notifyPaymentActivity = async ({
  userId,
  title,
  message,
  type = "transaction",
  metadata = {},
}) => {
  if (!userId) return null;

  return await createNotification({
    userId,
    title,
    message,
    category: "transaction",
    type,
    metadata: {
      currency: "NGN",
      ...metadata,
    },
  });
};

/**
 * ============================================================
 * 1. INITIALIZE PAYMENT
 * ============================================================
 *
 * Wallet top-up through Paystack.
 */

export const processPayment = tryCatchFn(async (req, res) => {
  const { amount, email, userId } = req.body;

  // -----------------------------------------
  // Validate required fields
  // -----------------------------------------

  if (!amount || !email || !userId) {
    throw responseHandler.errorResponse(
      "Amount, email and userId are required",
      400,
    );
  }

  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw responseHandler.errorResponse(
      "Amount must be a valid number greater than zero",
      400,
    );
  }

  // -----------------------------------------
  // Check user
  // -----------------------------------------

  const user = await User.findById(userId);

  if (!user) {
    throw responseHandler.errorResponse("User not found", 404);
  }

  // -----------------------------------------
  // Initialize Paystack
  // -----------------------------------------

  const paymentResponse = await initializePayment(parsedAmount, email, {
    userId: userId.toString(),
    type: "WALLET_TOPUP",
  });

  // -----------------------------------------
  // Notification
  // -----------------------------------------

  await notifyPaymentActivity({
    userId: user._id,
    title: "Wallet Top-Up Started",
    message: `Your ₦${parsedAmount.toLocaleString()} wallet top-up has been initiated. Complete the payment to credit your WAGBA wallet.`,
    metadata: {
      amount: parsedAmount,
      paymentMethod: "paystack",
      paymentStatus: "pending",
      action: "wallet_topup_initialized",
    },
  });

  return responseHandler.successResponse(
    res,
    paymentResponse,
    "Payment initialized successfully",
    200,
  );
});

/**
 * ============================================================
 * 2. VERIFY AND COMPLETE PAYMENT
 * ============================================================
 */

export const verifyAndCompletePayment = tryCatchFn(async (req, res) => {
  const { reference } = req.query;

  if (!reference) {
    throw responseHandler.errorResponse("Payment reference is required", 400);
  }

  // -----------------------------------------
  // Verify Paystack transaction
  // -----------------------------------------

  const verification = await verifyPayment(reference);

  if (!verification) {
    throw responseHandler.errorResponse("Payment verification failed", 400);
  }

  // -----------------------------------------
  // Check transaction status
  // -----------------------------------------

  if (verification.status !== "success") {
    throw responseHandler.errorResponse(
      verification.gateway_response || "Payment was not successful",
      400,
    );
  }

  // -----------------------------------------
  // Get user ID
  // -----------------------------------------

  const userId =
    verification.metadata?.userId || verification.metadata?.user_id;

  if (!userId) {
    throw responseHandler.errorResponse(
      "User information was not found in payment metadata",
      400,
    );
  }

  // -----------------------------------------
  // Find user
  // -----------------------------------------

  const user = await User.findById(userId);

  if (!user) {
    throw responseHandler.errorResponse(
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
  // Paystack amount is kobo
  // -----------------------------------------

  const amount = Number(verification.amount) / 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw responseHandler.errorResponse(
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
  // Save reusable authorization
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

  const transaction = await Transaction.create({
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
  }

  // -----------------------------------------
  // PERSONAL NOTIFICATION
  // -----------------------------------------

  await notifyPaymentActivity({
    userId: user._id,
    title: "Wallet Top-Up Successful",
    message: `₦${amount.toLocaleString()} has been successfully added to your WAGBA wallet.`,
    metadata: {
      amount,
      reference,
      transactionId: transaction._id,
      paymentMethod: "paystack",
      paymentStatus: "success",
      walletBalance: wallet.balance,
      action: "wallet_topup",
    },
  });

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
});

/**
 * ============================================================
 * 3. CHARGE SAVED CARD
 * ============================================================
 */

export const topUpFromSavedCard = tryCatchFn(async (req, res) => {
  const { userId, cardId, amount } = req.body;

  if (!userId || !cardId || !amount) {
    throw responseHandler.errorResponse(
      "userId, cardId and amount are required",
      400,
    );
  }

  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw responseHandler.errorResponse(
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
    throw responseHandler.errorResponse("Saved card not found", 404);
  }

  if (!card.paystackAuthCode) {
    throw responseHandler.errorResponse(
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
    // ---------------------------------------
    // Credit wallet
    // ---------------------------------------

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

    // ---------------------------------------
    // Record transaction
    // ---------------------------------------

    const transaction = await Transaction.create({
      recipientId: userId,
      type: "TOPUP_CARD",
      amount: parsedAmount,
      reference,
      status: "success",
    });

    // ---------------------------------------
    // Notification
    // ---------------------------------------

    await notifyPaymentActivity({
      userId,
      title: "Wallet Top-Up Successful",
      message: `₦${parsedAmount.toLocaleString()} has been added to your wallet using your saved card.`,
      metadata: {
        amount: parsedAmount,
        reference,
        transactionId: transaction._id,
        paymentMethod: "saved_card",
        paymentStatus: "success",
        walletBalance: wallet.balance,
        cardLast4: card.last4,
        action: "wallet_topup",
      },
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

  // -----------------------------------------
  // Failed card payment
  // -----------------------------------------

  await notifyPaymentActivity({
    userId,
    title: "Wallet Top-Up Failed",
    message:
      chargeResult.message ||
      chargeResult.data?.gateway_response ||
      "Your saved card could not be charged.",
    metadata: {
      amount: parsedAmount,
      reference,
      paymentMethod: "saved_card",
      paymentStatus: "failed",
      action: "wallet_topup_failed",
    },
  });

  return responseHandler.errorResponse(
    res,
    chargeResult.message ||
      chargeResult.data?.gateway_response ||
      "Saved card charge failed",
    400,
  );
});

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
    // Sender wallet
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
    // Recipient wallet
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

    const [transaction] = await Transaction.create(
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

    // -----------------------------------------
    // Get users for notifications
    // -----------------------------------------

    const [senderUser, recipientUser] = await Promise.all([
      User.findById(senderWallet.userId),
      User.findById(recipientWallet.userId),
    ]);

    // -----------------------------------------
    // Sender notification
    // -----------------------------------------

    await notifyPaymentActivity({
      userId: senderWallet.userId,
      title: "Transfer Successful",
      message: `₦${parsedAmount.toLocaleString()} has been transferred successfully.`,
      metadata: {
        amount: parsedAmount,
        reference,
        transactionId: transaction._id,
        paymentMethod: "wallet",
        transferType: "wallet_to_wallet",
        recipientId: recipientWallet.userId,
        walletBalance: senderWallet.balance,
        action: "wallet_transfer_sent",
      },
    });

    // -----------------------------------------
    // Recipient notification
    // -----------------------------------------

    await notifyPaymentActivity({
      userId: recipientWallet.userId,
      title: "Money Received",
      message: `You received ₦${parsedAmount.toLocaleString()} in your WAGBA wallet.`,
      metadata: {
        amount: parsedAmount,
        reference,
        transactionId: transaction._id,
        paymentMethod: "wallet",
        transferType: "wallet_to_wallet",
        senderId: senderWallet.userId,
        walletBalance: recipientWallet.balance,
        action: "wallet_transfer_received",
      },
    });

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

export const getBanksList = tryCatchFn(async (req, res) => {
  const banks = await fetchSupportedBanks();

  return responseHandler.successResponse(
    res,
    banks.data || banks,
    "Banks retrieved successfully",
    200,
  );
});

/**
 * ============================================================
 * 6. VERIFY BANK ACCOUNT
 * ============================================================
 */

export const verifyBankAccountDetails = tryCatchFn(async (req, res) => {
  const { accountNumber, bankCode, userId } = req.body;

  if (!accountNumber || !bankCode || !userId) {
    throw responseHandler.errorResponse(
      "Account number, bank code and user ID are required",
      400,
    );
  }

  const cleanAccountNumber = String(accountNumber).replace(/\D/g, "");

  if (cleanAccountNumber.length !== 10) {
    throw responseHandler.errorResponse(
      "Account number must be 10 digits",
      400,
    );
  }

  // -----------------------------------------
  // Check user
  // -----------------------------------------

  const user = await User.findById(userId);

  if (!user) {
    throw responseHandler.errorResponse("User profile not found", 404);
  }

  // -----------------------------------------
  // Resolve account
  // -----------------------------------------

  const resolution = await resolveAccountNumber(cleanAccountNumber, bankCode);

  if (!resolution?.status || !resolution?.data) {
    throw responseHandler.errorResponse(
      resolution?.message || "Could not resolve account details",
      400,
    );
  }

  const resolvedAccountName = resolution.data.account_name;

  if (!resolvedAccountName) {
    throw responseHandler.errorResponse(
      "Account name could not be retrieved",
      400,
    );
  }

  // -----------------------------------------
  // Compare account name
  // -----------------------------------------

  const fullName = String(user.fullName || "").trim();

  if (!fullName) {
    throw responseHandler.errorResponse(
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
    throw responseHandler.errorResponse(
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
});

/**
 * ============================================================
 * 7. SAVE VERIFIED BANK ACCOUNT
 * ============================================================
 */

export const saveBankAccount = tryCatchFn(async (req, res) => {
  const { userId, accountNumber, accountName, bankCode, bankName } = req.body;

  if (!userId || !accountNumber || !accountName || !bankCode || !bankName) {
    throw responseHandler.errorResponse("All fields are required", 400);
  }

  const cleanAccountNumber = String(accountNumber).replace(/\D/g, "");

  if (cleanAccountNumber.length !== 10) {
    throw responseHandler.errorResponse(
      "Account number must be 10 digits",
      400,
    );
  }

  // -----------------------------------------
  // Check user
  // -----------------------------------------

  const user = await User.findById(userId);

  if (!user) {
    throw responseHandler.errorResponse("User not found", 404);
  }

  // -----------------------------------------
  // Create Paystack recipient
  // -----------------------------------------

  const recipientRes = await createTransferRecipient(
    accountName,
    cleanAccountNumber,
    bankCode,
  );

  if (!recipientRes?.status || !recipientRes?.data?.recipient_code) {
    throw responseHandler.errorResponse(
      recipientRes?.message ||
        "Failed to register bank recipient with Paystack",
      400,
    );
  }

  // -----------------------------------------
  // Remove old default
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

  // -----------------------------------------
  // Notification
  // -----------------------------------------

  await notifyPaymentActivity({
    userId,
    title: "Bank Account Added",
    message: `${bankName} account ending in ${cleanAccountNumber.slice(-4)} has been successfully added to your WAGBA account.`,
    metadata: {
      bankAccountId: bankAccount._id,
      bankName,
      accountName,
      accountLast4: cleanAccountNumber.slice(-4),
      action: "bank_account_added",
    },
  });

  return responseHandler.successResponse(
    res,
    bankAccount,
    "Bank account saved successfully",
    201,
  );
});

/**
 * ============================================================
 * 8. GET USER BANK ACCOUNTS
 * ============================================================
 */

export const getUserBankAccounts = tryCatchFn(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw responseHandler.errorResponse("User ID is required", 400);
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
});

/**
 * ============================================================
 * 9. WITHDRAW FUNDS
 * ============================================================
 */

export const withdrawFunds = async (req, res) => {
  const session = await mongoose.startSession();

  let transaction = null;

  try {
    session.startTransaction();

    const { userId, bankAccountId, amount } = req.body;

    const MIN_WITHDRAWAL = 2000;
    const PROCESSING_FEE = 50;

    const requestedAmount = Number(amount);

    // -----------------------------------------
    // Validate
    // -----------------------------------------

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

    [transaction] = await Transaction.create(
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
    // Notify withdrawal started
    // -----------------------------------------

    await notifyPaymentActivity({
      userId,
      title: "Withdrawal Processing",
      message: `Your ₦${requestedAmount.toLocaleString()} withdrawal is being processed.`,
      metadata: {
        amount: requestedAmount,
        fee: PROCESSING_FEE,
        netPayout: netPayoutAmount,
        reference,
        transactionId: transaction._id,
        paymentMethod: "bank_transfer",
        paymentStatus: "pending",
        bankName: bankAccount.bankName,
        accountLast4: bankAccount.accountNumber.slice(-4),
        action: "withdrawal_started",
      },
    });

    // -----------------------------------------
    // Paystack transfer
    // -----------------------------------------

    try {
      const transferRes = await initiateTransfer(
        netPayoutAmount,
        bankAccount.recipientCode,
        reference,
        "WAGBA Wallet Withdrawal",
      );

      if (transferRes?.status === true) {
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: "success",
        });

        // -------------------------------------
        // Success notification
        // -------------------------------------

        await notifyPaymentActivity({
          userId,
          title: "Withdrawal Successful",
          message: `Your withdrawal of ₦${requestedAmount.toLocaleString()} was processed successfully. ₦${netPayoutAmount.toLocaleString()} was sent to your bank account after the ₦${PROCESSING_FEE} processing fee.`,
          metadata: {
            amount: requestedAmount,
            fee: PROCESSING_FEE,
            netPayout: netPayoutAmount,
            reference,
            transactionId: transaction._id,
            paymentMethod: "bank_transfer",
            paymentStatus: "success",
            newBalance: wallet.balance,
            bankName: bankAccount.bankName,
            accountLast4: bankAccount.accountNumber.slice(-4),
            action: "withdrawal_success",
          },
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

      throw new Error(transferRes?.message || "Paystack transfer failed");
    } catch (paystackError) {
      console.error("Paystack withdrawal error:", paystackError);

      // ---------------------------------------
      // Restore wallet
      // ---------------------------------------

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

      // ---------------------------------------
      // Mark transaction failed
      // ---------------------------------------

      await Transaction.findByIdAndUpdate(transaction._id, {
        status: "failed",
        "metadata.error": paystackError.message,
      });

      // ---------------------------------------
      // Failure notification
      // ---------------------------------------

      await notifyPaymentActivity({
        userId,
        title: "Withdrawal Failed",
        message: `Your ₦${requestedAmount.toLocaleString()} withdrawal could not be completed. The funds have been restored to your WAGBA wallet.`,
        metadata: {
          amount: requestedAmount,
          fee: PROCESSING_FEE,
          reference,
          transactionId: transaction._id,
          paymentMethod: "bank_transfer",
          paymentStatus: "failed",
          error: paystackError.message,
          fundsRestored: true,
          action: "withdrawal_failed",
        },
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

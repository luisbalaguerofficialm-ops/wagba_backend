import axios from "axios";
import "../configs/env.js";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || "NGN";

/**
 * ============================================================
 * VALIDATE PAYSTACK CONFIG
 * ============================================================
 */
if (!PAYSTACK_SECRET_KEY) {
  console.warn("WARNING: PAYSTACK_SECRET_KEY is not configured.");
}

/**
 * ============================================================
 * PAYSTACK HEADERS
 * ============================================================
 */
const getHeaders = () => ({
  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

/**
 * ============================================================
 * INITIALIZE PAYMENT
 * ============================================================
 *
 * Paystack expects the amount in the smallest unit.
 *
 * For NGN:
 * ₦1,000 = 100000 kobo
 */
export const initializePayment = async (amount, email, metadata = {}) => {
  try {
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    if (!email) {
      throw new Error("Customer email is required");
    }

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: Math.round(parsedAmount * 100),
        currency: PAYSTACK_CURRENCY,
        channels: ["card"],
        metadata,
        callback_url: process.env.FRONTEND_URL
          ? `${process.env.FRONTEND_URL}/payment/callback`
          : undefined,
      },
      {
        headers: getHeaders(),
      },
    );

    return response.data.data;
  } catch (error) {
    console.error(
      "Paystack initialize error:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.message || "Payment initialization failed",
    );
  }
};

/**
 * ============================================================
 * VERIFY PAYMENT
 * ============================================================
 */
export const verifyPayment = async (reference) => {
  try {
    if (!reference) {
      throw new Error("Payment reference is required");
    }

    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(
        reference,
      )}`,
      {
        headers: getHeaders(),
      },
    );

    return response.data.data;
  } catch (error) {
    console.error(
      "Paystack verification error:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.message || "Payment verification failed",
    );
  }
};

/**
 * ============================================================
 * CHARGE SAVED AUTHORIZATION
 * ============================================================
 */
export const chargeAuthorization = async (
  amount,
  email,
  authorizationCode,
  reference,
) => {
  try {
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    if (!email) {
      throw new Error("Customer email is required");
    }

    if (!authorizationCode) {
      throw new Error("Paystack authorization code is required");
    }

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/charge_authorization`,
      {
        amount: Math.round(parsedAmount * 100),
        email,
        authorization_code: authorizationCode,
        reference,
        currency: PAYSTACK_CURRENCY,
      },
      {
        headers: getHeaders(),
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      "Paystack charge authorization error:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.message || "Saved card charge failed",
    );
  }
};

/**
 * ============================================================
 * FETCH SUPPORTED BANKS
 * ============================================================
 */
export const fetchSupportedBanks = async () => {
  try {
    const response = await axios.get(`${PAYSTACK_BASE_URL}/bank`, {
      params: {
        country: "nigeria",
      },
      headers: getHeaders(),
    });

    return response.data;
  } catch (error) {
    console.error("Fetch banks error:", error.response?.data || error.message);

    throw new Error(
      error.response?.data?.message || "Could not retrieve supported banks",
    );
  }
};

/**
 * ============================================================
 * RESOLVE BANK ACCOUNT
 * ============================================================
 */
export const resolveAccountNumber = async (accountNumber, bankCode) => {
  try {
    const response = await axios.get(`${PAYSTACK_BASE_URL}/bank/resolve`, {
      params: {
        account_number: accountNumber,
        bank_code: bankCode,
      },
      headers: getHeaders(),
    });

    return response.data;
  } catch (error) {
    console.error(
      "Resolve bank account error:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.message || "Could not resolve bank account",
    );
  }
};

/**
 * ============================================================
 * CREATE TRANSFER RECIPIENT
 * ============================================================
 */
export const createTransferRecipient = async (
  accountName,
  accountNumber,
  bankCode,
) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      {
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      },
      {
        headers: getHeaders(),
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      "Create transfer recipient error:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.message || "Could not create transfer recipient",
    );
  }
};

/**
 * ============================================================
 * INITIATE TRANSFER
 * ============================================================
 */
export const initiateTransfer = async (
  amount,
  recipientCode,
  reference,
  reason = "Wallet Withdrawal",
) => {
  try {
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Transfer amount must be greater than zero");
    }

    if (!recipientCode) {
      throw new Error("Transfer recipient code is required");
    }

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transfer`,
      {
        source: "balance",
        amount: Math.round(parsedAmount * 100),
        recipient: recipientCode,
        reference,
        reason,
      },
      {
        headers: getHeaders(),
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      "Paystack transfer error:",
      error.response?.data || error.message,
    );

    throw new Error(error.response?.data?.message || "Transfer failed");
  }
};

/**
 * ============================================================
 * SAVE CARD TO VAULT
 * ============================================================
 *
 * This is intentionally left as a placeholder.
 *
 * Do NOT store raw card numbers or CVV in your database.
 * Save only Paystack authorization data returned after
 * a successful payment/authorization.
 */
export const saveCardToVault = async (accessToken, cardRef) => {
  try {
    if (!accessToken || !cardRef) {
      return false;
    }

    // Paystack authorization should be saved from
    // the authorization object returned after a
    // successful transaction.
    return true;
  } catch (error) {
    console.error("saveCardToVault error:", error);

    throw error;
  }
};

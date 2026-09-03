const axios = require("axios");

// Paystack Bank Code Mapping
const PAYSTACK_BANK_CODES = {
  opay: "999992",
  uba: "033",
  gtb: "058",
};

/**
 * Resolves account number using Paystack API
 */
const resolveBankAccount = async (accountNumber, bankCode) => {
  if (!accountNumber || accountNumber.length !== 10) {
    throw new Error("Please provide a valid 10-digit account number.");
  }

  const paystackCode = PAYSTACK_BANK_CODES[bankCode?.toLowerCase()];
  if (!paystackCode) {
    throw new Error("Unsupported bank code selected.");
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${paystackCode}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    if (response.data?.status) {
      return {
        accountName: response.data.data.account_name,
        accountNumber: response.data.data.account_number,
      };
    } else {
      throw new Error("Unable to resolve account details.");
    }
  } catch (error) {
    const apiError = error?.response?.data?.message || error.message;
    throw new Error(apiError);
  }
};

module.exports = {
  resolveBankAccount,
};

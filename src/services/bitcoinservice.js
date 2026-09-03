import BitcoinTransaction from "../models/bitcointransaction.js";
import axios from "axios";

// Mock service to fetch current BTC price and execute purchase
export const purchaseBitcoin = async (amountUsd, userId, paystackReference) => {
  try {
    // 1. Get Current BTC Price (Using CoinGecko API as an example)
    const priceResponse = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    );
    const btcPrice = priceResponse.data.bitcoin.usd;

    // 2. Calculate BTC Amount
    const btcAmount = amountUsd / btcPrice;

    // 3. Create Transaction Record
    const transaction = await BitcoinTransaction.create({
      userId,
      paystackReference,
      amountUsd,
      bitcoinAmount: btcAmount,
      exchangeRate: btcPrice,
      status: "completed",
      walletAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", // user wallet
    });
    //  move the funds to the user's wallet.

    return transaction;
  } catch (error) {
    throw new Error("Bitcoin purchase failed: " + error.message);
  }
};

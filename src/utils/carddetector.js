import cards from "cards";

export const detectCard = (number) => {
  // Remove spaces and dashes
  const cleanNumber = number.replace(/[\s-]/g, "");

  try {
    const card = cards(cleanNumber);

    if (!card.valid) {
      return {
        valid: false,
        error: "Invalid card number",
      };
    }

    return {
      valid: true,
      type: card.fallbackBrand, // 'Visa', 'MasterCard', etc.
      brand: card.fallbackBrand,
      // 'type' in cards library usually refers to prepaid/credit/debit if available,
      // otherwise we default to Unknown for precise banking distinction
      cardBrand: card.type || "Unknown",
      last4: cleanNumber.slice(-4),
    };
  } catch (error) {
    return {
      valid: false,
      error: "Could not detect card",
    };
  }
};

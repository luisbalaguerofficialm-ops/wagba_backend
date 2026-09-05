import crypto from "crypto";

// ==========================================
// GENERATE OTP
// ==========================================

export const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// ==========================================
// HASH OTP
// ==========================================

export const hashOTP = (otp) => {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
};

// ==========================================
// VERIFY OTP
// ==========================================

export const verifyOTP = (otp, hashedOTP) => {
  if (!otp || !hashedOTP) {
    return false;
  }

  const hashedInput = hashOTP(otp);

  return crypto.timingSafeEqual(
    Buffer.from(hashedInput, "hex"),
    Buffer.from(hashedOTP, "hex"),
  );
};

// ==========================================
// OTP EXPIRY
// ==========================================

export const getOTPExpiry = () => {
  return new Date(Date.now() + 10 * 60 * 1000);
};

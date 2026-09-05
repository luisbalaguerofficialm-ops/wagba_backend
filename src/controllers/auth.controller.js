import User from "../models/user.js";
import { createSendToken } from "../libs/token.js";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";
import { OAuth2Client } from "google-auth-library";
import TokenBlacklist from "../models/tokenbalcklist.js";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
import { generateOTP, hashOTP, verifyOTP } from "../utils/otp.js";

import { sendOTP } from "../services/otpService.js";
// ==========================================
// VALID NIGERIAN STATES
// ==========================================

const validStates = [
  "abia",
  "adamawa",
  "akwa_ibom",
  "anambra",
  "bauchi",
  "bayelsa",
  "benue",
  "borno",
  "cross_river",
  "delta",
  "ebonyi",
  "edo",
  "ekiti",
  "enugu",
  "gombe",
  "imo",
  "jigawa",
  "kaduna",
  "kano",
  "katsina",
  "kebbi",
  "kogi",
  "kwara",
  "lagos",
  "nasarawa",
  "niger",
  "ogun",
  "ondo",
  "osun",
  "oyo",
  "plateau",
  "rivers",
  "sokoto",
  "taraba",
  "yobe",
  "zamfara",
  "abuja",
];

// ==========================================
// REGISTER WITH EMAIL/PASSWORD
// ==========================================

export const registerUser = tryCatchFn(async (req, res) => {
  const { fullName, email, phone, state, password, acceptedTerms } = req.body;

  // ----------------------------------------
  // Required fields
  // ----------------------------------------

  if (!fullName || !email || !phone || !state || !password) {
    throw responseHandler.errorResponse(
      "Please fill in all required fields",
      400,
    );
  }

  // ----------------------------------------
  // Terms
  // ----------------------------------------

  if (acceptedTerms !== true) {
    throw responseHandler.errorResponse(
      "You must accept the Terms & Conditions",
      400,
    );
  }

  // ----------------------------------------
  // Normalize
  // ----------------------------------------

  const normalizedFullName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();
  const normalizedState = state.trim().toLowerCase();

  // ----------------------------------------
  // Email validation
  // ----------------------------------------

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    throw responseHandler.errorResponse(
      "Please provide a valid email address",
      400,
    );
  }

  // ----------------------------------------
  // Password validation
  // ----------------------------------------

  if (password.length < 8) {
    throw responseHandler.errorResponse(
      "Password must be at least 8 characters",
      400,
    );
  }

  // ----------------------------------------
  // State validation
  // ----------------------------------------

  if (!validStates.includes(normalizedState)) {
    throw responseHandler.errorResponse(
      "Please select a valid Nigerian state",
      400,
    );
  }

  // ----------------------------------------
  // Check existing email
  // ----------------------------------------

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw responseHandler.errorResponse(
      "An account with this email already exists",
      409,
    );
  }

  // ----------------------------------------
  // Check phone
  // ----------------------------------------

  const existingPhone = await User.findOne({
    phone: normalizedPhone,
  });

  if (existingPhone) {
    throw responseHandler.errorResponse(
      "An account with this phone number already exists",
      409,
    );
  }

  // ----------------------------------------
  // Create user
  // ----------------------------------------

  const user = await User.create({
    fullName: normalizedFullName,
    email: normalizedEmail,
    phone: normalizedPhone,
    state: normalizedState,
    password,
    acceptedTerms: true,
    authProvider: "local",
    role: "customer",
  });

  // ----------------------------------------
  // Create Wagba tokens
  // ----------------------------------------

  const { accessToken, refreshToken, cookieOptions } = createSendToken(user);

  await createNotification({
    userId: user._id,
    title: "Welcome to WAGBA",
    message: `Welcome to WAGBA, ${user.fullName}! Your account has been created successfully.`,
    category: "authentication",
    type: "authentication",
    metadata: {
      action: "account_created",
      authProvider: "local",
      email: user.email,
    },
  });
  // ----------------------------------------
  // Refresh token cookie
  // ----------------------------------------

  res.cookie("refreshToken", refreshToken, cookieOptions);

  // ----------------------------------------
  // Response
  // ----------------------------------------

  return responseHandler.successResponse(
    res,
    {
      accessToken,

      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        state: user.state,
        role: user.role,
        authProvider: user.authProvider,
      },
    },
    "Account created successfully",
    201,
  );
});

// ==========================================
// LOGIN WITH EMAIL/PASSWORD
// ==========================================

export const loginUser = tryCatchFn(async (req, res) => {
  const { email, password } = req.body;

  // ----------------------------------------
  // Validation
  // ----------------------------------------

  if (!email || !password) {
    throw responseHandler.errorResponse("Email and password are required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // ----------------------------------------
  // Find user
  // ----------------------------------------

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!user) {
    throw responseHandler.unauthorizedResponse("Invalid email or password");
  }

  // ----------------------------------------
  // Google account trying local login
  // ----------------------------------------

  if (user.authProvider === "google" && !user.password) {
    throw responseHandler.errorResponse(
      "This account was created with Google. Please continue with Google.",
      400,
    );
  }

  // ----------------------------------------
  // Compare password
  // ----------------------------------------

  const passwordMatch = await user.comparePassword(password);

  if (!passwordMatch) {
    throw responseHandler.unauthorizedResponse("Invalid email or password");
  }

  // ----------------------------------------
  // Create Wagba tokens
  // ----------------------------------------

  const { accessToken, refreshToken, cookieOptions } = createSendToken(user);

  await createNotification({
    userId: user._id,
    title: "Login Successful",
    message: "You successfully logged into your WAGBA account.",
    category: "authentication",
    type: "authentication",
    metadata: {
      action: "login",
      authProvider: "local",
    },
  });
  // ----------------------------------------
  // Store refresh token
  // ----------------------------------------

  res.cookie("refreshToken", refreshToken, cookieOptions);

  // ----------------------------------------
  // Response
  // ----------------------------------------

  return responseHandler.successResponse(
    res,
    {
      accessToken,

      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        state: user.state,
        role: user.role,
        authProvider: user.authProvider,
      },
    },
    "Login successful",
    200,
  );
});

// ==========================================
// CONTINUE WITH GOOGLE
// ==========================================

export const googleAuth = tryCatchFn(async (req, res) => {
  const { credential } = req.body;

  // ----------------------------------------
  // Check credential
  // ----------------------------------------

  if (!credential) {
    throw responseHandler.errorResponse("Google credential is required", 400);
  }

  // ----------------------------------------
  // Verify Google credential
  // ----------------------------------------

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw responseHandler.errorResponse("Unable to verify Google account", 401);
  }

  const { sub: googleId, email, name, picture, email_verified } = payload;

  // ----------------------------------------
  // Verify email
  // ----------------------------------------

  if (!email || email_verified !== true) {
    throw responseHandler.errorResponse(
      "Your Google email could not be verified",
      401,
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  // ----------------------------------------
  // Find Google account
  // ----------------------------------------

  let user = await User.findOne({
    googleId,
  });

  // ----------------------------------------
  // Existing email account
  // ----------------------------------------

  if (!user) {
    user = await User.findOne({
      email: normalizedEmail,
    });
  }

  // ----------------------------------------
  // Existing user
  // ----------------------------------------

  if (user) {
    // --------------------------------------
    // Link Google account if email matches
    // --------------------------------------

    if (!user.googleId) {
      user.googleId = googleId;
    }

    user.profileImage = picture || user.profileImage;

    user.authProvider = "google";

    await user.save();
  } else {
    // --------------------------------------
    // Create new Google user
    // --------------------------------------

    user = await User.create({
      fullName,
      email: normalizedEmail,
      googleId,
      profileImage: picture || null,
      authProvider: "google",
      acceptedTerms: true,
      role: "customer",
    });
  }

  // ----------------------------------------
  // Create Wagba tokens
  // ----------------------------------------

  const { accessToken, refreshToken, cookieOptions } = createSendToken(user);

  await createNotification({
    userId: user._id,
    title: isNewUser ? "Welcome to WAGBA" : "Google Login Successful",
    message: isNewUser
      ? `Welcome to WAGBA, ${user.fullName}! Your Google account has been created successfully.`
      : "You successfully signed in to your WAGBA account with Google.",
    category: "authentication",
    type: "authentication",
    metadata: {
      action: isNewUser ? "account_created" : "google_login",
      authProvider: "google",
    },
  });

  // ----------------------------------------
  // Refresh token cookie
  // ----------------------------------------

  res.cookie("refreshToken", refreshToken, cookieOptions);

  // ----------------------------------------
  // Response
  // ----------------------------------------

  return responseHandler.successResponse(
    res,
    {
      accessToken,

      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || null,
        state: user.state || null,
        role: user.role,
        authProvider: user.authProvider,
        profileImage: user.profileImage || null,
      },
    },
    "Google authentication successful..",
    200,
  );
});

export const logout = async (req, res) => {
  try {
    /* =========================
       ACCESS TOKEN
    ========================= */
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "No access token provided",
      });
    }

    /* =========================
       BLACKLIST ACCESS TOKEN
    ========================= */
    const decoded = jwt.decode(token);

    await TokenBlacklist.create({
      token,
      expiresAt: new Date(decoded.exp * 1000), // auto-clean when JWT expires
    });

    /* =========================
       REFRESH TOKEN REVOCATION
    ========================= */
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await User.findByIdAndUpdate(decoded.id, {
        refreshToken: null,
      });
    }

    /* =========================
       CLEAR COOKIE
    ========================= */
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    const user = await User.findById(decoded.id);

    if (user) {
      await createNotification({
        userId: user._id,
        title: "Logged Out",
        message: "You logged out of your WAGBA account.",
        category: "authentication",
        type: "authentication",
        metadata: {
          action: "logout",
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to logout",
    });
  }
};

/* =====================================================
   FORGOT PASSWORD
===================================================== */

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = generateOTP();

    user.otpHash = hashOTP(otp);
    user.otpExpiresAt = Date.now() + 10 * 60 * 1000;
    user.otpPurpose = "password_reset";

    await user.save();

    await createNotification({
      userId: user._id,
      title: "Password Reset Requested",
      message:
        "A password reset verification code was requested for your WAGBA account.",
      category: "security",
      type: "security",
      metadata: {
        action: "password_reset_requested",
      },
    });

    await sendOTP({
      email: user.email,
      phone: user.phone,
      otp,
    });

    return res.json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Failed to send verification code",
    });
  }
};

/* =====================================================
   VERIFY PASSWORD RESET OTP
===================================================== */

export const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+otpHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.otpPurpose !== "password_reset") {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP request",
      });
    }

    if (!user.otpExpiresAt || Date.now() > user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    const valid = verifyOTP(otp, user.otpHash);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Create temporary reset token

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpPurpose = null;

    await user.save();
    await createNotification({
      userId: user._id,
      title: "Password Reset Verified",
      message:
        "Your password reset verification code was successfully verified.",
      category: "security",
      type: "security",
      metadata: {
        action: "password_reset_otp_verified",
      },
    });
    return res.json({
      success: true,
      message: "OTP verified",
      resetToken,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: {
        $gt: Date.now(),
      },
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    user.password = await bcrypt.hash(password, 10);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    await createNotification({
      userId: user._id,
      title: "Password Reset Successful",
      message: "Your WAGBA password has been reset successfully.",
      category: "security",
      type: "security",
      metadata: {
        action: "password_reset_completed",
      },
    });

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Password reset failed",
    });
  }
};

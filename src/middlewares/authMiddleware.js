import jwt from "jsonwebtoken";
import User from "../models/user.js";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// =====================================
// AUTHENTICATION / PROTECT
// =====================================
export const protect = tryCatchFn(async (req, res, next) => {
  let accessToken;

  // =====================================
  // GET ACCESS TOKEN
  // =====================================
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    accessToken = authHeader.split(" ")[1];
  }

  if (!accessToken) {
    throw responseHandler.unauthorizedResponse(
      "You are not logged in. Please login to continue.",
    );
  }

  // =====================================
  // VERIFY ACCESS TOKEN
  // =====================================
  let decoded;

  try {
    decoded = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw responseHandler.unauthorizedResponse(
        "Access token has expired. Please refresh your session.",
      );
    }

    throw responseHandler.unauthorizedResponse("Invalid access token.");
  }

  // =====================================
  // FIND USER
  // =====================================
  const user = await User.findById(decoded.id).select(
    "_id fullName email phone state role",
  );

  if (!user) {
    throw responseHandler.unauthorizedResponse(
      "The user associated with this token no longer exists.",
    );
  }

  // =====================================
  // ATTACH USER TO REQUEST
  // =====================================
  req.user = {
    _id: user._id,
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    state: user.state,
    role: user.role,
  };

  next();
});

// =====================================
// OPTIONAL AUTHENTICATION
// =====================================
// Useful for endpoints that work for both
// logged-in and guest users.
export const optionalProtect = tryCatchFn(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const accessToken = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);

    const user = await User.findById(decoded.id).select(
      "_id fullName email phone state role",
    );

    if (user) {
      req.user = {
        _id: user._id,
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        state: user.state,
        role: user.role,
      };
    }
  } catch (error) {
    // For optional authentication, simply continue
    // as a guest if the token is invalid/expired.
  }

  next();
});

// =====================================
// ROLE AUTHORIZATION
// =====================================
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        responseHandler.unauthorizedResponse(
          "You must be logged in to access this resource.",
        ),
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        responseHandler.forbiddenResponse(
          "You do not have permission to perform this action.",
        ),
      );
    }

    next();
  };
};

// =====================================
// ADMIN ONLY
// =====================================
export const adminOnly = authorize("admin");

// =====================================
// CUSTOMER ONLY
// =====================================
export const customerOnly = authorize("user", "customer");

// =====================================
// DEFAULT EXPORT
// =====================================
export default protect;

import Restaurant from "../models/restaurant.model.js";
import User from "../models/user.js";
import cloudinary from "../configs/cloudinary.js";
import streamifier from "streamifier";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";
import validStates from "../constants/nigerianStates.js";

// ==========================================
// HELPER: UPLOAD BUFFER TO CLOUDINARY
// ==========================================

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// ==========================================
// CREATE RESTAURANT (RESTAURANT ONBOARDING)
// ==========================================

export const createRestaurant = tryCatchFn(async (req, res) => {
  const {
    name,
    email,
    phone,
    description,
    address,
    state,
    openingTime,
    closingTime,
    cuisineType,
  } = req.body;

  if (!name || !email || !phone || !address || !state) {
    throw responseHandler.errorResponse(
      "Please provide all required restaurant fields",
      400,
    );
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();
  const normalizedState = state.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    throw responseHandler.errorResponse(
      "Please provide a valid restaurant email address",
      400,
    );
  }

  if (!validStates.includes(normalizedState)) {
    throw responseHandler.errorResponse(
      "Please select a valid Nigerian state",
      400,
    );
  }

  if (req.user.restaurant) {
    throw responseHandler.errorResponse(
      "This account is already linked to a restaurant",
      409,
    );
  }

  const existingRestaurant = await Restaurant.findOne({
    email: normalizedEmail,
  });

  if (existingRestaurant) {
    throw responseHandler.errorResponse(
      "A restaurant with this email already exists",
      409,
    );
  }

  let normalizedCuisineType = [];

  if (Array.isArray(cuisineType)) {
    normalizedCuisineType = cuisineType.map((c) => c.trim().toLowerCase());
  } else if (typeof cuisineType === "string" && cuisineType.length > 0) {
    normalizedCuisineType = cuisineType
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (openingTime && !timeRegex.test(openingTime)) {
    throw responseHandler.errorResponse(
      "Please provide a valid opening time (HH:MM)",
      400,
    );
  }

  if (closingTime && !timeRegex.test(closingTime)) {
    throw responseHandler.errorResponse(
      "Please provide a valid closing time (HH:MM)",
      400,
    );
  }

  let logoUrl = null;
  let coverImageUrl = null;

  if (req.files?.logo?.[0]) {
    const logoResult = await uploadToCloudinary(
      req.files.logo[0].buffer,
      "restaurant/logo",
    );
    logoUrl = logoResult.secure_url;
  }

  if (req.files?.coverImage?.[0]) {
    const coverResult = await uploadToCloudinary(
      req.files.coverImage[0].buffer,
      "restaurant/cover",
    );
    coverImageUrl = coverResult.secure_url;
  }

  const restaurant = await Restaurant.create({
    owner: req.user._id,
    name: normalizedName,
    email: normalizedEmail,
    phone: normalizedPhone,
    description: description?.trim() || undefined,
    address: address.trim(),
    state: normalizedState,
    openingTime: openingTime || undefined,
    closingTime: closingTime || undefined,
    cuisineType: normalizedCuisineType,
    logo: logoUrl,
    coverImage: coverImageUrl,
  });

  await User.findByIdAndUpdate(req.user._id, {
    restaurant: restaurant._id,
    role: "restaurant",
  });

  return responseHandler.successResponse(
    res,
    { restaurant },
    "Restaurant created successfully",
    201,
  );
});

// ==========================================
// GET MY RESTAURANT
// ==========================================

export const getMyRestaurant = tryCatchFn(async (req, res) => {
  if (!req.user.restaurant) {
    throw responseHandler.errorResponse(
      "No restaurant linked to this account",
      404,
    );
  }

  const restaurant = await Restaurant.findById(req.user.restaurant);

  if (!restaurant) {
    throw responseHandler.errorResponse("Restaurant not found", 404);
  }

  return responseHandler.successResponse(
    res,
    { restaurant },
    "Restaurant retrieved successfully",
  );
});

// ==========================================
// UPDATE MY RESTAURANT
// ==========================================

export const updateMyRestaurant = tryCatchFn(async (req, res) => {
  if (!req.user.restaurant) {
    throw responseHandler.errorResponse(
      "No restaurant linked to this account",
      404,
    );
  }

  const {
    name,
    description,
    phone,
    address,
    state,
    openingTime,
    closingTime,
    cuisineType,
    isOpen,
  } = req.body;

  const updates = {};

  if (name) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (phone) updates.phone = phone.trim();
  if (address) updates.address = address.trim();

  if (state) {
    const normalizedState = state.trim().toLowerCase();

    if (!validStates.includes(normalizedState)) {
      throw responseHandler.errorResponse(
        "Please select a valid Nigerian state",
        400,
      );
    }

    updates.state = normalizedState;
  }

  if (openingTime) updates.openingTime = openingTime;
  if (closingTime) updates.closingTime = closingTime;
  if (isOpen !== undefined) updates.isOpen = Boolean(isOpen);

  if (cuisineType) {
    updates.cuisineType = Array.isArray(cuisineType)
      ? cuisineType.map((c) => c.trim().toLowerCase())
      : cuisineType
          .split(",")
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean);
  }

  if (req.files?.logo?.[0]) {
    const logoResult = await uploadToCloudinary(
      req.files.logo[0].buffer,
      "restaurant/logo",
    );
    updates.logo = logoResult.secure_url;
  }

  if (req.files?.coverImage?.[0]) {
    const coverResult = await uploadToCloudinary(
      req.files.coverImage[0].buffer,
      "restaurant/cover",
    );
    updates.coverImage = coverResult.secure_url;
  }

  const restaurant = await Restaurant.findByIdAndUpdate(
    req.user.restaurant,
    updates,
    { new: true, runValidators: true },
  );

  return responseHandler.successResponse(
    res,
    { restaurant },
    "Restaurant updated successfully",
  );
});

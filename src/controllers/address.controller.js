import Address from "../models/address.model.js";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// ==========================================
// CREATE ADDRESS
// ==========================================

export const createAddress = tryCatchFn(async (req, res) => {
  const {
    label,
    street,
    apartment,
    city,
    instructions,
    latitude,
    longitude,
    isDefault,
  } = req.body;

  if (!street || !city) {
    throw responseHandler.errorResponse(
      "Please provide street address and city",
      400,
    );
  }

  const validLabels = ["Home", "Work", "Other"];
  const normalizedLabel = validLabels.includes(label) ? label : "Home";

  let location;

  if (latitude !== undefined && longitude !== undefined) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw responseHandler.errorResponse(
        "Latitude and longitude must be valid numbers",
        400,
      );
    }

    location = {
      type: "Point",
      coordinates: [lng, lat],
    };
  }

  const shouldBeDefault = Boolean(isDefault);

  if (shouldBeDefault) {
    await Address.updateMany(
      { user: req.user._id },
      { $set: { isDefault: false } },
    );
  }

  const existingCount = await Address.countDocuments({ user: req.user._id });
  const isFirstAddress = existingCount === 0;

  const address = await Address.create({
    user: req.user._id,
    label: normalizedLabel,
    street: street.trim(),
    apartment: apartment?.trim() || "",
    city: city.trim(),
    instructions: instructions?.trim() || "",
    location,
    isDefault: shouldBeDefault || isFirstAddress,
  });

  return responseHandler.successResponse(
    res,
    { address },
    "Address saved successfully",
    201,
  );
});

// ==========================================
// GET ALL ADDRESSES FOR LOGGED-IN USER
// ==========================================

export const getAddresses = tryCatchFn(async (req, res) => {
  const addresses = await Address.find({ user: req.user._id }).sort({
    isDefault: -1,
    createdAt: -1,
  });

  return responseHandler.successResponse(
    res,
    { addresses, count: addresses.length },
    "Addresses retrieved successfully",
  );
});

// ==========================================
// GET SINGLE ADDRESS
// ==========================================

export const getAddressById = tryCatchFn(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!address) {
    throw responseHandler.errorResponse("Address not found", 404);
  }

  return responseHandler.successResponse(
    res,
    { address },
    "Address retrieved successfully",
  );
});

// ==========================================
// UPDATE ADDRESS
// ==========================================

export const updateAddress = tryCatchFn(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!address) {
    throw responseHandler.errorResponse("Address not found", 404);
  }

  const {
    label,
    street,
    apartment,
    city,
    instructions,
    latitude,
    longitude,
    isDefault,
  } = req.body;

  const validLabels = ["Home", "Work", "Other"];

  if (label && validLabels.includes(label)) address.label = label;
  if (street) address.street = street.trim();
  if (apartment !== undefined) address.apartment = apartment.trim();
  if (city) address.city = city.trim();
  if (instructions !== undefined) address.instructions = instructions.trim();

  if (latitude !== undefined && longitude !== undefined) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw responseHandler.errorResponse(
        "Latitude and longitude must be valid numbers",
        400,
      );
    }

    address.location = { type: "Point", coordinates: [lng, lat] };
  }

  if (isDefault !== undefined && Boolean(isDefault)) {
    await Address.updateMany(
      { user: req.user._id, _id: { $ne: address._id } },
      { $set: { isDefault: false } },
    );
    address.isDefault = true;
  }

  await address.save();

  return responseHandler.successResponse(
    res,
    { address },
    "Address updated successfully",
  );
});

// ==========================================
// DELETE ADDRESS
// ==========================================

export const deleteAddress = tryCatchFn(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!address) {
    throw responseHandler.errorResponse("Address not found", 404);
  }

  const wasDefault = address.isDefault;

  await address.deleteOne();

  if (wasDefault) {
    const nextAddress = await Address.findOne({ user: req.user._id }).sort({
      createdAt: -1,
    });

    if (nextAddress) {
      nextAddress.isDefault = true;
      await nextAddress.save();
    }
  }

  return responseHandler.successResponse(
    res,
    {},
    "Address deleted successfully",
  );
});

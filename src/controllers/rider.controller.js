import mongoose from "mongoose";
import Rider from "../models/rider.js";
import Order from "../models/order.js";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// ==========================================================
// HELPER: THROW ERROR
// ==========================================================

const createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ==========================================================
// HELPER: CALCULATE DISTANCE
// Haversine formula - distance in KM
// ==========================================================

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined
  ) {
    return null;
  }

  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;

  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// ==========================================================
// CREATE RIDER
// POST /api/riders
// ==========================================================

export const createRider = tryCatchFn(async (req, res) => {
  const {
    fullName,
    email,
    phone,
    dateOfBirth,
    homeAddress,
    vehicleType,
    vehicleModel,
    registrationNumber,
    color,
    status,
    assignedZone,
  } = req.body;

  // ------------------------------------------------------
  // REQUIRED FIELDS
  // ------------------------------------------------------

  if (!fullName || !email || !phone || !homeAddress || !vehicleType) {
    throw createError(
      "Please fill in all required fields: Full Name, Email, Phone, Home Address and Vehicle Type.",
      400,
    );
  }

  // ------------------------------------------------------
  // VALIDATE VEHICLE TYPE
  // ------------------------------------------------------

  const allowedVehicleTypes = ["bike", "bicycle", "car"];

  if (!allowedVehicleTypes.includes(vehicleType)) {
    throw createError("Invalid vehicle type. Use bike, bicycle, or car.", 400);
  }

  // ------------------------------------------------------
  // CHECK EMAIL
  // ------------------------------------------------------

  const normalizedEmail = email.trim().toLowerCase();

  const existingRider = await Rider.findOne({
    email: normalizedEmail,
  });

  if (existingRider) {
    throw createError("A rider with this email already exists.", 409);
  }

  // ------------------------------------------------------
  // PROFILE PHOTO
  // ------------------------------------------------------
  //
  // With multer.memoryStorage():
  // req.file.buffer contains the uploaded image.
  //
  // Cloudinary upload should normally happen here.
  // For now, the model receives an empty URL if no
  // Cloudinary URL has been generated.
  // ------------------------------------------------------

  let profilePhoto = "";

  if (req.file) {
    // If your Cloudinary upload is handled here,
    // replace this section with the Cloudinary URL.
    //
    // req.file.buffer is available.
    console.log("Profile image received:", req.file.originalname);
  }

  // ------------------------------------------------------
  // CREATE RIDER
  // ------------------------------------------------------

  const newRider = await Rider.create({
    fullName: fullName.trim(),

    email: normalizedEmail,

    phone: phone.trim(),

    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,

    homeAddress: homeAddress.trim(),

    vehicleType: vehicleType.toLowerCase(),

    vehicleModel: vehicleModel?.trim() || "",

    registrationNumber: registrationNumber?.trim().toUpperCase() || "",

    color: color?.trim() || "",

    profilePhoto,

    status: status || "offline",

    assignedZone: assignedZone || "all",
  });

  return res.status(201).json({
    success: true,
    message: "Rider added successfully.",
    data: newRider,
  });
});

// ==========================================================
// GET ALL RIDERS
// GET /api/riders
// ==========================================================

export const getRiders = tryCatchFn(async (req, res) => {
  let page = parseInt(req.query.page, 10) || 1;

  let limit = parseInt(req.query.limit, 10) || 10;

  page = Math.max(page, 1);

  limit = Math.min(Math.max(limit, 1), 100);

  const skip = (page - 1) * limit;

  const search = req.query.search?.trim() || "";

  const status = req.query.status?.trim() || "";

  const vehicleType = req.query.vehicleType?.trim().toLowerCase() || "";

  // ------------------------------------------------------
  // BUILD QUERY
  // ------------------------------------------------------

  const query = {};

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      {
        fullName: {
          $regex: escapedSearch,
          $options: "i",
        },
      },

      {
        email: {
          $regex: escapedSearch,
          $options: "i",
        },
      },

      {
        phone: {
          $regex: escapedSearch,
          $options: "i",
        },
      },

      {
        riderCode: {
          $regex: escapedSearch,
          $options: "i",
        },
      },

      {
        registrationNumber: {
          $regex: escapedSearch,
          $options: "i",
        },
      },
    ];
  }

  if (status && status !== "all") {
    query.status = status;
  }

  if (vehicleType && vehicleType !== "all") {
    query.vehicleType = vehicleType;
  }

  // ------------------------------------------------------
  // FETCH
  // ------------------------------------------------------

  const [riders, totalRiders] = await Promise.all([
    Rider.find(query)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Rider.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalRiders / limit);

  return res.status(200).json({
    success: true,

    data: riders,

    pagination: {
      totalRiders,
      currentPage: page,
      totalPages,
      limit,

      hasNextPage: page < totalPages,

      hasPreviousPage: page > 1,
    },
  });
});

// ==========================================================
// GET RIDER BY ID
// GET /api/riders/:id
// ==========================================================

export const getRiderById = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError("Invalid rider ID.", 400);
  }

  const rider = await Rider.findById(id);

  if (!rider) {
    throw createError("Rider not found.", 404);
  }

  return res.status(200).json({
    success: true,
    data: rider,
  });
});

// ==========================================================
// UPDATE RIDER PROFILE
// PUT /api/riders/:id
// ==========================================================

export const updateRiderProfile = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError("Invalid rider ID.", 400);
  }

  const rider = await Rider.findById(id);

  if (!rider) {
    throw createError("Rider not found.", 404);
  }

  const {
    fullName,
    email,
    phone,
    dateOfBirth,
    homeAddress,
    vehicleType,
    vehicleModel,
    registrationNumber,
    color,
    status,
    assignedZone,
    statusMessage,
  } = req.body;

  // ----------------------------------------------------
  // EMAIL
  // ----------------------------------------------------

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();

    const emailExists = await Rider.findOne({
      email: normalizedEmail,
      _id: {
        $ne: id,
      },
    });

    if (emailExists) {
      throw createError("Another rider is already using this email.", 409);
    }

    rider.email = normalizedEmail;
  }

  // ----------------------------------------------------
  // UPDATE FIELDS
  // ----------------------------------------------------

  if (fullName) rider.fullName = fullName.trim();

  if (phone) rider.phone = phone.trim();

  if (dateOfBirth) rider.dateOfBirth = new Date(dateOfBirth);

  if (homeAddress) rider.homeAddress = homeAddress.trim();

  if (vehicleType) {
    const allowedVehicleTypes = ["bike", "bicycle", "car"];

    if (!allowedVehicleTypes.includes(vehicleType.toLowerCase())) {
      throw createError("Invalid vehicle type.", 400);
    }

    rider.vehicleType = vehicleType.toLowerCase();
  }

  if (vehicleModel !== undefined) {
    rider.vehicleModel = vehicleModel.trim();
  }

  if (registrationNumber !== undefined) {
    rider.registrationNumber = registrationNumber.trim().toUpperCase();
  }

  if (color !== undefined) {
    rider.color = color.trim();
  }

  if (status) rider.status = status;

  if (assignedZone) rider.assignedZone = assignedZone;

  if (statusMessage !== undefined) {
    rider.statusMessage = statusMessage.trim();
  }

  // ----------------------------------------------------
  // PROFILE PHOTO
  // ----------------------------------------------------

  if (req.file) {
    console.log("New profile image:", req.file.originalname);

    // Upload req.file.buffer to Cloudinary here
    // and then:
    //
    // rider.profilePhoto = cloudinaryUrl;
  }

  const updatedRider = await rider.save();

  return res.status(200).json({
    success: true,
    message: "Rider profile updated successfully.",
    data: updatedRider,
  });
});

// ==========================================================
// GET RIDER DETAILS
// GET /api/riders/:id/details
// ==========================================================

export const getRiderDetails = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError("Invalid rider ID.", 400);
  }

  const rider = await Rider.findById(id).populate("currentOrder").lean();

  if (!rider) {
    throw createError("Rider not found.", 404);
  }

  const activities = Array.isArray(rider.activities) ? rider.activities : [];

  const todayActivities = activities.slice(-10).reverse();

  return res.status(200).json({
    success: true,

    data: {
      rider,
      todayActivities,
    },
  });
});

// ==========================================================
// GET RIDER DELIVERIES
// GET /api/riders/:id/deliveries
// ==========================================================

export const getRiderDeliveries = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError("Invalid rider ID.", 400);
  }

  let page = parseInt(req.query.page, 10) || 1;

  let limit = parseInt(req.query.limit, 10) || 10;

  page = Math.max(page, 1);

  limit = Math.min(Math.max(limit, 1), 100);

  const status = req.query.status?.trim();

  const rider = await Rider.findById(id).select("deliveries").lean();

  if (!rider) {
    throw createError("Rider not found.", 404);
  }

  let deliveries = Array.isArray(rider.deliveries) ? rider.deliveries : [];

  // ----------------------------------------------------
  // STATUS FILTER
  // ----------------------------------------------------

  if (status) {
    deliveries = deliveries.filter(
      (delivery) => delivery.status?.toUpperCase() === status.toUpperCase(),
    );
  }

  // ----------------------------------------------------
  // SORT
  // ----------------------------------------------------

  deliveries.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  // ----------------------------------------------------
  // PAGINATION
  // ----------------------------------------------------

  const totalOrders = deliveries.length;

  const totalPages = Math.max(Math.ceil(totalOrders / limit), 1);

  const start = (page - 1) * limit;

  const paginatedDeliveries = deliveries.slice(start, start + limit);

  return res.status(200).json({
    success: true,

    data: {
      deliveries: paginatedDeliveries,

      pagination: {
        totalOrders,
        totalPages,
        currentPage: page,
        limit,

        hasNextPage: page < totalPages,

        hasPreviousPage: page > 1,
      },
    },
  });
});

// ==========================================================
// GET ORDER + AVAILABLE RIDERS
// GET /api/riders/orders/:orderId/available-riders
// ==========================================================

export const getOrderAndAvailableRiders = tryCatchFn(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw createError("Invalid order ID.", 400);
  }

  const order = await Order.findById(orderId).lean();

  if (!order) {
    throw createError("Order not found.", 404);
  }

  // ----------------------------------------------------
  // FIND AVAILABLE RIDERS
  // ----------------------------------------------------
  //
  // Your Rider model uses:
  // status: "available"
  //
  // It does NOT use isAvailable.
  // ----------------------------------------------------

  const riders = await Rider.find({
    status: "available",
    isActive: true,
  }).lean();

  // ----------------------------------------------------
  // CUSTOMER LOCATION
  // ----------------------------------------------------

  const customerLocation =
    order.shippingAddress?.location || order.customer?.location || null;

  const customerLatitude = customerLocation?.latitude;

  const customerLongitude = customerLocation?.longitude;

  // ----------------------------------------------------
  // FORMAT RIDERS
  // ----------------------------------------------------

  const availableRiders = riders.map((rider) => {
    // Your current Rider model doesn't have
    // currentLocation, so distance will be null
    // until location fields are added.

    const riderLatitude = rider.location?.latitude;

    const riderLongitude = rider.location?.longitude;

    const distanceKm = calculateDistance(
      customerLatitude,
      customerLongitude,
      riderLatitude,
      riderLongitude,
    );

    let eta = null;

    if (distanceKm !== null) {
      const estimatedMinutes = Math.max(1, Math.round((distanceKm / 20) * 60));

      eta = `${estimatedMinutes} mins`;
    }

    return {
      id: rider._id,

      name: rider.fullName,

      avatar: rider.profilePhoto,

      rating: rider.rating,

      vehicleType: rider.vehicleType,

      status: rider.status,

      distance:
        distanceKm !== null
          ? `${distanceKm.toFixed(1)} km`
          : "Location unavailable",

      eta: eta || "Unavailable",
    };
  });

  return res.status(200).json({
    success: true,

    data: {
      order,
      availableRiders,
    },
  });
});

// ==========================================================
// ASSIGN RIDER TO ORDER
// PATCH /api/riders/orders/:orderId/assign-rider
// ==========================================================

export const assignRiderToOrder = tryCatchFn(async (req, res) => {
  const { orderId } = req.params;

  const { riderId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw createError("Invalid order ID.", 400);
  }

  if (!riderId || !mongoose.Types.ObjectId.isValid(riderId)) {
    throw createError("A valid riderId is required.", 400);
  }

  // ----------------------------------------------------
  // FIND ORDER
  // ----------------------------------------------------

  const order = await Order.findById(orderId);

  if (!order) {
    throw createError("Order not found.", 404);
  }

  // ----------------------------------------------------
  // FIND RIDER
  // ----------------------------------------------------

  const rider = await Rider.findById(riderId);

  if (!rider) {
    throw createError("Rider not found.", 404);
  }

  // ----------------------------------------------------
  // CHECK RIDER STATUS
  // ----------------------------------------------------

  if (rider.status !== "available") {
    throw createError(
      `Rider is currently ${rider.status}. Only available riders can be assigned.`,
      400,
    );
  }

  // ----------------------------------------------------
  // CHECK ORDER STATUS
  // ----------------------------------------------------

  if (["Delivered", "Cancelled"].includes(order.orderStatus)) {
    throw createError(
      `This order cannot be assigned because it is already ${order.orderStatus}.`,
      400,
    );
  }

  // ----------------------------------------------------
  // ASSIGN RIDER
  // ----------------------------------------------------

  order.assignedRider = rider._id;

  // Your current Order model uses orderStatus,
  // not status.
  //
  // "Out for Delivery" already exists in the
  // Order model enum.

  order.orderStatus = "Out for Delivery";

  await order.save();

  // ----------------------------------------------------
  // UPDATE RIDER
  // ----------------------------------------------------

  rider.status = "on_delivery";

  rider.currentOrder = order._id;

  await rider.save();

  return res.status(200).json({
    success: true,

    message: "Rider assigned to order successfully.",

    data: {
      orderId: order._id,

      orderNumber: order.orderId,

      assignedRider: {
        id: rider._id,
        name: rider.fullName,
        phone: rider.phone,
        rating: rider.rating,
        status: rider.status,
      },

      orderStatus: order.orderStatus,
    },
  });
});

// ==========================================================
// EXPORTS
// ==========================================================

export default {
  createRider,
  getRiders,
  getRiderById,
  updateRiderProfile,
  getRiderDetails,
  getRiderDeliveries,
  getOrderAndAvailableRiders,
  assignRiderToOrder,
};

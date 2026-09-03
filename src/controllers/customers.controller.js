import mongoose from "mongoose";
import User from "../models/user.js";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// ==========================================================
// GET ALL USERS
// GET /api/admin/users
// ==========================================================
export const getUsers = tryCatchFn(async (req, res) => {
  let page = parseInt(req.query.page, 10) || 1;
  let limit = parseInt(req.query.limit, 10) || 10;

  // Prevent invalid pagination values
  page = Math.max(page, 1);
  limit = Math.min(Math.max(limit, 1), 100);

  const skip = (page - 1) * limit;

  const search = req.query.search?.trim() || "";
  const status = req.query.status?.trim() || "";

  // ========================================================
  // BUILD QUERY
  // ========================================================
  const query = {};

  // Status filter
  if (status && status !== "All Status" && status !== "all") {
    query.status = status;
  }

  // Search filter
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      {
        name: {
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
    ];
  }

  // ========================================================
  // FETCH USERS
  // ========================================================
  const [users, totalUsers] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),

    User.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalUsers / limit);

  // ========================================================
  // STATISTICS
  // ========================================================
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const [totalCustomers, activeToday, newThisWeek] = await Promise.all([
    User.countDocuments({}),

    User.countDocuments({
      lastActive: {
        $gte: startOfToday,
      },
    }),

    User.countDocuments({
      createdAt: {
        $gte: startOfWeek,
      },
    }),
  ]);

  // ========================================================
  // RESPONSE
  // ========================================================
  return res.status(200).json({
    success: true,

    data: users,

    pagination: {
      totalUsers,
      currentPage: page,
      totalPages,
      limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },

    stats: {
      totalCustomers,
      activeToday,
      newThisWeek,
    },
  });
});

// ==========================================================
// GET SINGLE USER
// GET /api/admin/users/:id
// ==========================================================
export const getUserById = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw responseHandler.badRequestResponse("Invalid user ID");
  }

  const user = await User.findById(id).lean();

  if (!user) {
    throw responseHandler.notFoundResponse("User not found");
  }

  return res.status(200).json({
    success: true,
    data: user,
  });
});

// ==========================================================
// DELETE USER
// DELETE /api/admin/users/:id
// ==========================================================
export const deleteUser = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw responseHandler.badRequestResponse("Invalid user ID");
  }

  const user = await User.findById(id);

  if (!user) {
    throw responseHandler.notFoundResponse("User not found");
  }

  await user.deleteOne();

  return res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

// ==========================================================
// ADD USER NOTE
// POST /api/admin/users/:id/notes
// ==========================================================
export const addUserNote = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  const { author, text } = req.body;

  // Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw responseHandler.badRequestResponse("Invalid user ID");
  }

  // Validate note text
  if (!text || !text.trim()) {
    throw responseHandler.badRequestResponse("Note text is required");
  }

  const user = await User.findById(id);

  if (!user) {
    throw responseHandler.notFoundResponse("User not found");
  }

  // Make sure notes exists
  if (!Array.isArray(user.notes)) {
    user.notes = [];
  }

  user.notes.push({
    author: author?.trim() || "Admin",
    text: text.trim(),
    createdAt: new Date(),
  });

  await user.save();

  return res.status(201).json({
    success: true,
    message: "Note added successfully",
    data: user.notes,
  });
});

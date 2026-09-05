import User from "../models/user.js";
import Notification from "../models/notification.model.js";

import emitDashboardUpdate from "../utils/emitDashboardUpdate.js";
import { sendEmail, sendSMS } from "../utils/notify.js";
import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// ============================================================
// GET USER NOTIFICATIONS
// GET /api/notifications
// ============================================================

export const getNotifications = tryCatchFn(async (req, res) => {
  const { category, unread } = req.query;

  const userId = req.user?._id || req.user?.id;

  if (!userId) {
    throw responseHandler.unauthorizedResponse("Authentication required");
  }

  // ========================================
  // PERSONAL NOTIFICATIONS
  // ========================================

  const personalFilter = {
    user: userId,
  };

  if (category) {
    personalFilter.category = category;
  }

  if (unread === "true") {
    personalFilter.read = false;
  }

  const personalNotifications = await Notification.find(personalFilter)
    .sort({ createdAt: -1 })
    .lean();

  // ========================================
  // BROADCAST NOTIFICATIONS
  // ========================================

  const broadcastFilter = {
    isBroadcast: true,
  };

  if (category) {
    broadcastFilter.category = category;
  }

  const broadcasts = await Notification.find(broadcastFilter)
    .sort({ createdAt: -1 })
    .lean();

  // ========================================
  // FILTER BROADCASTS USER HAS READ
  // ========================================

  const unreadBroadcasts = broadcasts.filter(
    (notification) =>
      !notification.readBy?.some((id) => id.toString() === userId.toString()),
  );

  const broadcastNotifications =
    unread === "true" ? unreadBroadcasts : broadcasts;

  // ========================================
  // MERGE
  // ========================================

  const notifications = [
    ...personalNotifications,
    ...broadcastNotifications,
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // ========================================
  // COUNTS
  // ========================================

  const [
    personalUnread,
    broadcastUnread,
    allPersonal,
    security,
    transaction,
    orders,
    system,
  ] = await Promise.all([
    Notification.countDocuments({
      user: userId,
      read: false,
    }),

    Notification.countDocuments({
      isBroadcast: true,
      readBy: {
        $ne: userId,
      },
    }),

    Notification.countDocuments({
      user: userId,
    }),

    Notification.countDocuments({
      user: userId,
      category: "security",
    }),

    Notification.countDocuments({
      user: userId,
      category: "transaction",
    }),

    Notification.countDocuments({
      user: userId,
      category: "orders",
    }),

    Notification.countDocuments({
      user: userId,
      category: "system",
    }),
  ]);

  return res.status(200).json({
    success: true,

    unreadCount: personalUnread + broadcastUnread,

    notifications,

    counts: {
      all: allPersonal + broadcasts.length,

      unread: personalUnread + broadcastUnread,

      security,

      transaction,

      orders,

      system,
    },
  });
});

// ============================================================
// CREATE PERSONAL NOTIFICATION

export const createNotification = async ({
  userId,
  title,
  message,
  category = "system",
  type = "system",
  email = null,
  phone = null,
  channels = ["InApp"],
  metadata = null,
}) => {
  try {
    if (!userId) {
      throw new Error("userId is required");
    }

    const notification = await Notification.create({
      user: userId,

      specificUserId: userId,

      isBroadcast: false,

      title,

      message,

      category,

      type,

      channels,

      read: false,

      status: "Pending",

      sentToCount: 1,

      deliveryTime: new Date(),

      metadata,
    });

    // ========================================
    // REAL-TIME
    // ========================================

    const io = global.io || null;

    if (io) {
      io.to(`user:${userId.toString()}`).emit("new-notification", notification);

      await emitDashboardUpdate(io, userId);
    }

    // ========================================
    // EMAIL
    // ========================================

    if (channels.includes("Email") && email) {
      try {
        await sendEmail({
          to: email,
          subject: title,
          html: `
            <div style="font-family: Arial, sans-serif;">
              <h2>${title}</h2>
              <p>${message}</p>
              <p>Thank you for using WAGBA.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Notification email error:", error.message);
      }
    }

    // ========================================
    // SMS
    // ========================================

    if (channels.includes("SMS") && phone) {
      try {
        await sendSMS({
          to: phone,
          message,
        });
      } catch (error) {
        console.error("Notification SMS error:", error.message);
      }
    }

    // ========================================
    // UPDATE STATUS
    // ========================================

    notification.status = "Delivered";

    await notification.save();

    return notification;
  } catch (error) {
    console.error("Create Notification Error:", error);

    return null;
  }
};

// ============================================================
// MARK SINGLE NOTIFICATION AS READ
// PATCH /api/notifications/:id/read
// ============================================================

export const markAsRead = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  const userId = req.user?._id || req.user?.id;

  if (!userId) {
    throw responseHandler.unauthorizedResponse("Authentication required");
  }

  if (!id) {
    throw responseHandler.badRequestResponse("Notification ID is required");
  }

  // ========================================
  // PERSONAL NOTIFICATION
  // ========================================

  let notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      user: userId,
    },
    {
      $set: {
        read: true,
      },
    },
    {
      new: true,
    },
  );

  // ========================================
  // BROADCAST NOTIFICATION
  // ========================================

  if (!notification) {
    notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        isBroadcast: true,
      },
      {
        $addToSet: {
          readBy: userId,
        },
      },
      {
        new: true,
      },
    );
  }

  if (!notification) {
    throw responseHandler.notFoundResponse("Notification not found");
  }

  // ========================================
  // REAL-TIME
  // ========================================

  const io = req.app.get("io") || global.io || null;

  if (io) {
    io.to(`user:${userId.toString()}`).emit("notification-read", {
      notificationId: id,
    });

    await emitDashboardUpdate(io, userId);
  }

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    notification,
  });
});

// ============================================================
// MARK ALL AS READ
// PATCH /api/notifications/read-all
// ============================================================

export const markAllAsRead = tryCatchFn(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  if (!userId) {
    throw responseHandler.unauthorizedResponse("Authentication required");
  }

  // Personal
  await Notification.updateMany(
    {
      user: userId,
      read: false,
    },
    {
      $set: {
        read: true,
      },
    },
  );

  // Broadcast
  await Notification.updateMany(
    {
      isBroadcast: true,
      readBy: {
        $ne: userId,
      },
    },
    {
      $addToSet: {
        readBy: userId,
      },
    },
  );

  const io = req.app.get("io") || global.io || null;

  if (io) {
    io.to(`user:${userId.toString()}`).emit("notifications-cleared");

    await emitDashboardUpdate(io, userId);
  }

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
});

// ============================================================
// ADMIN SEND NOTIFICATION
// POST /api/admin/notifications
// ============================================================

export const sendNotification = tryCatchFn(async (req, res) => {
  const {
    title,
    message,
    channels = ["InApp"],
    audience = "all",
    userId,
    category = "system",
    type = "system",
    metadata = null,
  } = req.body;

  // ========================================
  // VALIDATION
  // ========================================

  if (!title?.trim()) {
    throw responseHandler.badRequestResponse("Notification title is required");
  }

  if (!message?.trim()) {
    throw responseHandler.badRequestResponse(
      "Notification message is required",
    );
  }

  // ========================================
  // FORMAT CHANNELS
  // ========================================

  const formattedChannels = Array.isArray(channels)
    ? channels.map((channel) => {
        if (channel.toLowerCase() === "email") {
          return "Email";
        }

        if (channel.toLowerCase() === "sms") {
          return "SMS";
        }

        if (channel.toLowerCase() === "inapp") {
          return "InApp";
        }

        return channel;
      })
    : ["InApp"];

  // ========================================
  // AUDIENCE MAP
  // ========================================

  const audienceMap = {
    all: "All Users",
    verified: "Verified Users",
    inactive: "Inactive Users",
    specific: "Specific User",
  };

  const target = audienceMap[audience];

  if (!target) {
    throw responseHandler.badRequestResponse("Invalid notification audience");
  }

  // ========================================
  // FIND USERS
  // ========================================

  let userQuery = {};

  if (audience === "specific") {
    if (!userId) {
      throw responseHandler.badRequestResponse(
        "userId is required for specific audience",
      );
    }

    userQuery = {
      _id: userId,
    };
  }

  if (audience === "verified") {
    userQuery = {
      $or: [
        {
          isVerified: true,
        },
        {
          verified: true,
        },
        {
          emailVerified: true,
        },
      ],
    };
  }

  if (audience === "inactive") {
    userQuery = {
      $or: [
        {
          isActive: false,
        },
        {
          status: "inactive",
        },
      ],
    };
  }

  // ========================================
  // SPECIFIC USER
  // ========================================

  if (audience === "specific") {
    const user = await User.findById(userId).select(
      "_id email phone fullName firstName lastName",
    );

    if (!user) {
      throw responseHandler.notFoundResponse("User not found");
    }

    const notification = await Notification.create({
      user: user._id,

      specificUserId: user._id,

      isBroadcast: false,

      title: title.trim(),

      message: message.trim(),

      category,

      type,

      target,

      channels: formattedChannels,

      status: "Pending",

      sentToCount: 1,

      deliveryTime: new Date(),

      createdBy: req.user?._id || null,

      createdByType: req.user?.role || "admin",

      metadata,
    });

    await deliverNotification(notification, user, formattedChannels);

    return res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      notification,
    });
  }

  // ========================================
  // ALL / VERIFIED / INACTIVE
  // ========================================

  const users = await User.find(userQuery).select(
    "_id email phone fullName firstName lastName",
  );

  if (!users.length) {
    throw responseHandler.notFoundResponse("No users found for this audience");
  }

  // ========================================
  // CREATE BROADCAST
  // ========================================

  const notification = await Notification.create({
    user: null,

    specificUserId: null,

    isBroadcast: true,

    title: title.trim(),

    message: message.trim(),

    category,

    type,

    target,

    channels: formattedChannels,

    status: "Pending",

    sentToCount: users.length,

    deliveryTime: new Date(),

    createdBy: req.user?._id || null,

    createdByType: req.user?.role || "admin",

    metadata,
  });

  // ========================================
  // DELIVER
  // ========================================

  for (const user of users) {
    await deliverNotification(notification, user, formattedChannels);
  }

  notification.status = "Delivered";

  await notification.save();

  // ========================================
  // SOCKET BROADCAST
  // ========================================

  const io = req.app.get("io") || global.io || null;

  if (io) {
    io.emit("new-broadcast-notification", notification);
  }

  return res.status(201).json({
    success: true,

    message: "Notification sent successfully",

    notification,

    sentToCount: users.length,
  });
});

// ============================================================
// DELIVER NOTIFICATION
// ============================================================

const deliverNotification = async (notification, user, channels) => {
  // ========================================
  // EMAIL
  // ========================================

  if (channels.includes("Email") && user.email) {
    try {
      const fullName =
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        "Valued Customer";

      await sendEmail({
        to: user.email,

        subject: notification.title,

        html: `
          <div style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 20px;
          ">
            <h2>
              ${notification.title}
            </h2>

            <p>
              Hello ${fullName},
            </p>

            <p>
              ${notification.message}
            </p>

            <p>
              Thank you for using WAGBA.
            </p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Email notification failed:", error.message);
    }
  }

  // ========================================
  // SMS
  // ========================================

  if (channels.includes("SMS") && user.phone) {
    try {
      await sendSMS({
        to: user.phone,

        message: notification.message,
      });
    } catch (error) {
      console.error("SMS notification failed:", error.message);
    }
  }

  // ========================================
  // IN-APP
  // ========================================

  if (channels.includes("InApp") && user._id) {
    const io = global.io || null;

    if (io) {
      io.to(`user:${user._id.toString()}`).emit(
        "new-notification",
        notification,
      );
    }
  }
};

// ============================================================
// ADMIN GET ALL NOTIFICATIONS
// GET /api/admin/notifications
// ============================================================

export const adminGetAllNotifications = tryCatchFn(async (req, res) => {
  let {
    page = 1,
    limit = 10,
    search = "",
    status,
    channel,
    target,
    type,
    category,
    sort = "newest",
  } = req.query;

  page = Math.max(Number(page) || 1, 1);

  limit = Math.min(Math.max(Number(limit) || 10, 1), 100);

  const query = {};

  // ========================================
  // SEARCH
  // ========================================

  if (search) {
    query.$or = [
      {
        title: {
          $regex: search,
          $options: "i",
        },
      },
      {
        message: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  // ========================================
  // FILTERS
  // ========================================

  if (status && status !== "All") {
    query.status = status;
  }

  if (channel && channel !== "All Channels") {
    query.channels = channel;
  }

  if (target && target !== "All") {
    query.target = target;
  }

  if (type && type !== "All") {
    query.type = type;
  }

  if (category && category !== "All") {
    query.category = category;
  }

  // ========================================
  // TOTAL
  // ========================================

  const total = await Notification.countDocuments(query);

  // ========================================
  // SORT
  // ========================================

  const sortOption = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

  // ========================================
  // FETCH
  // ========================================

  const notifications = await Notification.find(query)
    .populate("createdBy", "fullName firstName lastName email role")
    .populate("specificUserId", "fullName firstName lastName email phone")
    .sort(sortOption)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const pages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,

    notifications,

    metrics: {
      total,
    },

    pagination: {
      page,
      limit,
      total,
      pages,

      hasNextPage: page < pages,

      hasPrevPage: page > 1,
    },
  });
});

// ============================================================
// ADMIN MARK NOTIFICATION AS READ
// PATCH /api/admin/notifications/:id/read
// ============================================================

export const markNotificationAsRead = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw responseHandler.badRequestResponse("Notification ID is required");
  }

  const notification = await Notification.findById(id);

  if (!notification) {
    throw responseHandler.notFoundResponse("Notification not found");
  }

  notification.read = true;

  const adminId = req.user?._id;

  if (adminId && notification.isBroadcast) {
    notification.readBy = notification.readBy || [];

    if (
      !notification.readBy.some(
        (existingId) => existingId.toString() === adminId.toString(),
      )
    ) {
      notification.readBy.push(adminId);
    }
  }

  await notification.save();

  return res.status(200).json({
    success: true,

    message: "Notification marked as read",

    notification,
  });
});

// ============================================================
// ADMIN MARK ALL AS READ
// PATCH /api/admin/notifications/read-all
// ============================================================

export const markAllNotificationsAsRead = tryCatchFn(async (req, res) => {
  const adminId = req.user?._id;

  if (!adminId) {
    throw responseHandler.unauthorizedResponse("Authentication required");
  }

  await Notification.updateMany(
    {
      isBroadcast: false,
      read: false,
    },
    {
      $set: {
        read: true,
      },
    },
  );

  await Notification.updateMany(
    {
      isBroadcast: true,
      readBy: {
        $ne: adminId,
      },
    },
    {
      $addToSet: {
        readBy: adminId,
      },
    },
  );

  return res.status(200).json({
    success: true,

    message: "All notifications marked as read",
  });
});

// ============================================================
// ADMIN DELETE SINGLE
// DELETE /api/admin/notifications/:id
// ============================================================

export const adminDeleteNotification = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);

  if (!notification) {
    throw responseHandler.notFoundResponse("Notification not found");
  }

  await notification.deleteOne();

  return res.status(200).json({
    success: true,

    message: "Notification deleted successfully",
  });
});

// ============================================================
// ADMIN DELETE ALL
// DELETE /api/admin/notifications
// ============================================================

export const adminDeleteAllNotifications = tryCatchFn(async (req, res) => {
  const result = await Notification.deleteMany({});

  return res.status(200).json({
    success: true,

    deletedCount: result.deletedCount,

    message: `${result.deletedCount} notifications deleted successfully`,
  });
});

// ============================================================
// DEFAULT EXPORT
// ============================================================

const notificationController = {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  sendNotification,
  adminGetAllNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  adminDeleteNotification,
  adminDeleteAllNotifications,
};

export default notificationController;

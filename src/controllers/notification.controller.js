import Template from "../models/Template.js";
import User from "../models/user.js";
import Notification from "../models/Notification.js";
import Contact from "../models/contact.js";

import emitDashboardUpdate from "../utils/emitDashboardUpdate.js";
import { sendEmail, sendSMS } from "../utils/notify.js";

import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// ============================================================
// GET ALL USER NOTIFICATIONS
// GET /api/notifications
// ============================================================

export const getNotifications = tryCatchFn(async (req, res) => {
  const { category, unread } = req.query;

  if (!req.user?._id && !req.user?.id) {
    throw responseHandler.unauthorizedResponse("Authentication required");
  }

  const userId = req.user._id || req.user.id;

  const filter = {
    user: userId,
  };

  if (category) {
    filter.category = category;
  }

  if (unread === "true") {
    filter.read = false;
  }

  const notifications = await Notification.find(filter).sort({
    createdAt: -1,
  });

  const unreadCount = await Notification.countDocuments({
    user: userId,
    read: false,
  });

  const all = await Notification.countDocuments({
    user: userId,
  });

  const security = await Notification.countDocuments({
    user: userId,
    category: "security",
  });

  const transaction = await Notification.countDocuments({
    user: userId,
    category: "transaction",
  });

  const system = await Notification.countDocuments({
    user: userId,
    category: "system",
  });

  return res.status(200).json({
    success: true,
    unreadCount,
    notifications,
    counts: {
      all,
      security,
      transaction,
      system,
    },
  });
});

// ============================================================
// CREATE NEW NOTIFICATION
// This is a reusable service function, NOT an Express handler.
// ============================================================

export const createNotification = async ({
  userId,
  title,
  message,
  category,
  email,
  phone,
  metadata = null,
}) => {
  try {
    if (!userId) {
      throw new Error("userId is required");
    }

    const notification = await Notification.create({
      user: userId,
      title,
      message,
      category,
      read: false,
      metadata,
    });

    // ========================================
    // REAL-TIME UPDATE
    // ========================================

    const io = global.io || null;

    if (io) {
      io.to(userId.toString()).emit("new-notification", notification);
    }

    // ========================================
    // OPTIONAL EMAIL
    // ========================================

    if (email) {
      await sendEmail({
        to: email,
        subject: title,
        html: `<p>${message}</p>`,
      });
    }

    // ========================================
    // OPTIONAL SMS
    // ========================================

    if (phone) {
      await sendSMS({
        to: phone,
        message,
      });
    }

    return notification;
  } catch (error) {
    console.error("Create Notification Error:", error);

    return null;
  }
};

// ============================================================
// MARK SINGLE USER NOTIFICATION AS READ
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

  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      user: userId,
    },
    {
      read: true,
    },
    {
      new: true,
    },
  );

  if (!notification) {
    throw responseHandler.notFoundResponse("Notification not found");
  }

  const io = req.app.get("io");

  if (io) {
    await emitDashboardUpdate(io, userId);

    io.to(userId.toString()).emit("notification-read", {
      notificationId: id,
    });
  }

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    notification,
  });
});

// ============================================================
// MARK ALL USER NOTIFICATIONS AS READ
// PATCH /api/notifications/read-all
// ============================================================

export const markAllAsRead = tryCatchFn(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  if (!userId) {
    throw responseHandler.unauthorizedResponse("Authentication required");
  }

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

  const io = req.app.get("io");

  if (io) {
    await emitDashboardUpdate(io, userId);

    io.to(userId.toString()).emit("notifications-cleared");
  }

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
});

// ============================================================
// ADMIN - SEND NOTIFICATION
// POST /api/admin/notifications
// ============================================================

export const sendNotification = tryCatchFn(async (req, res) => {
  const {
    title,
    message,
    templateId,
    channels = [],
    audience = "all",
    userId,
    schedule = "immediate",
    scheduledTime,
  } = req.body;

  // ========================================
  // VALIDATION
  // ========================================

  if (!title && !templateId) {
    throw responseHandler.badRequestResponse("Title or template is required");
  }

  // ========================================
  // FORMAT CHANNELS
  // ========================================

  const formattedChannels = Array.isArray(channels)
    ? channels.map((channel) => {
        if (channel === "email") return "Email";
        if (channel === "sms") return "SMS";
        if (channel === "inApp") return "InApp";

        return channel;
      })
    : [];

  // ========================================
  // AUDIENCE MAP
  // ========================================

  const audienceMap = {
    all: "All Users",
    verified: "Verified Users",
    inactive: "Inactive Users",
    specific: "Specific User",
  };

  const target = audienceMap[audience] || "All Users";

  // ========================================
  // FETCH TEMPLATE
  // ========================================

  let template = null;

  if (templateId) {
    template = await Template.findById(templateId);

    if (!template) {
      throw responseHandler.notFoundResponse("Template not found");
    }
  }

  const finalTitle = template?.subject || title;

  const finalMessageContent = template?.content || message;

  // ========================================
  // FIND SPECIFIC USER
  // ========================================

  let user = null;
  let userEmail = null;
  let userPhone = null;

  if (audience === "specific") {
    if (!userId) {
      throw responseHandler.badRequestResponse(
        "userId is required for specific audience",
      );
    }

    user = await User.findById(userId);

    if (!user) {
      throw responseHandler.notFoundResponse("User not found");
    }

    userEmail = user.email || null;
    userPhone = user.phone || null;
  }

  // ========================================
  // USER FULL NAME
  // ========================================

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "Valued Customer";

  // ========================================
  // EMAIL HTML
  // ========================================

  const emailHtml = `
      <div style="font-family: Arial, sans-serif;">
        <h2>${finalTitle}</h2>

        <p>
          Hello ${fullName},
        </p>

        <p>
          ${finalMessageContent}
        </p>

        <p>
          Thank you,
          <br />
          WAGBA
        </p>
      </div>
    `;

  // ========================================
  // SAVE NOTIFICATION
  // ========================================

  const notification = await Notification.create({
    title: finalTitle,
    message: finalMessageContent,

    channels: formattedChannels,

    target,

    specificUserId: audience === "specific" ? userId : null,

    status: "Delivered",

    sentToCount: audience === "specific" ? 1 : 0,

    deliveryTime:
      schedule === "scheduled" ? new Date(scheduledTime) : new Date(),

    createdBy: req.user?._id || null,

    createdByType: req.user?.role || "system",
  });

  // ========================================
  // SEND EMAIL
  // ========================================

  if (formattedChannels.includes("Email") && userEmail) {
    try {
      await sendEmail({
        to: userEmail,
        subject: finalTitle,
        html: emailHtml,
      });

      console.log(`✅ Notification email sent to ${userEmail}`);
    } catch (emailError) {
      console.error("❌ Email send error:", emailError);
    }
  }

  // ========================================
  // SEND SMS
  // ========================================

  if (formattedChannels.includes("SMS") && userPhone) {
    try {
      await sendSMS({
        to: userPhone,
        message: finalMessageContent,
      });

      console.log(`✅ Notification SMS sent to ${userPhone}`);
    } catch (smsError) {
      console.error("❌ SMS send error:", smsError);
    }
  }

  // ========================================
  // REAL-TIME IN-APP NOTIFICATION
  // ========================================

  if (
    formattedChannels.includes("InApp") &&
    audience === "specific" &&
    userId
  ) {
    const io = req.app.get("io") || global.io || null;

    if (io) {
      io.to(userId.toString()).emit("new-notification", notification);
    }
  }

  return res.status(201).json({
    success: true,
    message: "Notification sent successfully",
    notification,
  });
});

// ============================================================
// ADMIN - GET ALL NOTIFICATIONS
// GET /api/admin/notifications
// ============================================================

export const adminGetAllNotifications = tryCatchFn(async (req, res) => {
  let {
    page = 1,
    limit = 4,
    search = "",
    status,
    channel,
    target,
    type,
    sort = "newest",
  } = req.query;

  page = Math.max(Number(page) || 1, 1);

  limit = Math.min(Math.max(Number(limit) || 4, 1), 100);

  // ========================================
  // NOTIFICATION QUERY
  // ========================================

  const notificationQuery = {};

  if (search) {
    notificationQuery.$or = [
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

  if (status && status !== "All Activities" && status !== "Received") {
    notificationQuery.status = status;
  }

  if (channel && channel !== "All Channels" && channel !== "Contact Form") {
    notificationQuery.channels = channel;
  }

  if (type && type !== "All" && type !== "support") {
    notificationQuery.type = type;
  }

  if (target) {
    notificationQuery.target = target;
  }

  const notifications = await Notification.find(notificationQuery)
    .populate("createdBy", "firstName lastName name email role")
    .populate("specificUserId", "firstName lastName email")
    .lean();

  // ========================================
  // CONTACT QUERY
  // ========================================

  const contactQuery = {};

  if (search) {
    contactQuery.$or = [
      {
        subject: {
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
      {
        fullName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  let contacts = [];

  if (!type || type === "All" || type === "support") {
    contacts = await Contact.find(contactQuery).lean();

    if (channel && channel !== "All Channels" && channel !== "Contact Form") {
      contacts = [];
    }

    if (status && status !== "All Activities" && status !== "Received") {
      contacts = [];
    }
  }

  // ========================================
  // NORMALIZE NOTIFICATIONS
  // ========================================

  const notificationData = notifications.map((item) => ({
    id: item._id,

    recordType: "notification",

    type: item.type,

    title: item.title || null,

    subject: null,

    titleOrSubject: item.title,

    message: item.message,

    channels: item.channels || [],

    target: item.target,

    sentCount: item.sentToCount || 0,

    createdAt: item.createdAt,

    createdBy:
      item.createdBy?.name ||
      [item.createdBy?.firstName, item.createdBy?.lastName]
        .filter(Boolean)
        .join(" ") ||
      "System",

    createdByEmail: item.createdBy?.email || "-",

    createdByRole: item.createdBy?.role || "-",

    status: item.status,
  }));

  // ========================================
  // NORMALIZE CONTACTS
  // ========================================

  const contactData = contacts.map((item) => ({
    id: item._id,

    recordType: "contact",

    type: "support",

    title: null,

    subject: item.subject,

    titleOrSubject: item.subject,

    message: item.message,

    channels: ["Contact Form"],

    target: item.email,

    sentCount: 1,

    createdAt: item.createdAt,

    createdBy: item.fullName,

    createdByEmail: item.email,

    createdByRole: "Customer",

    status: "Received",
  }));

  // ========================================
  // MERGE + SORT
  // ========================================

  let data = [...notificationData, ...contactData];

  data.sort((a, b) =>
    sort === "oldest"
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt),
  );

  // ========================================
  // PAGINATION
  // ========================================

  const total = data.length;

  const start = (page - 1) * limit;

  const end = start + limit;

  const paginatedData = data.slice(start, end);

  const pages = Math.ceil(total / limit);

  // ========================================
  // RESPONSE
  // ========================================

  return res.status(200).json({
    success: true,

    notifications: paginatedData,

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
// ADMIN - MARK SINGLE NOTIFICATION AS READ
// PATCH /api/admin/notifications/:id/read
// ============================================================

export const markNotificationAsRead = tryCatchFn(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);

  if (!notification) {
    throw responseHandler.notFoundResponse("Notification not found");
  }

  notification.read = true;

  // ========================================
  // PREVENT DUPLICATE READ USERS
  // ========================================

  const userId = req.user?._id;

  if (userId) {
    const alreadyRead = notification.readBy?.some(
      (existingUserId) => existingUserId.toString() === userId.toString(),
    );

    if (!alreadyRead) {
      notification.readBy.push(userId);
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
// ADMIN - MARK ALL NOTIFICATIONS AS READ
// PATCH /api/admin/notifications/read-all
// ============================================================

export const markAllNotificationsAsRead = tryCatchFn(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw responseHandler.unauthorizedResponse("Authentication required");
  }

  // Mark all unread notifications as read
  await Notification.updateMany(
    {
      read: false,
    },
    {
      $set: {
        read: true,
      },
    },
  );

  // Add current admin to readBy
  await Notification.updateMany(
    {
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

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
});

// ============================================================
// ADMIN - DELETE SINGLE NOTIFICATION
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
// ADMIN - DELETE ALL NOTIFICATIONS
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

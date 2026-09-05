import express from "express";

import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  sendNotification,
  adminGetAllNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  adminDeleteNotification,
  adminDeleteAllNotifications,
} from "../controllers/notification.controller.js";

import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ======================================================
// USER NOTIFICATIONS
// ======================================================

// Get user's notifications
router.get("/", protect, getNotifications);

// Mark all user's notifications as read
router.patch("/read-all", protect, markAllAsRead);

// Mark one user's notification as read
router.patch("/:id/read", protect, markAsRead);

// ======================================================
// ADMIN NOTIFICATIONS
// ======================================================

// Get all notifications
router.get(
  "/admin",
  protect,
  authorize("admin", "manager"),
  adminGetAllNotifications,
);

// Mark all notifications as read
router.patch(
  "/admin/read-all",
  protect,
  authorize("admin", "manager"),
  markAllNotificationsAsRead,
);

// Mark one notification as read
router.patch(
  "/admin/:id/read",
  protect,
  authorize("admin", "manager"),
  markNotificationAsRead,
);

// Delete all notifications
router.delete(
  "/admin/delete-all",
  protect,
  authorize("admin", "manager"),
  adminDeleteAllNotifications,
);

// Delete one notification
router.delete(
  "/admin/:id",
  protect,
  authorize("admin", "manager"),
  adminDeleteNotification,
);

// ======================================================
// SEND NOTIFICATIONS
// ======================================================

router.post("/send", protect, authorize("admin", "manager"), sendNotification);

// ======================================================
// EXPORT
// ======================================================

export default router;

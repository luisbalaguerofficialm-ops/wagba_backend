const express = require("express");
const router = express.Router();

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
} from "../controllers/notificationController";

import { protect, authorize } from "../middlewares/authMiddleware";

// ======================================================
// USER NOTIFICATIONS
// ======================================================

router.get("/", protect, getNotifications);

router.patch("/read-all", protect, markAllAsRead);

router.patch("/:id/read", protect, markAsRead);



// ======================================================
// ADMIN NOTIFICATIONS
// ======================================================

router.get(
  "/admin",
  protect,
  authorize("admin", "manager", "superadmin"),
  adminGetAllNotifications,
);

router.patch(
  "/admin/read-all",
  protect,
  authorize("admin", "manager", "superadmin"),
  markAllNotificationsAsRead,
);

router.patch(
  "/admin/:id/read",
  protect,
  authorize("admin", "manager", "superadmin"),
  markNotificationAsRead,
);

router.delete(
  "/admin/delete-all",
  protect,
  authorize("admin", "manager", "superadmin"),
  adminDeleteAllNotifications,
);

router.delete(
  "/admin/:id",
  protect,
  authorize("admin", "manager", "superadmin"),
  adminDeleteNotification,
);

// ======================================================
// SEND NOTIFICATIONS
// ======================================================

router.post(
  "/send",
  protect,
  authorize("admin", "manager", "superadmin"),
  sendNotification,
);

module.exports = router;

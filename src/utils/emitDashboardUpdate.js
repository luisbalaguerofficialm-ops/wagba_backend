// ============================================================
// EMIT DASHBOARD UPDATE
// ============================================================
//
// Sends real-time dashboard/notification updates through
// Socket.IO.
//
// Usage:
//
// await emitDashboardUpdate(io, userId);
//
// ============================================================

const emitDashboardUpdate = async (io, userId = null) => {
  try {
    if (!io) {
      return;
    }

    // ========================================
    // USER-SPECIFIC UPDATE
    // ========================================

    if (userId) {
      io.to(`user:${userId.toString()}`).emit("dashboard:update", {
        type: "notification",
        userId: userId.toString(),

        updatedAt: new Date().toISOString(),
      });

      return;
    }

    // ========================================
    // GLOBAL DASHBOARD UPDATE
    // ========================================

    io.emit("dashboard:update", {
      type: "notification",

      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ emitDashboardUpdate Error:", error.message);
  }
};

export default emitDashboardUpdate;

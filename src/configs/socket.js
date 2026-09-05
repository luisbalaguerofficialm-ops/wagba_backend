import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io;

// =====================================
// INITIALIZE SOCKET.IO
// =====================================
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin:
        process.env.CLIENT_URL ||
        "http://localhost:5173,https://wagba-nine.vercel.app",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
  });

  // =====================================
  // SOCKET AUTHENTICATION
  // =====================================
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      // Allow guest connections
      if (!token) {
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      // Your JWT uses decoded.id
      socket.user = {
        id: decoded.id,
        _id: decoded.id,
        role: decoded.role || null,
      };

      next();
    } catch (error) {
      console.error("❌ Socket authentication failed:", error.message);

      // Reject invalid token
      return next(new Error("Invalid or expired access token."));
    }
  });

  // =====================================
  // CONNECTION
  // =====================================
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // =====================================
    // LOGGED-IN USER
    // =====================================
    if (socket.user?.id) {
      const userId = socket.user.id;
      const role = socket.user.role;

      // Personal room
      socket.join(`user:${userId}`);

      console.log(`👤 User joined room: user:${userId}`);

      // Role room
      if (role) {
        socket.join(`role:${role}`);

        console.log(`👥 User joined role room: role:${role}`);
      }
    }

    // =====================================
    // JOIN CUSTOM ROOM
    // =====================================
    socket.on("joinRoom", (room) => {
      if (!room || typeof room !== "string") {
        return;
      }

      socket.join(room);

      console.log(`🚪 ${socket.id} joined room: ${room}`);
    });

    // =====================================
    // LEAVE CUSTOM ROOM
    // =====================================
    socket.on("leaveRoom", (room) => {
      if (!room || typeof room !== "string") {
        return;
      }

      socket.leave(room);

      console.log(`🚪 ${socket.id} left room: ${room}`);
    });

    // =====================================
    // DISCONNECT
    // =====================================
    socket.on("disconnect", (reason) => {
      console.log(`🔴 Socket disconnected: ${socket.id} - ${reason}`);
    });
  });

  console.log("✅ Socket.IO initialized");

  return io;
};

// =====================================
// GET SOCKET.IO INSTANCE
// =====================================
export const getIO = () => {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized. Call initSocket(server) first.",
    );
  }

  return io;
};

// =====================================
// EMIT TO SPECIFIC USER
// =====================================
export const emitToUser = (userId, event, data) => {
  if (!io) return;

  io.to(`user:${userId}`).emit(event, data);
};

// =====================================
// EMIT TO ROLE
// =====================================
export const emitToRole = (role, event, data) => {
  if (!io) return;

  io.to(`role:${role}`).emit(event, data);
};

// =====================================
// EMIT TO ALL USERS
// =====================================
export const emitToAll = (event, data) => {
  if (!io) return;

  io.emit(event, data);
};

// =====================================
// EMIT TO CUSTOM ROOM
// =====================================
export const emitToRoom = (room, event, data) => {
  if (!io) return;

  io.to(room).emit(event, data);
};

// =====================================
// DEFAULT EXPORT
// =====================================
export default getIO;

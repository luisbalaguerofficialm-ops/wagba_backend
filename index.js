import "./src/configs/env.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import http from "http";

// Modular Imports
import { initSocket } from "./src/configs/socket.js";
import connectDB from "./src/configs/db.server.js";
import logger from "./src/configs/logger.js";
import { helmetOptions, compressionOptions } from "./src/libs/options.js";
import { gracefulShutdown } from "./src/configs/db.server.js";
import {
  catchNotFound,
  globalErrorHandler,
} from "./src/middlewares/errorHandler.js";

// Routes
import addressRoutes from "./src/routes/address.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import cartRoutes from "./src/routes/cart.routes.js";
import customersRoutes from "./src/routes/customers.routes.js";
import favoriteRoutes from "./src/routes/favorite.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import orderRoutes from "./src/routes/order.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import restaurantRoutes from "./src/routes/restaurant.routes.js";
import reviewRoutes from "./src/routes/review.routes.js";
import riderRoutes from "./src/routes/review.routes.js";
import settingsRoutes from "./src/routes/settings.routes.js";
import productRoutes from "./src/routes/product.routes.js";
import adminDashboardRoutes from "./src/routes/admindashboard.routes.js";

const app = express();
app.set("trust proxy", 1);

/* ========================
   CORE MIDDLEWARES
======================== */
app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.disable("x-powered-by");

app.use(helmet(helmetOptions));
app.use(compression(compressionOptions));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

/* ========================
   CORS FIX (FINAL)
======================== */
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "https://wagba-nine.vercel.app"];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS BLOCKED:", origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // ✅ FIXED (NO "*")

/* ========================
   REQUEST TIME
======================== */
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

/* ========================
   SOCKET
======================== */
const server = http.createServer(app);
const io = initSocket(server, allowedOrigins);

app.use((req, res, next) => {
  req.io = io;
  next();
});

/* ========================
   ROUTES
======================== */
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "wagba Transit API running",
  });
});

app.use("/api/v3/auth", authRoutes);
app.use("/api/v3/rider", riderRoutes);
app.use("/api/v3/reviews", reviewRoutes);
app.use("/api/v3/notifications", notificationRoutes);
app.use("/api/v3/settings", settingsRoutes);
app.use("/api/v3/payments", paymentRoutes);
app.use("/api/v3/products", productRoutes);
app.use("/api/v3/restaurants", restaurantRoutes);
app.use("/api/v3/orders", orderRoutes);
app.use("/api/v3/customers", customersRoutes);
app.use("/api/v3/favorites", favoriteRoutes);
app.use("/api/v3/address", addressRoutes);
app.use("/api/v3/cart", cartRoutes);
app.use("/api/v3/admin-dashboard", adminDashboardRoutes);
/* ================================
   ERROR HANDLERS
================================ */
app.use(catchNotFound);
app.use(globalErrorHandler);

/* ================================
   START SERVER
================================ */
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`🌐 http://localhost:${PORT}`);
    });

    process.on("unhandledRejection", (err) => {
      logger.error("UNHANDLED REJECTION:", err);
      server.close(() => process.exit(1));
    });

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();

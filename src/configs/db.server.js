import mongoose from "mongoose";
import logger from "./logger.js";

const dbConnection = {
  isConnected: false,
  retryCount: 0,
  maxRetries: 5,
};

const connectToDB = async () => {
  // Don't create another connection if already connected
  if (mongoose.connection.readyState === 1) {
    dbConnection.isConnected = true;
    logger.info("✅ Using existing MongoDB connection");
    return mongoose.connection;
  }

  const mongoUrl = process.env.MONGO_URL;

  if (!mongoUrl) {
    throw new Error("MONGO_URL is not defined. Check your .env file.");
  }

  try {
    logger.info("🔄 Connecting to MongoDB...");

    const conn = await mongoose.connect(mongoUrl, {
      dbName: process.env.DATABASE_NAME || "wagba",

      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,

      retryWrites: true,
      retryReads: true,

      maxPoolSize: 50,
      minPoolSize: 1,
    });

    dbConnection.isConnected = true;
    dbConnection.retryCount = 0;

    logger.info(
      `✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`,
    );

    return conn.connection;
  } catch (error) {
    dbConnection.isConnected = false;
    dbConnection.retryCount++;

    logger.error(
      `❌ MongoDB connection failed (attempt ${dbConnection.retryCount}/${dbConnection.maxRetries})`,
    );

    logger.error(error.message);

    if (dbConnection.retryCount < dbConnection.maxRetries) {
      logger.info("ℹ️ Retrying in 5 seconds...");

      await new Promise((resolve) => setTimeout(resolve, 5000));

      return connectToDB();
    }

    throw new Error(
      `MongoDB connection failed after ${dbConnection.maxRetries} attempts`,
    );
  }
};

// MongoDB connection events
mongoose.connection.on("connected", () => {
  dbConnection.isConnected = true;
  logger.info("🟢 MongoDB connection established");
});

mongoose.connection.on("error", (error) => {
  dbConnection.isConnected = false;
  logger.error("❌ MongoDB connection error:", error.message);
});

mongoose.connection.on("disconnected", () => {
  dbConnection.isConnected = false;
  logger.warn("🟡 MongoDB disconnected");
});

// Graceful shutdown
export const gracefulShutdown = async () => {
  try {
    logger.info("🛑 Closing MongoDB connection...");

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info("✅ MongoDB connection closed");
    }

    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during shutdown:", error.message);
    process.exit(1);
  }
};

export default connectToDB;

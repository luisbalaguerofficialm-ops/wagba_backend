import mongoose from "mongoose";
import Order from "../models/order.js";
import User from "../models/user.js";
import responseHandler from "../libs/responseHandler.js";

// ==========================================================
// CREATE ORDER
// POST /api/orders
// ==========================================================
export const createOrder = async (req, res) => {
  try {
    const {
      userId,
      addressType,
      shippingAddress,
      isForFriend = false,
      paymentMethod,
      transferDetails,
      receivingBank,
      senderAccountNumber,
      verifiedAccountName,
      items,
      subtotal,
      deliveryFee = 0,
      totalAmount,
    } = req.body;

    // ------------------------------------------
    // Validate user
    // ------------------------------------------
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // ------------------------------------------
    // Validate payment method
    // ------------------------------------------
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required.",
      });
    }

    const normalizedPaymentMethod = paymentMethod.toLowerCase();

    if (!["wallet", "transfer"].includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method.",
      });
    }

    // ------------------------------------------
    // Validate items
    // ------------------------------------------
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one order item is required.",
      });
    }

    // ------------------------------------------
    // Validate total amount
    // ------------------------------------------
    const numericTotal = Number(totalAmount);

    if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid total amount is required.",
      });
    }

    // ------------------------------------------
    // Validate transfer details
    // ------------------------------------------
    if (normalizedPaymentMethod === "transfer") {
      const accountNumber =
        senderAccountNumber ||
        transferDetails?.userAccountNumber ||
        transferDetails?.accountNumber;

      const accountName =
        verifiedAccountName ||
        transferDetails?.userAccountName ||
        transferDetails?.accountName;

      if (!accountNumber || String(accountNumber).length !== 10) {
        return res.status(400).json({
          success: false,
          message: "A valid 10-digit sender account number is required.",
        });
      }

      if (!accountName) {
        return res.status(400).json({
          success: false,
          message: "Verified sender account name is required.",
        });
      }
    }

    // ------------------------------------------
    // Create order
    // ------------------------------------------
    const newOrder = await Order.create({
      userId,

      addressType,

      shippingAddress,

      isForFriend: Boolean(isForFriend),

      paymentMethod: normalizedPaymentMethod,

      receivingBank:
        normalizedPaymentMethod === "transfer" ? receivingBank : null,

      senderAccountDetails:
        normalizedPaymentMethod === "transfer"
          ? {
              accountNumber:
                senderAccountNumber ||
                transferDetails?.userAccountNumber ||
                transferDetails?.accountNumber,

              accountName:
                verifiedAccountName ||
                transferDetails?.userAccountName ||
                transferDetails?.accountName,
            }
          : null,

      transferDetails:
        normalizedPaymentMethod === "transfer" ? transferDetails || null : null,

      items,

      subtotal: Number(subtotal) || 0,

      deliveryFee: Number(deliveryFee) || 0,

      totalAmount: numericTotal,

      paymentStatus:
        normalizedPaymentMethod === "wallet" ? "Paid" : "Pending_Verification",

      orderStatus:
        normalizedPaymentMethod === "wallet"
          ? "Processing"
          : "Awaiting_Transfer",
    });

    return res.status(201).json({
      success: true,
      message:
        normalizedPaymentMethod === "wallet"
          ? "Order placed successfully."
          : "Order created. Please complete the bank transfer to confirm your order.",
      data: newOrder,
    });
  } catch (error) {
    console.error("Create Order Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error creating order.",
    });
  }
};

// ==========================================================
// PROCESS CHECKOUT
// POST /api/orders/checkout
// ==========================================================
export const processCheckout = async (req, res) => {
  try {
    const {
      userId,
      shippingAddress,
      addressType,
      isForFriend = false,
      paymentMethod,
      receivingBank,
      senderAccountNumber,
      verifiedAccountName,
      transferDetails,
      items,
      subtotal,
      deliveryFee = 0,
      totalAmount,
    } = req.body;

    // ------------------------------------------
    // Validate required fields
    // ------------------------------------------
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty.",
      });
    }

    const numericTotal = Number(totalAmount);

    if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid total amount.",
      });
    }

    const normalizedPaymentMethod = paymentMethod.toLowerCase();

    if (!["wallet", "transfer"].includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method.",
      });
    }

    // ------------------------------------------
    // Find user
    // ------------------------------------------
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // ======================================================
    // WALLET PAYMENT
    // ======================================================
    if (normalizedPaymentMethod === "wallet") {
      const walletBalance = Number(user.walletBalance) || 0;

      if (walletBalance < numericTotal) {
        return res.status(400).json({
          success: false,
          message:
            "Insufficient wallet balance. Please top up your wallet or use bank transfer.",
          walletBalance,
          requiredAmount: numericTotal,
        });
      }

      // Deduct wallet balance
      user.walletBalance = walletBalance - numericTotal;

      await user.save();
    }

    // ======================================================
    // BANK TRANSFER
    // ======================================================
    if (normalizedPaymentMethod === "transfer") {
      if (!senderAccountNumber || String(senderAccountNumber).length !== 10) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid 10-digit sender account number.",
        });
      }

      if (!verifiedAccountName) {
        return res.status(400).json({
          success: false,
          message: "Please verify the sender bank account before continuing.",
        });
      }
    }

    // ------------------------------------------
    // Create order
    // ------------------------------------------
    const newOrder = await Order.create({
      userId,

      addressType,

      shippingAddress,

      isForFriend: Boolean(isForFriend),

      paymentMethod: normalizedPaymentMethod,

      receivingBank:
        normalizedPaymentMethod === "transfer" ? receivingBank : null,

      senderAccountDetails:
        normalizedPaymentMethod === "transfer"
          ? {
              accountNumber: senderAccountNumber,
              accountName: verifiedAccountName,
            }
          : null,

      transferDetails:
        normalizedPaymentMethod === "transfer" ? transferDetails || null : null,

      items,

      subtotal: Number(subtotal) || 0,

      deliveryFee: Number(deliveryFee) || 0,

      totalAmount: numericTotal,

      paymentStatus:
        normalizedPaymentMethod === "wallet" ? "Paid" : "Pending_Verification",

      orderStatus:
        normalizedPaymentMethod === "wallet"
          ? "Processing"
          : "Awaiting_Transfer",
    });

    return res.status(201).json({
      success: true,

      message:
        normalizedPaymentMethod === "wallet"
          ? "Order placed successfully."
          : "Order created successfully. Please complete the bank transfer to confirm your order.",

      data: newOrder,
    });
  } catch (error) {
    console.error("Checkout Processing Error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "An internal server error occurred while placing the order.",
    });
  }
};

// ==========================================================
// GET ALL ORDERS
// GET /api/orders
// ==========================================================
export const getOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    );

    const skip = (page - 1) * limit;

    const { search, status, startDate, endDate, sortBy = "newest" } = req.query;

    // ------------------------------------------
    // Build filter
    // ------------------------------------------
    const filter = {};

    // ------------------------------------------
    // Status filter
    // ------------------------------------------
    if (status && status.toLowerCase() !== "all") {
      const normalizedStatus = status.toLowerCase();

      filter.orderStatus = new RegExp(
        `^${normalizedStatus.replace(/\s+/g, " ")}$`,
        "i",
      );
    }

    // ------------------------------------------
    // Search filter
    // ------------------------------------------
    if (search?.trim()) {
      const searchRegex = {
        $regex: search.trim(),
        $options: "i",
      };

      filter.$or = [
        { orderId: searchRegex },
        { "items.name": searchRegex },
        { "customer.name": searchRegex },
        { "senderAccountDetails.accountName": searchRegex },
      ];
    }

    // ------------------------------------------
    // Date filter
    // ------------------------------------------
    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate.",
          });
        }

        start.setHours(0, 0, 0, 0);

        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate.",
          });
        }

        end.setHours(23, 59, 59, 999);

        filter.createdAt.$lte = end;
      }
    }

    // ------------------------------------------
    // Sorting
    // ------------------------------------------
    let sortOptions;

    switch (sortBy) {
      case "amount_high_low":
        sortOptions = { totalAmount: -1 };
        break;

      case "amount_low_high":
        sortOptions = { totalAmount: 1 };
        break;

      case "oldest":
        sortOptions = { createdAt: 1 };
        break;

      case "newest":
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    // ------------------------------------------
    // Fetch orders + count
    // ------------------------------------------
    const [rawOrders, totalOrders] = await Promise.all([
      Order.find(filter)
        .populate("userId", "name fullName firstName lastName email phone")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),

      Order.countDocuments(filter),
    ]);

    // ------------------------------------------
    // Metrics
    // ------------------------------------------
    const [metrics] = await Order.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],

          pending: [
            {
              $match: {
                orderStatus: {
                  $regex: /^pending$/i,
                },
              },
            },
            { $count: "count" },
          ],

          inProgress: [
            {
              $match: {
                orderStatus: {
                  $in: ["Processing", "Preparing", "Out for Delivery"],
                },
              },
            },
            { $count: "count" },
          ],

          completed: [
            {
              $match: {
                orderStatus: {
                  $regex: /^delivered$/i,
                },
              },
            },
            { $count: "count" },
          ],

          cancelled: [
            {
              $match: {
                orderStatus: {
                  $regex: /^cancelled$/i,
                },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]);

    // ------------------------------------------
    // Format orders
    // ------------------------------------------
    const orders = rawOrders.map((order) => {
      const customerObject = order.customer || order.userId || {};

      const customerName =
        customerObject.name ||
        customerObject.fullName ||
        [customerObject.firstName, customerObject.lastName]
          .filter(Boolean)
          .join(" ") ||
        order.senderAccountDetails?.accountName ||
        "Unknown Customer";

      const initials =
        customerName
          .split(/\s+/)
          .filter(Boolean)
          .map((name) => name[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "NA";

      const itemsSummary = Array.isArray(order.items)
        ? order.items
            .map((item) => {
              const quantity = item.quantity || 1;
              const itemName =
                item.name || item.productName || item.title || "Item";

              return `${quantity}x ${itemName}`;
            })
            .join(", ")
        : "";

      const orderStatus = order.orderStatus || "Pending";

      // ------------------------------------------
      // Status styles
      // ------------------------------------------
      let statusStyle = "bg-amber-500/10 text-amber-600 border-amber-500/20";

      let statusDot = "bg-amber-600";

      switch (orderStatus.toLowerCase()) {
        case "processing":
        case "preparing":
          statusStyle = "bg-blue-500/10 text-blue-500 border-blue-500/20";
          statusDot = "bg-blue-500";
          break;

        case "out for delivery":
          statusStyle = "bg-purple-500/10 text-purple-500 border-purple-500/20";
          statusDot = "bg-purple-500";
          break;

        case "delivered":
          statusStyle =
            "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
          statusDot = "bg-emerald-500";
          break;

        case "cancelled":
          statusStyle = "bg-red-500/10 text-red-500 border-red-500/20";
          statusDot = "bg-red-500";
          break;

        default:
          break;
      }

      return {
        _id: order._id,

        id: order.orderId || order._id,

        customer: customerName,

        initials,

        datetime: order.createdAt
          ? new Date(order.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A",

        items: itemsSummary,

        total: `₦${Number(order.totalAmount || 0).toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,

        payment: order.paymentStatus || "Pending",

        status: orderStatus,

        statusStyle,

        statusDot,
      };
    });

    return res.status(200).json({
      success: true,

      metrics: {
        totalOrders: metrics?.total?.[0]?.count || 0,
        pendingOrders: metrics?.pending?.[0]?.count || 0,
        inProgressOrders: metrics?.inProgress?.[0]?.count || 0,
        completedOrders: metrics?.completed?.[0]?.count || 0,
        cancelledOrders: metrics?.cancelled?.[0]?.count || 0,
      },

      pagination: {
        totalOrders,
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        limit,
      },

      orders,
    });
  } catch (error) {
    console.error("Get Orders Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching orders.",
      error: error.message,
    });
  }
};

// ==========================================================
// GET ORDER BY ID
// GET /api/orders/:id
// ==========================================================
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    let order;

    // Search by MongoDB _id when valid
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id).populate(
        "userId",
        "name fullName firstName lastName email phone",
      );
    }

    // If not found, search by custom orderId
    if (!order) {
      order = await Order.findOne({ orderId: id }).populate(
        "userId",
        "name fullName firstName lastName email phone",
      );
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get Order By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching order.",
    });
  }
};

// ==========================================================
// UPDATE ORDER STATUS
// PATCH /api/orders/:id/status
// ==========================================================
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Order status is required.",
      });
    }

    const validStatuses = [
      "Pending",
      "Processing",
      "Preparing",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Awaiting_Transfer",
    ];

    const normalizedStatus = validStatuses.find(
      (item) => item.toLowerCase() === status.toLowerCase(),
    );

    if (!normalizedStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Choose from: ${validStatuses.join(", ")}`,
      });
    }

    let updatedOrder;

    if (mongoose.Types.ObjectId.isValid(id)) {
      updatedOrder = await Order.findByIdAndUpdate(
        id,
        {
          $set: {
            orderStatus: normalizedStatus,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );
    }

    if (!updatedOrder) {
      updatedOrder = await Order.findOneAndUpdate(
        { orderId: id },
        {
          $set: {
            orderStatus: normalizedStatus,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );
    }

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Error updating order status.",
    });
  }
};

// ==========================================================
// DELETE ORDER
// DELETE /api/orders/:id
// ==========================================================
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    let deletedOrder;

    if (mongoose.Types.ObjectId.isValid(id)) {
      deletedOrder = await Order.findByIdAndDelete(id);
    }

    if (!deletedOrder) {
      deletedOrder = await Order.findOneAndDelete({
        orderId: id,
      });
    }

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order ${
        deletedOrder.orderId || deletedOrder._id
      } deleted successfully.`,
    });
  } catch (error) {
    console.error("Delete Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error deleting order.",
      error: error.message,
    });
  }
};

// ==========================================================
// BULK UPDATE ORDER STATUS
// PATCH /api/orders/bulk-status
// ==========================================================
export const bulkUpdateStatus = async (req, res) => {
  try {
    const { orderIds, status } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of order IDs.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Please provide an order status.",
      });
    }

    const validStatuses = [
      "Pending",
      "Processing",
      "Preparing",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Awaiting_Transfer",
    ];

    const normalizedStatus = validStatuses.find(
      (item) => item.toLowerCase() === status.toLowerCase(),
    );

    if (!normalizedStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Choose from: ${validStatuses.join(", ")}`,
      });
    }

    const mongoIds = orderIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    const customOrderIds = orderIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );

    const conditions = [];

    if (mongoIds.length > 0) {
      conditions.push({
        _id: {
          $in: mongoIds,
        },
      });
    }

    if (customOrderIds.length > 0) {
      conditions.push({
        orderId: {
          $in: customOrderIds,
        },
      });
    }

    if (conditions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid order IDs were provided.",
      });
    }

    const result = await Order.updateMany(
      {
        $or: conditions,
      },
      {
        $set: {
          orderStatus: normalizedStatus,
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} orders to "${normalizedStatus}".`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk Update Order Status Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Error updating orders.",
    });
  }
};

// ==========================================================
// DEFAULT CONTROLLER EXPORT
// ==========================================================
// This allows either:
// import { createOrder } from "...";
// OR:
// import orderController from "...";
//
// This fixes your previous:
// "does not provide an export named 'default'"
// error.
// ==========================================================

const orderController = {
  createOrder,
  processCheckout,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  bulkUpdateStatus,
};

export default orderController;

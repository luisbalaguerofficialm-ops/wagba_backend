import Order from "../models/order.js";
import User from "../models/user.js";
import Product from "../models/product.js";
import Restaurant from "../models/restaurant.model.js";

import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// ============================================================
// HELPERS
// ============================================================

const getDateRange = (period = "month") => {
  const now = new Date();

  let startDate;
  let previousStartDate;
  let previousEndDate;

  switch (period) {
    case "today": {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);

      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 1);

      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);

      break;
    }

    case "week": {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);

      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 7);

      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);

      break;
    }

    case "year": {
      startDate = new Date(now);
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);

      previousStartDate = new Date(startDate);
      previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);

      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);

      break;
    }

    case "month":
    default: {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);

      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      previousEndDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      break;
    }
  }

  return {
    startDate,
    endDate: now,
    previousStartDate,
    previousEndDate,
  };
};

// ============================================================
// PERCENTAGE CHANGE
// ============================================================

const calculatePercentageChange = (current, previous) => {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
};

// ============================================================
// ADMIN DASHBOARD
// ============================================================

export const getAdminDashboard = tryCatchFn(async (req, res, next) => {
  const period = req.query.period || "month";

  const { startDate, endDate, previousStartDate, previousEndDate } =
    getDateRange(period);

  // ========================================================
  // REVENUE
  // ========================================================

  const [currentRevenueResult, previousRevenueResult] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
          paymentStatus: {
            $in: ["Paid", "paid", "Successful", "successful"],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$totalAmount",
          },
        },
      },
    ]),

    Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousStartDate,
            $lte: previousEndDate,
          },
          paymentStatus: {
            $in: ["Paid", "paid", "Successful", "successful"],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$totalAmount",
          },
        },
      },
    ]),
  ]);

  const currentRevenue = currentRevenueResult[0]?.total || 0;

  const previousRevenue = previousRevenueResult[0]?.total || 0;

  const revenueChange = calculatePercentageChange(
    currentRevenue,
    previousRevenue,
  );

  // ========================================================
  // ORDERS
  // ========================================================

  const [currentOrders, previousOrders] = await Promise.all([
    Order.countDocuments({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    }),

    Order.countDocuments({
      createdAt: {
        $gte: previousStartDate,
        $lte: previousEndDate,
      },
    }),
  ]);

  const ordersChange = calculatePercentageChange(currentOrders, previousOrders);

  // ========================================================
  // AVERAGE ORDER VALUE
  // ========================================================

  const averageOrderValue =
    currentOrders > 0 ? currentRevenue / currentOrders : 0;

  const previousAverageOrderValue =
    previousOrders > 0 ? previousRevenue / previousOrders : 0;

  const averageOrderValueChange = calculatePercentageChange(
    averageOrderValue,
    previousAverageOrderValue,
  );

  // ========================================================
  // NEW CUSTOMERS
  // ========================================================

  const [currentCustomers, previousCustomers] = await Promise.all([
    User.countDocuments({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    }),

    User.countDocuments({
      createdAt: {
        $gte: previousStartDate,
        $lte: previousEndDate,
      },
    }),
  ]);

  const customersChange = calculatePercentageChange(
    currentCustomers,
    previousCustomers,
  );

  // ========================================================
  // RECENT ORDERS
  // ========================================================

  const recentOrders = await Order.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate({
      path: "userId",
      select: "fullName email phone",
    })
    .lean();

  const formattedRecentOrders = recentOrders.map((order) => {
    const customer = order.userId;

    const customerName =
      customer?.fullName || order.customer?.fullName || "Guest Customer";

    const initials = customerName
      .split(" ")
      .map((name) => name.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return {
      id: order._id,
      orderId: order.orderId,
      customer: {
        id: customer?._id || null,
        name: customerName,
        email: customer?.email || "",
        phone: customer?.phone || "",
        initials,
      },

      items: Array.isArray(order.items)
        ? order.items.reduce(
            (total, item) => total + Number(item.quantity || 1),
            0,
          )
        : 0,

      amount: Number(order.totalAmount || 0),

      paymentStatus: order.paymentStatus || "Pending",

      status: order.orderStatus || "Pending",

      createdAt: order.createdAt,
    };
  });

  // ========================================================
  // POPULAR CATEGORIES
  // ========================================================

  const categoryData = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },

    {
      $unwind: {
        path: "$items",
        preserveNullAndEmptyArrays: false,
      },
    },

    {
      $group: {
        _id: {
          $ifNull: ["$items.category", "Other"],
        },

        quantity: {
          $sum: {
            $ifNull: ["$items.quantity", 1],
          },
        },
      },
    },

    {
      $sort: {
        quantity: -1,
      },
    },

    {
      $limit: 10,
    },
  ]);

  const totalCategoryItems = categoryData.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0,
  );

  const popularCategories = categoryData.map((category) => ({
    category: category._id,
    orders: category.quantity,

    percentage:
      totalCategoryItems > 0
        ? Number(((category.quantity / totalCategoryItems) * 100).toFixed(1))
        : 0,
  }));

  // ========================================================
  // ORDER VOLUME BY TIME
  // ========================================================

  const orderVolume = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },

    {
      $group: {
        _id: {
          $hour: "$createdAt",
        },

        orders: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const orderVolumeMap = new Map(
    orderVolume.map((item) => [item._id, item.orders]),
  );

  const orderVolumeByTime = [];

  for (let hour = 8; hour <= 20; hour++) {
    const orders = orderVolumeMap.get(hour) || 0;

    let label;

    if (hour === 12) {
      label = "12p";
    } else if (hour > 12) {
      label = `${hour - 12}p`;
    } else {
      label = `${hour}a`;
    }

    orderVolumeByTime.push({
      hour,
      label,
      orders,
    });
  }

  const maxOrders = Math.max(
    ...orderVolumeByTime.map((item) => item.orders),
    1,
  );

  const formattedOrderVolume = orderVolumeByTime.map((item) => ({
    ...item,

    percentage: Number(((item.orders / maxOrders) * 100).toFixed(1)),
  }));

  // ========================================================
  // TOP RESTAURANTS
  // ========================================================

  const topRestaurants = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },

    {
      $unwind: {
        path: "$items",
        preserveNullAndEmptyArrays: false,
      },
    },

    {
      $lookup: {
        from: "restaurants",
        localField: "items.restaurantId",
        foreignField: "_id",
        as: "restaurant",
      },
    },

    {
      $unwind: {
        path: "$restaurant",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $group: {
        _id: "$items.restaurantId",

        restaurantName: {
          $first: {
            $ifNull: ["$restaurant.name", "$items.restaurantName"],
          },
        },

        orders: {
          $sum: {
            $ifNull: ["$items.quantity", 1],
          },
        },

        revenue: {
          $sum: {
            $multiply: [
              {
                $ifNull: ["$items.price", 0],
              },
              {
                $ifNull: ["$items.quantity", 1],
              },
            ],
          },
        },

        rating: {
          $first: {
            $ifNull: ["$restaurant.rating", 0],
          },
        },
      },
    },

    {
      $sort: {
        orders: -1,
      },
    },

    {
      $limit: 5,
    },
  ]);

  // ========================================================
  // RECENT ACTIVITY
  // ========================================================

  const [activityOrders, activityUsers, activityProducts, activityRestaurants] =
    await Promise.all([
      Order.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id orderId totalAmount createdAt")
        .lean(),

      User.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id fullName email createdAt")
        .lean(),

      Product.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id productName name createdAt")
        .lean(),

      Restaurant.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id restaurantName name createdAt")
        .lean(),
    ]);

  const activity = [
    ...activityOrders.map((order) => ({
      type: "order",
      title: `New order #${order.orderId || order._id}`,
      description: `₦${Number(
        order.totalAmount || 0,
      ).toLocaleString()} order received`,
      createdAt: order.createdAt,
    })),

    ...activityUsers.map((user) => ({
      type: "user",
      title: "New User Signed Up",
      description: `${
        user.email || user.fullName || "New customer"
      } created an account`,
      createdAt: user.createdAt,
    })),

    ...activityProducts.map((product) => ({
      type: "product",
      title: "New Product Added",
      description: product.productName || product.name || "New product added",
      createdAt: product.createdAt,
    })),

    ...activityRestaurants.map((restaurant) => ({
      type: "restaurant",
      title: "New Restaurant Added",
      description:
        restaurant.restaurantName || restaurant.name || "New restaurant added",
      createdAt: restaurant.createdAt,
    })),
  ];

  activity.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const recentActivity = activity.slice(0, 10).map((item) => ({
    ...item,

    createdAt: item.createdAt,

    timeAgo: getTimeAgo(item.createdAt),
  }));

  // ========================================================
  // RESPONSE
  // ========================================================

  return res.status(200).json({
    success: true,

    data: {
      period,

      dateRange: {
        startDate,
        endDate,
        previousStartDate,
        previousEndDate,
      },

      metrics: {
        totalRevenue: Number(currentRevenue.toFixed(2)),

        revenueChange,

        totalOrders: currentOrders,

        ordersChange,

        averageOrderValue: Number(averageOrderValue.toFixed(2)),

        averageOrderValueChange,

        newCustomers: currentCustomers,

        customersChange,
      },

      recentOrders: formattedRecentOrders,

      popularCategories,

      orderVolumeByTime: formattedOrderVolume,

      recentActivity,

      topRestaurants: topRestaurants.map((restaurant) => ({
        restaurantId: restaurant._id,

        name: restaurant.restaurantName || "Unknown Restaurant",

        orders: restaurant.orders || 0,

        revenue: restaurant.revenue || 0,

        rating: restaurant.rating || 0,

        initials: (restaurant.restaurantName || "R").charAt(0).toUpperCase(),
      })),
    },
  });
});

// ============================================================
// TIME AGO
// ============================================================

const getTimeAgo = (date) => {
  const now = Date.now();

  const difference = now - new Date(date).getTime();

  const seconds = Math.floor(difference / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
};

// ============================================================
// EXPORT
// ============================================================

export default {
  getAdminDashboard,
};

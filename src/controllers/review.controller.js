import mongoose from "mongoose";

import Review from "../models/review.js";
import Order from "../models/order.js";
import tryCatchFn from "../libs/tryCatchFn.js";
import responseHandler from "../libs/responseHandler.js";

// ==========================================
// GET ORDER SUMMARY FOR REVIEW
// GET /api/reviews/order/:orderId
// ==========================================

export const getOrderSummaryForReview = tryCatchFn(
  async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw responseHandler.badRequestResponse(
        "Invalid order ID",
      );
    }

    const order = await Order.findById(orderId).select(
      "itemTitle itemImage status orderStatus deliveredAt items",
    );

    if (!order) {
      throw responseHandler.notFoundResponse(
        "Order not found",
      );
    }

    const existingReview = await Review.findOne({
      orderId,
    });

    if (existingReview) {
      throw responseHandler.conflictResponse(
        "A review has already been submitted for this order",
      );
    }

    const firstItem = order.items?.[0];

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,

        itemTitle:
          order.itemTitle ||
          firstItem?.name ||
          "Order",

        itemImage:
          order.itemImage ||
          firstItem?.image ||
          "",

        status:
          order.orderStatus ||
          order.status ||
          "Delivered",

        deliveredAt:
          order.deliveredAt || null,

        statusText:
          order.orderStatus === "Delivered" ||
          order.status === "Delivered"
            ? "Delivered"
            : order.orderStatus ||
              order.status,
      },
    });
  },
);


// ==========================================
// SUBMIT REVIEW
// POST /api/reviews
// ==========================================

export const submitReview = tryCatchFn(
  async (req, res) => {
    const {
      orderId,
      rating,
      tags,
      comment,
      isAnonymous,
      images,
    } = req.body;

    // ========================================
    // AUTHENTICATION
    // ========================================

    if (!req.user?._id) {
      throw responseHandler.unauthorizedResponse(
        "Authentication required",
      );
    }

    // ========================================
    // VALIDATION
    // ========================================

    if (!orderId) {
      throw responseHandler.badRequestResponse(
        "orderId is required",
      );
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw responseHandler.badRequestResponse(
        "Invalid order ID",
      );
    }

    const numericRating = Number(rating);

    if (
      !Number.isFinite(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      throw responseHandler.badRequestResponse(
        "Rating must be between 1 and 5 stars",
      );
    }

    // ========================================
    // FIND ORDER
    // ========================================

    const order = await Order.findById(orderId);

    if (!order) {
      throw responseHandler.notFoundResponse(
        "Order not found",
      );
    }

    // ========================================
    // VERIFY ORDER OWNER
    // ========================================

    if (
      order.userId &&
      order.userId.toString() !==
        req.user._id.toString()
    ) {
      throw responseHandler.forbiddenResponse(
        "You can only review your own orders",
      );
    }

    // ========================================
    // VERIFY DELIVERY
    // ========================================

    const currentStatus =
      order.orderStatus ||
      order.status;

    if (currentStatus !== "Delivered") {
      throw responseHandler.badRequestResponse(
        "You can only review an order after it has been delivered",
      );
    }

    // ========================================
    // CHECK DUPLICATE REVIEW
    // ========================================

    const existingReview =
      await Review.findOne({
        orderId,
      });

    if (existingReview) {
      throw responseHandler.conflictResponse(
        "You have already reviewed this order",
      );
    }

    // ========================================
    // VALID TAGS
    // ========================================

    const allowedTags = [
      "Great Taste",
      "Fast Delivery",
      "Perfect Portion",
      "Well Packaged",
      "Hot Food",
    ];

    const normalizedTags = Array.isArray(tags)
      ? tags.filter((tag) =>
          allowedTags.includes(tag),
        )
      : [];

    // ========================================
    // IMAGES
    // ========================================

    const normalizedImages =
      Array.isArray(images)
        ? images
            .filter(
              (image) =>
                typeof image === "string" &&
                image.trim(),
            )
            .map((image) => image.trim())
        : [];

    // ========================================
    // CREATE REVIEW
    // ========================================

    const review = await Review.create({
      orderId,
      userId: req.user._id,
      rating: numericRating,
      tags: normalizedTags,

      comment:
        typeof comment === "string"
          ? comment.trim().substring(0, 500)
          : "",

      images: normalizedImages,

      isVerifiedPurchase: true,

      isAnonymous:
        Boolean(isAnonymous),
    });

    await review.populate(
      "userId",
      "fullName avatar",
    );

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: review,
    });
  },
);


// ==========================================
// GET ALL REVIEWS
// GET /api/reviews
// ==========================================

export const getAllReviews = tryCatchFn(
  async (req, res) => {
    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1,
    );

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit, 10) || 10,
        1,
      ),
      100,
    );

    const skip = (page - 1) * limit;

    // ========================================
    // RATING STATISTICS
    // ========================================

    const statsAggregation =
      await Review.aggregate([
        {
          $group: {
            _id: null,

            totalReviews: {
              $sum: 1,
            },

            averageRating: {
              $avg: "$rating",
            },

            star5: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$rating", 5],
                  },
                  1,
                  0,
                ],
              },
            },

            star4: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$rating", 4],
                  },
                  1,
                  0,
                ],
              },
            },

            star3: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$rating", 3],
                  },
                  1,
                  0,
                ],
              },
            },

            star2: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$rating", 2],
                  },
                  1,
                  0,
                ],
              },
            },

            star1: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$rating", 1],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

    const stats =
      statsAggregation[0] || {
        totalReviews: 0,
        averageRating: 0,
        star5: 0,
        star4: 0,
        star3: 0,
        star2: 0,
        star1: 0,
      };

    const totalReviews =
      stats.totalReviews || 0;

    const totalForBreakdown =
      totalReviews || 1;

    const summary = {
      averageRating:
        totalReviews > 0
          ? Number(
              stats.averageRating.toFixed(1),
            )
          : 0,

      totalReviews,

      totalFormatted:
        totalReviews >= 1000
          ? `${(
              totalReviews / 1000
            ).toFixed(1)}k+`
          : `${totalReviews}`,

      breakdown: {
        5: Math.round(
          (stats.star5 /
            totalForBreakdown) *
            100,
        ),

        4: Math.round(
          (stats.star4 /
            totalForBreakdown) *
            100,
        ),

        3: Math.round(
          (stats.star3 /
            totalForBreakdown) *
            100,
        ),

        2: Math.round(
          (stats.star2 /
            totalForBreakdown) *
            100,
        ),

        1: Math.round(
          (stats.star1 /
            totalForBreakdown) *
            100,
        ),
      },
    };

    // ========================================
    // GET REVIEWS
    // ========================================

    const reviews = await Review.find()
      .populate(
        "userId",
        "fullName avatar",
      )
      .populate(
        "comments.userId",
        "fullName avatar",
      )
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean();

    const currentUserId =
      req.user?._id
        ? req.user._id.toString()
        : null;

    // ========================================
    // FORMAT REVIEWS
    // ========================================

    const formattedReviews =
      reviews.map((review) => ({
        id: review._id,

        user: review.isAnonymous
          ? {
              fullName: "Anonymous User",
              avatar: "",
            }
          : {
              fullName:
                review.userId?.fullName ||
                "User",

              avatar:
                review.userId?.avatar ||
                "",
            },

        isVerified:
          review.isVerifiedPurchase,

        createdAt:
          review.createdAt,

        rating:
          review.rating,

        comment:
          review.comment,

        tags:
          review.tags || [],

        images:
          review.images || [],

        ownerReply:
          review.ownerReply?.text
            ? {
                text:
                  review.ownerReply.text,

                repliedAt:
                  review.ownerReply
                    .repliedAt,
              }
            : null,

        reactions: {
          likeCount:
            review.likes?.length || 0,

          loveCount:
            review.loves?.length || 0,

          hasLiked:
            currentUserId
              ? review.likes?.some(
                  (id) =>
                    id.toString() ===
                    currentUserId,
                )
              : false,

          hasLoved:
            currentUserId
              ? review.loves?.some(
                  (id) =>
                    id.toString() ===
                    currentUserId,
                )
              : false,
        },

        commentCount:
          review.comments?.length || 0,

        comments:
          review.comments || [],
      }));

    return res.status(200).json({
      success: true,
      summary,

      pagination: {
        page,
        limit,
        totalReviews,
        totalPages:
          Math.ceil(
            totalReviews / limit,
          ),
      },

      data: formattedReviews,
    });
  },
);


// ==========================================
// ADD COMMENT
// POST /api/reviews/:id/comments
// ==========================================

export const addCommentToReview =
  tryCatchFn(async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;

    // Authentication
    if (!req.user?._id) {
      throw responseHandler.unauthorizedResponse(
        "Authentication required",
      );
    }

    // Validate ID
    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      throw responseHandler.badRequestResponse(
        "Invalid review ID",
      );
    }

    // Validate comment
    if (
      !text ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      throw responseHandler.badRequestResponse(
        "Comment text is required",
      );
    }

    // Find review
    const review =
      await Review.findById(id);

    if (!review) {
      throw responseHandler.notFoundResponse(
        "Review not found",
      );
    }

    // Add comment
    review.comments.push({
      userId: req.user._id,
      text: text.trim().substring(0, 500),
    });

    await review.save();

    const savedComment =
      review.comments[
        review.comments.length - 1
      ];

    await Review.populate(
      savedComment,
      {
        path: "userId",
        select: "fullName avatar",
      },
    );

    return res.status(201).json({
      success: true,
      message:
        "Comment added successfully",

      commentsCount:
        review.comments.length,

      data: savedComment,
    });
  });


// ==========================================
// TOGGLE REACTION
// POST /api/reviews/:id/react
// ==========================================

export const toggleReaction =
  tryCatchFn(async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;

    // Authentication
    if (!req.user?._id) {
      throw responseHandler.unauthorizedResponse(
        "Authentication required",
      );
    }

    // Validate ID
    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      throw responseHandler.badRequestResponse(
        "Invalid review ID",
      );
    }

    // Validate reaction
    if (
      !["like", "love"].includes(type)
    ) {
      throw responseHandler.badRequestResponse(
        "Invalid reaction type. Use 'like' or 'love'",
      );
    }

    // Find review
    const review =
      await Review.findById(id);

    if (!review) {
      throw responseHandler.notFoundResponse(
        "Review not found",
      );
    }

    const userId = req.user._id;

    const targetArray =
      type === "like"
        ? "likes"
        : "loves";

    const hasReacted =
      review[targetArray].some(
        (id) =>
          id.toString() ===
          userId.toString(),
      );

    if (hasReacted) {
      review[targetArray] =
        review[targetArray].filter(
          (id) =>
            id.toString() !==
            userId.toString(),
        );
    } else {
      review[targetArray].push(
        userId,
      );
    }

    await review.save();

    return res.status(200).json({
      success: true,

      message: hasReacted
        ? "Reaction removed"
        : "Reaction added",

      data: {
        likeCount:
          review.likes.length,

        loveCount:
          review.loves.length,

        hasLiked:
          review.likes.some(
            (id) =>
              id.toString() ===
              userId.toString(),
          ),

        hasLoved:
          review.loves.some(
            (id) =>
              id.toString() ===
              userId.toString(),
          ),
      },
    });
  });


// ==========================================
// DEFAULT EXPORT
// ==========================================

const reviewController = {
  getOrderSummaryForReview,
  submitReview,
  getAllReviews,
  addCommentToReview,
  toggleReaction,
};

export default reviewController;
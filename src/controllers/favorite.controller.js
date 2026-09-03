import Favorite from "../models/Favorite.js";
import Product from "../models/product.js";

import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";


// =====================================================
// ADD TO FAVORITES
// =====================================================

export const addFavorite = tryCatchFn(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;

  if (!productId) {
    throw responseHandler.errorResponse(
      "Product ID is required",
      400
    );
  }

  // Check product exists
  const product = await Product.findById(productId);

  if (!product) {
    throw responseHandler.notFoundResponse(
      "Product not found"
    );
  }

  // Check if already favorited
  const existingFavorite = await Favorite.findOne({
    user: userId,
    product: productId,
  });

  if (existingFavorite) {
    return responseHandler.successResponse(
      res,
      {
        favorite: true,
        productId,
      },
      "Product is already in your favorites"
    );
  }

  const favorite = await Favorite.create({
    user: userId,
    product: productId,
  });

  return responseHandler.successResponse(
    res,
    {
      favorite: true,
      productId,
      favoriteId: favorite._id,
    },
    "Product added to favorites",
    201
  );
});


// =====================================================
// REMOVE FROM FAVORITES
// =====================================================

export const removeFavorite = tryCatchFn(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  if (!productId) {
    throw responseHandler.errorResponse(
      "Product ID is required",
      400
    );
  }

  const favorite = await Favorite.findOneAndDelete({
    user: userId,
    product: productId,
  });

  if (!favorite) {
    throw responseHandler.notFoundResponse(
      "Product is not in your favorites"
    );
  }

  return responseHandler.successResponse(
    res,
    {
      favorite: false,
      productId,
    },
    "Product removed from favorites"
  );
});


// =====================================================
// TOGGLE FAVORITE
// =====================================================

export const toggleFavorite = tryCatchFn(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.body;

  if (!productId) {
    throw responseHandler.errorResponse(
      "Product ID is required",
      400
    );
  }

  // Check product exists
  const product = await Product.findById(productId);

  if (!product) {
    throw responseHandler.notFoundResponse(
      "Product not found"
    );
  }

  // Check current favorite
  const existingFavorite = await Favorite.findOne({
    user: userId,
    product: productId,
  });

  // If already favorite -> remove it
  if (existingFavorite) {
    await Favorite.deleteOne({
      _id: existingFavorite._id,
    });

    return responseHandler.successResponse(
      res,
      {
        favorite: false,
        productId,
      },
      "Product removed from favorites"
    );
  }

  // Otherwise -> add it
  const favorite = await Favorite.create({
    user: userId,
    product: productId,
  });

  return responseHandler.successResponse(
    res,
    {
      favorite: true,
      productId,
      favoriteId: favorite._id,
    },
    "Product added to favorites",
    201
  );
});


// =====================================================
// GET MY FAVORITES
// =====================================================

export const getMyFavorites = tryCatchFn(async (req, res) => {
  const userId = req.user._id;

  const favorites = await Favorite.find({
    user: userId,
  })
    .populate({
      path: "product",
      select:
        "name image description price category subcategory rating preparationTime calories available featured",
    })
    .sort({ createdAt: -1 });

  return responseHandler.successResponse(
    res,
    {
      favorites,
      count: favorites.length,
    },
    "Favorites retrieved successfully"
  );
});


// =====================================================
// CHECK IF PRODUCT IS FAVORITE
// =====================================================

export const checkFavorite = tryCatchFn(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  const favorite = await Favorite.findOne({
    user: userId,
    product: productId,
  });

  return responseHandler.successResponse(
    res,
    {
      favorite: !!favorite,
      productId,
    },
    "Favorite status retrieved"
  );
});
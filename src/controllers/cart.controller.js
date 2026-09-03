import Cart from "../models/cart.js";
import Product from "../models/product.js";

import responseHandler from "../libs/responseHandler.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// =====================================================
// GET MY CART
// =====================================================

export const getCart = tryCatchFn(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    select:
      "name image description price category subcategory rating preparationTime calories available",
  });

  if (!cart) {
    return responseHandler.successResponse(
      res,
      {
        items: [],
        totalItems: 0,
        subtotal: 0,
      },
      "Cart retrieved successfully",
    );
  }

  const totalItems = cart.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const subtotal = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  return responseHandler.successResponse(
    res,
    {
      id: cart._id,
      items: cart.items,
      totalItems,
      subtotal,
    },
    "Cart retrieved successfully",
  );
});

// =====================================================
// ADD TO CART
// =====================================================

export const addToCart = tryCatchFn(async (req, res) => {
  const userId = req.user._id;

  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    throw responseHandler.errorResponse("Product ID is required", 400);
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw responseHandler.errorResponse("Quantity must be at least 1", 400);
  }

  // Find product
  const product = await Product.findById(productId);

  if (!product) {
    throw responseHandler.notFoundResponse("Product not found");
  }

  // Check availability
  if (product.available === false) {
    throw responseHandler.errorResponse(
      "This product is currently unavailable",
      400,
    );
  }

  // Find existing cart
  let cart = await Cart.findOne({ user: userId });

  // Create cart if user doesn't have one
  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [
        {
          product: product._id,
          quantity,
          price: product.price,
        },
      ],
    });
  } else {
    // Check if product already exists
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId.toString(),
    );

    if (existingItem) {
      existingItem.quantity += quantity;

      // Update price from current product price
      existingItem.price = product.price;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
        price: product.price,
      });
    }

    await cart.save();
  }

  await cart.populate({
    path: "items.product",
    select:
      "name image description price category subcategory rating preparationTime calories available",
  });

  const totalItems = cart.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const subtotal = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  return responseHandler.successResponse(
    res,
    {
      id: cart._id,
      items: cart.items,
      totalItems,
      subtotal,
    },
    "Product added to cart",
    200,
  );
});

// =====================================================
// INCREASE QUANTITY
// =====================================================

export const increaseQuantity = tryCatchFn(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  if (!productId) {
    throw responseHandler.errorResponse("Product ID is required", 400);
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw responseHandler.notFoundResponse("Cart not found");
  }

  const item = cart.items.find(
    (item) => item.product.toString() === productId.toString(),
  );

  if (!item) {
    throw responseHandler.notFoundResponse("Product is not in your cart");
  }

  // Make sure product still exists
  const product = await Product.findById(productId);

  if (!product) {
    throw responseHandler.notFoundResponse("Product not found");
  }

  if (product.available === false) {
    throw responseHandler.errorResponse(
      "This product is currently unavailable",
      400,
    );
  }

  item.quantity += 1;

  // Keep current product price
  item.price = product.price;

  await cart.save();

  await cart.populate({
    path: "items.product",
    select:
      "name image description price category subcategory rating preparationTime calories available",
  });

  const totalItems = cart.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const subtotal = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  return responseHandler.successResponse(
    res,
    {
      id: cart._id,
      items: cart.items,
      totalItems,
      subtotal,
    },
    "Quantity increased",
  );
});

// =====================================================
// DECREASE QUANTITY
// =====================================================

export const decreaseQuantity = tryCatchFn(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  if (!productId) {
    throw responseHandler.errorResponse("Product ID is required", 400);
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw responseHandler.notFoundResponse("Cart not found");
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId.toString(),
  );

  if (itemIndex === -1) {
    throw responseHandler.notFoundResponse("Product is not in your cart");
  }

  const item = cart.items[itemIndex];

  if (item.quantity > 1) {
    item.quantity -= 1;
  } else {
    // Remove product when quantity reaches 0
    cart.items.splice(itemIndex, 1);
  }

  await cart.save();

  await cart.populate({
    path: "items.product",
    select:
      "name image description price category subcategory rating preparationTime calories available",
  });

  const totalItems = cart.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const subtotal = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  return responseHandler.successResponse(
    res,
    {
      id: cart._id,
      items: cart.items,
      totalItems,
      subtotal,
    },
    "Quantity decreased",
  );
});

// =====================================================
// REMOVE ITEM FROM CART
// =====================================================

export const removeFromCart = tryCatchFn(async (req, res) => {
  const userId = req.user._id;
  const { productId } = req.params;

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw responseHandler.notFoundResponse("Cart not found");
  }

  const initialLength = cart.items.length;

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId.toString(),
  );

  if (cart.items.length === initialLength) {
    throw responseHandler.notFoundResponse("Product is not in your cart");
  }

  await cart.save();

  return responseHandler.successResponse(
    res,
    cart,
    "Product removed from cart",
  );
});

// =====================================================
// CLEAR CART
// =====================================================

export const clearCart = tryCatchFn(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    return responseHandler.successResponse(
      res,
      {
        items: [],
        totalItems: 0,
        subtotal: 0,
      },
      "Cart is already empty",
    );
  }

  cart.items = [];

  await cart.save();

  return responseHandler.successResponse(
    res,
    {
      items: [],
      totalItems: 0,
      subtotal: 0,
    },
    "Cart cleared successfully",
  );
});

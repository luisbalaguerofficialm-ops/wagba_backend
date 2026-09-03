import express from "express";
import {
  createAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
} from "../controllers/address.controller.js";
import { protect } from "../middlewares/authMiddleware.js"; // adjust to your actual export

const router = express.Router();

router.use(protect); // every address route requires a logged-in user

router.post("/", createAddress);
router.get("/", getAddresses);
router.get("/:id", getAddressById);
router.patch("/:id", updateAddress);
router.delete("/:id", deleteAddress);

export default router;

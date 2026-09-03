import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },

    label: {
      type: String,
      required: [true, "Address label is required"],
      enum: ["Home", "Work", "Other"],
      default: "Home",
    },

    street: {
      type: String,
      required: [true, "Street address is required"],
      trim: true,
      maxlength: [200, "Street address cannot exceed 200 characters"],
    },

    apartment: {
      type: String,
      trim: true,
      maxlength: [100, "Apartment/Suite cannot exceed 100 characters"],
      default: "",
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: [300, "Delivery instructions cannot exceed 300 characters"],
      default: "",
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

addressSchema.index({ user: 1, isDefault: 1 });
addressSchema.index({ location: "2dsphere" });

const Address =
  mongoose.models.Address || mongoose.model("Address", addressSchema);

export default Address;

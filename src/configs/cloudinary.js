import { v2 as cloudinary } from "cloudinary";

// Safety check: This will print in your terminal when the server starts
if (!process.env.CLOUDINARY_API_KEY) {
  console.error("❌ CLOUDINARY ERROR: API Key is missing from process.env!");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

import multer from "multer";

// ==========================================================
// MULTER STORAGE
// ==========================================================

const storage = multer.memoryStorage();

// ==========================================================
// FILE FILTER
// ==========================================================

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  const error = new Error("Only JPG, JPEG, PNG and WEBP images are allowed.");

  error.statusCode = 400;

  return cb(error, false);
};

// ==========================================================
// MULTER UPLOAD
// ==========================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// ==========================================================
// DEFAULT EXPORT
// ==========================================================

export default upload;




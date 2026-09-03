export const compressionOptions = {
  // Level of compression (0-9, where 9 is maximum compression)
  level: 9, // High compression level for text-based responses

  // Filter function to decide which responses to compress
  filter: (req, res) => {
    // Don't compress responses with this header
    if (req.headers["x-no-compression"]) {
      return false;
    }

    // Only compress responses with these content types
    const type = res.getHeader("Content-Type");
    const shouldCompress = ![
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/octet-stream",
      "application/pdf",
      "application/zip",
      "application/x-gzip",
    ].some((t) => type?.startsWith(t));

    return shouldCompress;
  },

  // Chunk size for compression (default: 16KB)
  chunkSize: 16384,

  // Threshold (in bytes) for response body size before compression is considered
  // Responses smaller than this will not be compressed
  threshold: 1024, // 1KB
};

export const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Be more restrictive in production
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests:
        process.env.NODE_ENV === "development" ? [] : null,
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: process.env.NODE_ENV === "production",
  },
  frameguard: {
    action: "deny",
  },
  xssFilter: true,
  noSniff: true,
  dnsPrefetchControl: {
    allow: false,
  },
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-site" },
  hidePoweredBy: true,
  ieNoOpen: true,
};

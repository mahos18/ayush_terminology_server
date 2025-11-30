// middlewares/authMiddleware.js

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Missing Authorization header",
    });
  }

  // Expected format: "Bearer xyz123"
  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      message: "Invalid Authorization header format. Use 'Bearer <token>'",
    });
  }

  const token = parts[1];

  if (!token || token.trim() === "") {
    return res.status(401).json({
      success: false,
      message: "Token missing in Authorization header",
    });
  }

  // Optional: You can verify token if needed
  req.token = token;

  next(); // allow access to the actual API
}

module.exports = authMiddleware;

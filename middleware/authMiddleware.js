const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

module.exports = (req, res, next) => {

    const authHeader = req.headers.authorization;

    // --------------------------------------------------
    // Check Authorization header
    // --------------------------------------------------

    if (!authHeader) {
        return next(
            new AppError(
                "Authorization token is required.",
                401,
                "AUTH_TOKEN_REQUIRED"
            )
        );
    }

    // Expected:
    // Authorization: Bearer YOUR_ACCESS_TOKEN

    const parts = authHeader.trim().split(/\s+/);

    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer" ||
        !parts[1]
    ) {
        return next(
            new AppError(
                "Invalid authorization format. Use Bearer token.",
                401,
                "INVALID_AUTH_FORMAT"
            )
        );
    }

    const token = parts[1];

    try {

        // --------------------------------------------------
        // Verify JWT
        // --------------------------------------------------

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // --------------------------------------------------
        // Make sure this is a normal user token
        // --------------------------------------------------

        if (decoded.type !== "user") {
            return next(
                new AppError(
                    "User token required.",
                    403,
                    "USER_TOKEN_REQUIRED"
                )
            );
        }

        // --------------------------------------------------
        // Store user information
        // --------------------------------------------------

        req.user = decoded;

        // Controller can now use:
        // req.user.user_id
        // req.user.email
        // req.user.type

        next();

    } catch (error) {

        return next(
            new AppError(
                "Invalid or expired access token.",
                401,
                "INVALID_OR_EXPIRED_TOKEN"
            )
        );
    }
};
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

// ======================================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ======================================================

module.exports = (req, res, next) => {

    const authHeader = req.headers.authorization;

    // --------------------------------------------------
    // Check Authorization header
    // --------------------------------------------------

    if (!authHeader) {
        return next(
            new AppError(
                "Admin authorization token is required.",
                401,
                "ADMIN_TOKEN_REQUIRED"
            )
        );
    }

    // Expected:
    // Authorization: Bearer ADMIN_ACCESS_TOKEN

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
                "INVALID_ADMIN_AUTH_FORMAT"
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
        // Make sure this is an admin token
        // --------------------------------------------------

        if (decoded.type !== "admin") {
            return next(
                new AppError(
                    "Admin token required.",
                    403,
                    "ADMIN_TOKEN_REQUIRED"
                )
            );
        }

        // --------------------------------------------------
        // Store admin information
        // --------------------------------------------------

        req.admin = decoded;

        // Controller can now use:
        // req.admin.admin_id
        // req.admin.email
        // req.admin.type

        next();

    } catch (error) {

        return next(
            new AppError(
                "Invalid or expired admin token.",
                401,
                "INVALID_OR_EXPIRED_ADMIN_TOKEN"
            )
        );
    }
};
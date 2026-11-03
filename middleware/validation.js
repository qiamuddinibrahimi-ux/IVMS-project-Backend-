const AppError = require("../utils/AppError");


// ==========================================
// Required Fields
// ==========================================

const requireFields = (fields) => {

    return (req, res, next) => {

        const missingFields = [];

        for (const field of fields) {

            const value = req.body[field];

            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                missingFields.push(field);
            }

        }

        if (missingFields.length > 0) {

            return next(
                new AppError(
                    `Missing required fields: ${missingFields.join(", ")}`,
                    400,
                    "MISSING_FIELDS"
                )
            );

        }

        next();
    };
};


// ==========================================
// Email Validation
// ==========================================

const validateEmail = (req, res, next) => {

    const { email } = req.body;

    if (!email) {
        return next(
            new AppError(
                "Email is required.",
                400,
                "EMAIL_REQUIRED"
            )
        );
    }


    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailRegex.test(email)) {

        return next(
            new AppError(
                "Please provide a valid email address.",
                400,
                "INVALID_EMAIL"
            )
        );

    }

    next();
};


// ==========================================
// Password Validation
// ==========================================

const validatePassword = (req, res, next) => {

    const { password } = req.body;

    if (!password) {

        return next(
            new AppError(
                "Password is required.",
                400,
                "PASSWORD_REQUIRED"
            )
        );

    }


    if (password.length < 8) {

        return next(
            new AppError(
                "Password must contain at least 8 characters.",
                400,
                "WEAK_PASSWORD"
            )
        );

    }

    next();
};


// ==========================================
// Positive Number Validation
// ==========================================

const validatePositiveNumber = (field) => {

    return (req, res, next) => {

        const value = Number(req.body[field]);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            return next(
                new AppError(
                    `${field} must be greater than zero.`,
                    400,
                    "INVALID_NUMBER"
                )
            );

        }

        next();
    };
};


// ==========================================
// Positive Integer / ID Validation
// ==========================================

const validateId = (field) => {

    return (req, res, next) => {

        const value = Number(req.params[field]);

        if (
            !Number.isInteger(value) ||
            value <= 0
        ) {

            return next(
                new AppError(
                    `${field} must be a valid ID.`,
                    400,
                    "INVALID_ID"
                )
            );

        }

        next();
    };
};


module.exports = {
    requireFields,
    validateEmail,
    validatePassword,
    validatePositiveNumber,
    validateId
};
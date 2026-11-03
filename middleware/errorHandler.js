const AppError = require("../utils/AppError");

const errorHandler = (err, req, res, next) => {

    console.error("=================================");
    console.error("ERROR");
    console.error("=================================");
    console.error(err);


    // ==========================================
    // AppError
    // ==========================================

    if (err instanceof AppError) {

        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code
        });

    }


    // ==========================================
    // MySQL Duplicate Entry
    // ==========================================

    if (err.code === "ER_DUP_ENTRY") {

        return res.status(409).json({
            success: false,
            message: "A record with the same unique value already exists.",
            code: "DUPLICATE_ENTRY"
        });

    }


    // ==========================================
    // MySQL Foreign Key Error
    // ==========================================

    if (
        err.code === "ER_NO_REFERENCED_ROW_2" ||
        err.code === "ER_ROW_IS_REFERENCED_2"
    ) {

        return res.status(400).json({
            success: false,
            message: "This operation violates a database relationship.",
            code: "FOREIGN_KEY_ERROR"
        });

    }


    // ==========================================
    // Validation Error
    // ==========================================

    if (err.name === "ValidationError") {

        return res.status(400).json({
            success: false,
            message: err.message,
            code: "VALIDATION_ERROR"
        });

    }


    // ==========================================
    // Unknown Error
    // ==========================================

    return res.status(500).json({
        success: false,
        message: "Internal server error.",
        code: "INTERNAL_ERROR"
    });

};

module.exports = errorHandler;
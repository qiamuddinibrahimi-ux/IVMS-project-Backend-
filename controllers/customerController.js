
const db = require("../config/database.js");

const AppError = require("../utils/AppError");

// ======================================================
// CREATE CUSTOMER
// POST /api/customers
// ======================================================

exports.createCustomer = async (req, res) => {
    const userId = req.user.user_id;

    const {
        customer_name,
        phone,
        email,
        address
    } = req.body;

    // Validate customer name
    if (
        !customer_name ||
        typeof customer_name !== "string" ||
        customer_name.trim() === ""
    ) {
        throw new AppError(
            "Customer name is required.",
            400,
            "CUSTOMER_NAME_REQUIRED"
        );
    }

    const name = customer_name.trim();

    if (name.length < 2) {
        throw new AppError(
            "Customer name must contain at least 2 characters.",
            400,
            "INVALID_CUSTOMER_NAME"
        );
    }

    // Optional email validation
    if (email !== undefined && email !== null && email !== "") {
        if (typeof email !== "string") {
            throw new AppError(
                "Email must be a valid string.",
                400,
                "INVALID_EMAIL"
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email.trim())) {
            throw new AppError(
                "Please provide a valid email address.",
                400,
                "INVALID_EMAIL"
            );
        }
    }

    const [result] = await db.query(
        `
        INSERT INTO customers
        (
            user_id,
            customer_name,
            phone,
            email,
            address
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            userId,
            name,
            phone || null,
            email ? email.trim().toLowerCase() : null,
            address || null
        ]
    );

    return res.status(201).json({
        success: true,
        message: "Customer created successfully.",
        customer_id: result.insertId
    });
};

// ======================================================
// GET ALL CUSTOMERS
// GET /api/customers
// ======================================================

exports.getCustomers = async (req, res) => {
    const userId = req.user.user_id;

    const [customers] = await db.query(
        `
        SELECT
            customer_id,
            customer_name,
            phone,
            email,
            address
        FROM customers
        WHERE user_id = ?
        ORDER BY customer_id DESC
        `,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: customers.length,
        data: customers
    });
};

// ======================================================
// GET CUSTOMER BY ID
// GET /api/customers/:id
// ======================================================

exports.getCustomerById = async (req, res) => {
    const userId = req.user.user_id;
    const customerId = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(customerId) || customerId <= 0) {
        throw new AppError(
            "Customer ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_ID"
        );
    }

    const [customers] = await db.query(
        `
        SELECT
            customer_id,
            customer_name,
            phone,
            email,
            address
        FROM customers
        WHERE customer_id = ?
        AND user_id = ?
        `,
        [customerId, userId]
    );

    if (customers.length === 0) {
        throw new AppError(
            "Customer not found.",
            404,
            "CUSTOMER_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        data: customers[0]
    });
};

// ======================================================
// UPDATE CUSTOMER
// PUT /api/customers/:id
// ======================================================

exports.updateCustomer = async (req, res) => {
    const userId = req.user.user_id;
    const customerId = Number(req.params.id);

    const {
        customer_name,
        phone,
        email,
        address
    } = req.body;

    // Validate ID
    if (!Number.isInteger(customerId) || customerId <= 0) {
        throw new AppError(
            "Customer ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_ID"
        );
    }

    // Validate customer name
    if (
        !customer_name ||
        typeof customer_name !== "string" ||
        customer_name.trim() === ""
    ) {
        throw new AppError(
            "Customer name is required.",
            400,
            "CUSTOMER_NAME_REQUIRED"
        );
    }

    const name = customer_name.trim();

    if (name.length < 2) {
        throw new AppError(
            "Customer name must contain at least 2 characters.",
            400,
            "INVALID_CUSTOMER_NAME"
        );
    }

    // Optional email validation
    if (email !== undefined && email !== null && email !== "") {
        if (typeof email !== "string") {
            throw new AppError(
                "Email must be a valid string.",
                400,
                "INVALID_EMAIL"
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email.trim())) {
            throw new AppError(
                "Please provide a valid email address.",
                400,
                "INVALID_EMAIL"
            );
        }
    }

    // Check ownership
    const [existingCustomer] = await db.query(
        `
        SELECT customer_id
        FROM customers
        WHERE customer_id = ?
        AND user_id = ?
        `,
        [customerId, userId]
    );

    if (existingCustomer.length === 0) {
        throw new AppError(
            "Customer not found.",
            404,
            "CUSTOMER_NOT_FOUND"
        );
    }

    await db.query(
        `
        UPDATE customers
        SET
            customer_name = ?,
            phone = ?,
            email = ?,
            address = ?
        WHERE customer_id = ?
        AND user_id = ?
        `,
        [
            name,
            phone || null,
            email ? email.trim().toLowerCase() : null,
            address || null,
            customerId,
            userId
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Customer updated successfully."
    });
};

// ======================================================
// DELETE CUSTOMER
// DELETE /api/customers/:id
// ======================================================

exports.deleteCustomer = async (req, res) => {
    const userId = req.user.user_id;
    const customerId = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(customerId) || customerId <= 0) {
        throw new AppError(
            "Customer ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_ID"
        );
    }

    try {
        const [result] = await db.query(
            `
            DELETE FROM customers
            WHERE customer_id = ?
            AND user_id = ?
            `,
            [customerId, userId]
        );

        if (result.affectedRows === 0) {
            throw new AppError(
                "Customer not found.",
                404,
                "CUSTOMER_NOT_FOUND"
            );
        }

        return res.status(200).json({
            success: true,
            message: "Customer deleted successfully."
        });
    } catch (error) {
        // Pass AppError to global error handler
        if (error instanceof AppError) {
            throw error;
        }

        // Customer may be referenced by another table
        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            throw new AppError(
                "Customer cannot be deleted because it is being used by another record.",
                409,
                "CUSTOMER_IN_USE"
            );
        }

        throw error;
    }
};

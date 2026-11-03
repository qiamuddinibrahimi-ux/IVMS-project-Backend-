
const db = require("../config/database.js");

const AppError = require("../utils/AppError");

// ======================================================
// CREATE VENDOR
// POST /api/vendors
// ======================================================

exports.createVendor = async (req, res) => {
    const userId = req.user.user_id;

    const {
        vendor_name,
        phone,
        email,
        address
    } = req.body;

    // --------------------------------------------------
    // Validate vendor name
    // --------------------------------------------------

    if (
        vendor_name === undefined ||
        vendor_name === null ||
        String(vendor_name).trim() === ""
    ) {
        throw new AppError(
            "Vendor name is required.",
            400,
            "VENDOR_NAME_REQUIRED"
        );
    }

    const vendorName = String(vendor_name).trim();

    if (vendorName.length < 2) {
        throw new AppError(
            "Vendor name must contain at least 2 characters.",
            400,
            "INVALID_VENDOR_NAME"
        );
    }

    // --------------------------------------------------
    // Validate optional email
    // --------------------------------------------------

    let normalizedEmail = null;

    if (
        email !== undefined &&
        email !== null &&
        String(email).trim() !== ""
    ) {
        normalizedEmail = String(email).trim().toLowerCase();

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            throw new AppError(
                "Please provide a valid vendor email address.",
                400,
                "INVALID_VENDOR_EMAIL"
            );
        }
    }

    // --------------------------------------------------
    // Insert vendor
    // --------------------------------------------------

    const [result] = await db.query(
        `
        INSERT INTO vendors
        (
            user_id,
            vendor_name,
            phone,
            email,
            address
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            userId,
            vendorName,
            phone || null,
            normalizedEmail,
            address || null
        ]
    );

    // --------------------------------------------------
    // Retrieve created vendor
    // --------------------------------------------------

    const [vendors] = await db.query(
        `
        SELECT
            vendor_id,
            vendor_name,
            phone,
            email,
            address
        FROM vendors
        WHERE vendor_id = ?
        AND user_id = ?
        `,
        [result.insertId, userId]
    );

    if (vendors.length === 0) {
        throw new AppError(
            "Vendor was created but could not be retrieved.",
            500,
            "VENDOR_RETRIEVAL_FAILED"
        );
    }

    return res.status(201).json({
        success: true,
        message: "Vendor created successfully.",
        data: vendors[0]
    });
};

// ======================================================
// GET ALL VENDORS
// GET /api/vendors
// ======================================================

exports.getVendors = async (req, res) => {
    const userId = req.user.user_id;

    const [vendors] = await db.query(
        `
        SELECT
            vendor_id,
            vendor_name,
            phone,
            email,
            address
        FROM vendors
        WHERE user_id = ?
        ORDER BY vendor_id DESC
        `,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: vendors.length,
        data: vendors
    });
};

// ======================================================
// GET VENDOR BY ID
// GET /api/vendors/:id
// ======================================================

exports.getVendorById = async (req, res) => {
    const userId = req.user.user_id;

    const vendorId = Number(req.params.id);

    // --------------------------------------------------
    // Validate vendor ID
    // --------------------------------------------------

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        throw new AppError(
            "Vendor ID must be a valid positive integer.",
            400,
            "INVALID_VENDOR_ID"
        );
    }

    const [vendors] = await db.query(
        `
        SELECT
            vendor_id,
            vendor_name,
            phone,
            email,
            address
        FROM vendors
        WHERE vendor_id = ?
        AND user_id = ?
        `,
        [vendorId, userId]
    );

    if (vendors.length === 0) {
        throw new AppError(
            "Vendor not found.",
            404,
            "VENDOR_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        data: vendors[0]
    });
};

// ======================================================
// UPDATE VENDOR
// PUT /api/vendors/:id
// ======================================================

exports.updateVendor = async (req, res) => {
    const userId = req.user.user_id;

    const vendorId = Number(req.params.id);

    const {
        vendor_name,
        phone,
        email,
        address
    } = req.body;

    // --------------------------------------------------
    // Validate vendor ID
    // --------------------------------------------------

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        throw new AppError(
            "Vendor ID must be a valid positive integer.",
            400,
            "INVALID_VENDOR_ID"
        );
    }

    // --------------------------------------------------
    // Validate vendor name
    // --------------------------------------------------

    if (
        vendor_name === undefined ||
        vendor_name === null ||
        String(vendor_name).trim() === ""
    ) {
        throw new AppError(
            "Vendor name is required.",
            400,
            "VENDOR_NAME_REQUIRED"
        );
    }

    const vendorName = String(vendor_name).trim();

    if (vendorName.length < 2) {
        throw new AppError(
            "Vendor name must contain at least 2 characters.",
            400,
            "INVALID_VENDOR_NAME"
        );
    }

    // --------------------------------------------------
    // Validate optional email
    // --------------------------------------------------

    let normalizedEmail = null;

    if (
        email !== undefined &&
        email !== null &&
        String(email).trim() !== ""
    ) {
        normalizedEmail = String(email).trim().toLowerCase();

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            throw new AppError(
                "Please provide a valid vendor email address.",
                400,
                "INVALID_VENDOR_EMAIL"
            );
        }
    }

    // --------------------------------------------------
    // Check ownership
    // --------------------------------------------------

    const [existingVendor] = await db.query(
        `
        SELECT vendor_id
        FROM vendors
        WHERE vendor_id = ?
        AND user_id = ?
        `,
        [vendorId, userId]
    );

    if (existingVendor.length === 0) {
        throw new AppError(
            "Vendor not found.",
            404,
            "VENDOR_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Update vendor
    // --------------------------------------------------

    const [result] = await db.query(
        `
        UPDATE vendors
        SET
            vendor_name = ?,
            phone = ?,
            email = ?,
            address = ?
        WHERE vendor_id = ?
        AND user_id = ?
        `,
        [
            vendorName,
            phone || null,
            normalizedEmail,
            address || null,
            vendorId,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Vendor was not updated.",
            404,
            "VENDOR_NOT_UPDATED"
        );
    }

    // --------------------------------------------------
    // Get updated vendor
    // --------------------------------------------------

    const [vendors] = await db.query(
        `
        SELECT
            vendor_id,
            vendor_name,
            phone,
            email,
            address
        FROM vendors
        WHERE vendor_id = ?
        AND user_id = ?
        `,
        [vendorId, userId]
    );

    if (vendors.length === 0) {
        throw new AppError(
            "Updated vendor could not be retrieved.",
            500,
            "VENDOR_RETRIEVAL_FAILED"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Vendor updated successfully.",
        data: vendors[0]
    });
};

// ======================================================
// DELETE VENDOR
// DELETE /api/vendors/:id
// ======================================================

exports.deleteVendor = async (req, res) => {
    const userId = req.user.user_id;

    const vendorId = Number(req.params.id);

    // --------------------------------------------------
    // Validate vendor ID
    // --------------------------------------------------

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        throw new AppError(
            "Vendor ID must be a valid positive integer.",
            400,
            "INVALID_VENDOR_ID"
        );
    }

    try {
        const [result] = await db.query(
            `
            DELETE FROM vendors
            WHERE vendor_id = ?
            AND user_id = ?
            `,
            [vendorId, userId]
        );

        if (result.affectedRows === 0) {
            throw new AppError(
                "Vendor not found.",
                404,
                "VENDOR_NOT_FOUND"
            );
        }

        return res.status(200).json({
            success: true,
            message: "Vendor deleted successfully."
        });

    } catch (error) {

        // Preserve AppError
        if (error instanceof AppError) {
            throw error;
        }

        // Vendor may be referenced by purchases/payments
        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            throw new AppError(
                "Vendor cannot be deleted because it is being used by another record.",
                409,
                "VENDOR_IN_USE"
            );
        }

        throw error;
    }
};


const db = require("../config/database.js");
const AppError = require("../utils/AppError");


// ======================================================
// CREATE CURRENCY
// POST /api/currencies
// ======================================================

exports.createCurrency = async (req, res) => {

    const userId = req.user.user_id;

    const {
        currency_name,
        currency_code,
        symbol
    } = req.body;

    // Validate currency name
    if (
        !currency_name ||
        typeof currency_name !== "string" ||
        currency_name.trim() === ""
    ) {
        throw new AppError(
            "Currency name is required.",
            400,
            "CURRENCY_NAME_REQUIRED"
        );
    }

    // Validate currency code
    if (
        !currency_code ||
        typeof currency_code !== "string" ||
        currency_code.trim() === ""
    ) {
        throw new AppError(
            "Currency code is required.",
            400,
            "CURRENCY_CODE_REQUIRED"
        );
    }

    // Validate symbol
    if (
        !symbol ||
        typeof symbol !== "string" ||
        symbol.trim() === ""
    ) {
        throw new AppError(
            "Currency symbol is required.",
            400,
            "CURRENCY_SYMBOL_REQUIRED"
        );
    }

    const name = currency_name.trim();
    const code = currency_code.trim().toUpperCase();
    const currencySymbol = symbol.trim();

    // Currency code must contain exactly 3 characters
    if (code.length !== 3) {
        throw new AppError(
            "Currency code must contain exactly 3 characters.",
            400,
            "INVALID_CURRENCY_CODE"
        );
    }

    // Check duplicate currency for this user
    const [existing] = await db.query(
        `SELECT currency_id
         FROM currencies
         WHERE user_id = ?
         AND currency_code = ?`,
        [userId, code]
    );

    if (existing.length > 0) {
        throw new AppError(
            "Currency code already exists.",
            409,
            "CURRENCY_CODE_ALREADY_EXISTS"
        );
    }

    const [result] = await db.query(
        `INSERT INTO currencies
            (user_id, currency_name, currency_code, symbol)
         VALUES (?, ?, ?, ?)`,
        [
            userId,
            name,
            code,
            currencySymbol
        ]
    );

    const [rows] = await db.query(
        `SELECT
            currency_id,
            currency_name,
            currency_code,
            symbol
         FROM currencies
         WHERE currency_id = ?
         AND user_id = ?`,
        [result.insertId, userId]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Currency was created but could not be retrieved.",
            500,
            "CURRENCY_CREATION_ERROR"
        );
    }

    return res.status(201).json({
        success: true,
        message: "Currency created successfully.",
        currency: rows[0]
    });
};


// ======================================================
// GET ALL CURRENCIES
// GET /api/currencies
// ======================================================

exports.getCurrencies = async (req, res) => {

    const userId = req.user.user_id;

    const [rows] = await db.query(
        `SELECT
            currency_id,
            currency_name,
            currency_code,
            symbol
         FROM currencies
         WHERE user_id = ?
         ORDER BY currency_id DESC`,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        currencies: rows
    });
};


// ======================================================
// GET CURRENCY BY ID
// GET /api/currencies/:id
// ======================================================

exports.getCurrencyById = async (req, res) => {

    const userId = req.user.user_id;
    const currencyId = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(currencyId) || currencyId <= 0) {
        throw new AppError(
            "Currency ID must be a valid positive integer.",
            400,
            "INVALID_CURRENCY_ID"
        );
    }

    const [rows] = await db.query(
        `SELECT
            currency_id,
            currency_name,
            currency_code,
            symbol
         FROM currencies
         WHERE currency_id = ?
         AND user_id = ?`,
        [currencyId, userId]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Currency not found.",
            404,
            "CURRENCY_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        currency: rows[0]
    });
};


// ======================================================
// UPDATE CURRENCY
// PUT /api/currencies/:id
// ======================================================

exports.updateCurrency = async (req, res) => {

    const userId = req.user.user_id;
    const currencyId = Number(req.params.id);

    const {
        currency_name,
        currency_code,
        symbol
    } = req.body;

    // Validate ID
    if (!Number.isInteger(currencyId) || currencyId <= 0) {
        throw new AppError(
            "Currency ID must be a valid positive integer.",
            400,
            "INVALID_CURRENCY_ID"
        );
    }

    // Validate currency name
    if (
        !currency_name ||
        typeof currency_name !== "string" ||
        currency_name.trim() === ""
    ) {
        throw new AppError(
            "Currency name is required.",
            400,
            "CURRENCY_NAME_REQUIRED"
        );
    }

    // Validate currency code
    if (
        !currency_code ||
        typeof currency_code !== "string" ||
        currency_code.trim() === ""
    ) {
        throw new AppError(
            "Currency code is required.",
            400,
            "CURRENCY_CODE_REQUIRED"
        );
    }

    // Validate symbol
    if (
        !symbol ||
        typeof symbol !== "string" ||
        symbol.trim() === ""
    ) {
        throw new AppError(
            "Currency symbol is required.",
            400,
            "CURRENCY_SYMBOL_REQUIRED"
        );
    }

    const name = currency_name.trim();
    const code = currency_code.trim().toUpperCase();
    const currencySymbol = symbol.trim();

    // Currency code must contain exactly 3 characters
    if (code.length !== 3) {
        throw new AppError(
            "Currency code must contain exactly 3 characters.",
            400,
            "INVALID_CURRENCY_CODE"
        );
    }

    // Check if currency belongs to this user
    const [existing] = await db.query(
        `SELECT currency_id
         FROM currencies
         WHERE currency_id = ?
         AND user_id = ?`,
        [currencyId, userId]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Currency not found.",
            404,
            "CURRENCY_NOT_FOUND"
        );
    }

    // Check duplicate currency code
    const [duplicate] = await db.query(
        `SELECT currency_id
         FROM currencies
         WHERE user_id = ?
         AND currency_code = ?
         AND currency_id != ?`,
        [
            userId,
            code,
            currencyId
        ]
    );

    if (duplicate.length > 0) {
        throw new AppError(
            "Another currency with this code already exists.",
            409,
            "CURRENCY_CODE_ALREADY_EXISTS"
        );
    }

    await db.query(
        `UPDATE currencies
         SET currency_name = ?,
             currency_code = ?,
             symbol = ?
         WHERE currency_id = ?
         AND user_id = ?`,
        [
            name,
            code,
            currencySymbol,
            currencyId,
            userId
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Currency updated successfully."
    });
};


// ======================================================
// DELETE CURRENCY
// DELETE /api/currencies/:id
// ======================================================

exports.deleteCurrency = async (req, res) => {

    const userId = req.user.user_id;
    const currencyId = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(currencyId) || currencyId <= 0) {
        throw new AppError(
            "Currency ID must be a valid positive integer.",
            400,
            "INVALID_CURRENCY_ID"
        );
    }

    try {

        const [result] = await db.query(
            `DELETE FROM currencies
             WHERE currency_id = ?
             AND user_id = ?`,
            [
                currencyId,
                userId
            ]
        );

        if (result.affectedRows === 0) {
            throw new AppError(
                "Currency not found.",
                404,
                "CURRENCY_NOT_FOUND"
            );
        }

        return res.status(200).json({
            success: true,
            message: "Currency deleted successfully."
        });

    } catch (error) {

        // Let AppError go to global error handler
        if (error instanceof AppError) {
            throw error;
        }

        // Foreign key constraint
        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            throw new AppError(
                "Currency cannot be deleted because it is being used by another record.",
                409,
                "CURRENCY_IN_USE"
            );
        }

        throw error;
    }
};
const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ======================================================
// CREATE EXCHANGE RATE
// POST /api/exchange-rates
// ======================================================

exports.createExchangeRate = async (req, res) => {

    const userId = req.user.user_id;

    const {
        from_currency_id,
        to_currency_id,
        rate,
        effective_date
    } = req.body;

    // --------------------------------------------------
    // Validate required fields
    // --------------------------------------------------

    if (
        from_currency_id === undefined ||
        from_currency_id === null ||
        from_currency_id === "" ||
        to_currency_id === undefined ||
        to_currency_id === null ||
        to_currency_id === ""
    ) {
        throw new AppError(
            "From currency and to currency are required.",
            400,
            "MISSING_CURRENCY_FIELDS"
        );
    }

    // --------------------------------------------------
    // Validate currency IDs
    // --------------------------------------------------

    const fromCurrencyId = Number(from_currency_id);
    const toCurrencyId = Number(to_currency_id);

    if (
        !Number.isInteger(fromCurrencyId) ||
        fromCurrencyId <= 0
    ) {
        throw new AppError(
            "From currency ID must be a valid ID.",
            400,
            "INVALID_FROM_CURRENCY_ID"
        );
    }

    if (
        !Number.isInteger(toCurrencyId) ||
        toCurrencyId <= 0
    ) {
        throw new AppError(
            "To currency ID must be a valid ID.",
            400,
            "INVALID_TO_CURRENCY_ID"
        );
    }

    if (fromCurrencyId === toCurrencyId) {
        throw new AppError(
            "From currency and to currency must be different.",
            400,
            "SAME_CURRENCY"
        );
    }

    // --------------------------------------------------
    // Validate rate
    // --------------------------------------------------

    if (
        rate === undefined ||
        rate === null ||
        rate === ""
    ) {
        throw new AppError(
            "Exchange rate is required.",
            400,
            "RATE_REQUIRED"
        );
    }

    const exchangeRate = Number(rate);

    if (
        !Number.isFinite(exchangeRate) ||
        exchangeRate <= 0
    ) {
        throw new AppError(
            "Exchange rate must be greater than zero.",
            400,
            "INVALID_EXCHANGE_RATE"
        );
    }

    // --------------------------------------------------
    // Validate effective date
    // --------------------------------------------------

    if (!effective_date) {
        throw new AppError(
            "Effective date is required.",
            400,
            "EFFECTIVE_DATE_REQUIRED"
        );
    }

    // --------------------------------------------------
    // Verify both currencies belong to this user
    // --------------------------------------------------

    const [currencies] = await db.query(
        `SELECT currency_id
         FROM currencies
         WHERE user_id = ?
         AND currency_id IN (?, ?)`,
        [
            userId,
            fromCurrencyId,
            toCurrencyId
        ]
    );

    if (currencies.length !== 2) {
        throw new AppError(
            "One or both currencies do not belong to this user.",
            400,
            "INVALID_USER_CURRENCY"
        );
    }

    // --------------------------------------------------
    // Insert exchange rate
    // --------------------------------------------------

    const [result] = await db.query(
        `INSERT INTO exchange_rate
            (
                user_id,
                from_currency_id,
                to_currency_id,
                rate,
                effective_date
            )
         VALUES (?, ?, ?, ?, ?)`,
        [
            userId,
            fromCurrencyId,
            toCurrencyId,
            exchangeRate,
            effective_date
        ]
    );

    // --------------------------------------------------
    // Get created exchange rate
    // --------------------------------------------------

    const [rows] = await db.query(
        `SELECT
            er.exchange_rate_id,

            er.from_currency_id,
            fc.currency_name AS from_currency_name,
            fc.currency_code AS from_currency_code,

            er.to_currency_id,
            tc.currency_name AS to_currency_name,
            tc.currency_code AS to_currency_code,

            er.rate,
            er.effective_date,
            er.created_at

         FROM exchange_rate er

         INNER JOIN currencies fc
            ON er.from_currency_id = fc.currency_id
            AND er.user_id = fc.user_id

         INNER JOIN currencies tc
            ON er.to_currency_id = tc.currency_id
            AND er.user_id = tc.user_id

         WHERE er.exchange_rate_id = ?
         AND er.user_id = ?`,
        [
            result.insertId,
            userId
        ]
    );

    return res.status(201).json({
        success: true,
        message: "Exchange rate created successfully.",
        exchangeRate: rows[0]
    });
};


// ======================================================
// GET ALL EXCHANGE RATES
// GET /api/exchange-rates
// ======================================================

exports.getExchangeRates = async (req, res) => {

    const userId = req.user.user_id;

    const [rows] = await db.query(
        `SELECT
            er.exchange_rate_id,

            er.from_currency_id,
            fc.currency_name AS from_currency_name,
            fc.currency_code AS from_currency_code,

            er.to_currency_id,
            tc.currency_name AS to_currency_name,
            tc.currency_code AS to_currency_code,

            er.rate,
            er.effective_date,
            er.created_at

         FROM exchange_rate er

         INNER JOIN currencies fc
            ON er.from_currency_id = fc.currency_id
            AND er.user_id = fc.user_id

         INNER JOIN currencies tc
            ON er.to_currency_id = tc.currency_id
            AND er.user_id = tc.user_id

         WHERE er.user_id = ?

         ORDER BY er.effective_date DESC,
                  er.exchange_rate_id DESC`,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        exchangeRates: rows
    });
};


// ======================================================
// GET EXCHANGE RATE BY ID
// GET /api/exchange-rates/:id
// ======================================================

exports.getExchangeRateById = async (req, res) => {

    const userId = req.user.user_id;
    const exchangeRateId = Number(req.params.id);

    // --------------------------------------------------
    // Validate ID
    // --------------------------------------------------

    if (
        !Number.isInteger(exchangeRateId) ||
        exchangeRateId <= 0
    ) {
        throw new AppError(
            "Exchange rate ID must be a valid ID.",
            400,
            "INVALID_EXCHANGE_RATE_ID"
        );
    }

    const [rows] = await db.query(
        `SELECT
            er.exchange_rate_id,

            er.from_currency_id,
            fc.currency_name AS from_currency_name,
            fc.currency_code AS from_currency_code,

            er.to_currency_id,
            tc.currency_name AS to_currency_name,
            tc.currency_code AS to_currency_code,

            er.rate,
            er.effective_date,
            er.created_at

         FROM exchange_rate er

         INNER JOIN currencies fc
            ON er.from_currency_id = fc.currency_id
            AND er.user_id = fc.user_id

         INNER JOIN currencies tc
            ON er.to_currency_id = tc.currency_id
            AND er.user_id = tc.user_id

         WHERE er.exchange_rate_id = ?
         AND er.user_id = ?`,
        [
            exchangeRateId,
            userId
        ]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Exchange rate not found.",
            404,
            "EXCHANGE_RATE_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        exchangeRate: rows[0]
    });
};


// ======================================================
// UPDATE EXCHANGE RATE
// PUT /api/exchange-rates/:id
// ======================================================

exports.updateExchangeRate = async (req, res) => {

    const userId = req.user.user_id;
    const exchangeRateId = Number(req.params.id);

    // --------------------------------------------------
    // Validate exchange rate ID
    // --------------------------------------------------

    if (
        !Number.isInteger(exchangeRateId) ||
        exchangeRateId <= 0
    ) {
        throw new AppError(
            "Exchange rate ID must be a valid ID.",
            400,
            "INVALID_EXCHANGE_RATE_ID"
        );
    }

    const {
        from_currency_id,
        to_currency_id,
        rate,
        effective_date
    } = req.body;

    // --------------------------------------------------
    // Validate required currency fields
    // --------------------------------------------------

    if (
        from_currency_id === undefined ||
        from_currency_id === null ||
        from_currency_id === "" ||
        to_currency_id === undefined ||
        to_currency_id === null ||
        to_currency_id === ""
    ) {
        throw new AppError(
            "From currency and to currency are required.",
            400,
            "MISSING_CURRENCY_FIELDS"
        );
    }

    const fromCurrencyId = Number(from_currency_id);
    const toCurrencyId = Number(to_currency_id);

    // --------------------------------------------------
    // Validate currency IDs
    // --------------------------------------------------

    if (
        !Number.isInteger(fromCurrencyId) ||
        fromCurrencyId <= 0
    ) {
        throw new AppError(
            "From currency ID must be a valid ID.",
            400,
            "INVALID_FROM_CURRENCY_ID"
        );
    }

    if (
        !Number.isInteger(toCurrencyId) ||
        toCurrencyId <= 0
    ) {
        throw new AppError(
            "To currency ID must be a valid ID.",
            400,
            "INVALID_TO_CURRENCY_ID"
        );
    }

    if (fromCurrencyId === toCurrencyId) {
        throw new AppError(
            "From currency and to currency must be different.",
            400,
            "SAME_CURRENCY"
        );
    }

    // --------------------------------------------------
    // Validate rate
    // --------------------------------------------------

    if (
        rate === undefined ||
        rate === null ||
        rate === ""
    ) {
        throw new AppError(
            "Exchange rate is required.",
            400,
            "RATE_REQUIRED"
        );
    }

    const exchangeRate = Number(rate);

    if (
        !Number.isFinite(exchangeRate) ||
        exchangeRate <= 0
    ) {
        throw new AppError(
            "Exchange rate must be greater than zero.",
            400,
            "INVALID_EXCHANGE_RATE"
        );
    }

    // --------------------------------------------------
    // Validate effective date
    // --------------------------------------------------

    if (!effective_date) {
        throw new AppError(
            "Effective date is required.",
            400,
            "EFFECTIVE_DATE_REQUIRED"
        );
    }

    // --------------------------------------------------
    // Check exchange rate belongs to this user
    // --------------------------------------------------

    const [existing] = await db.query(
        `SELECT exchange_rate_id
         FROM exchange_rate
         WHERE exchange_rate_id = ?
         AND user_id = ?`,
        [
            exchangeRateId,
            userId
        ]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Exchange rate not found.",
            404,
            "EXCHANGE_RATE_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Verify both currencies belong to this user
    // --------------------------------------------------

    const [currencies] = await db.query(
        `SELECT currency_id
         FROM currencies
         WHERE user_id = ?
         AND currency_id IN (?, ?)`,
        [
            userId,
            fromCurrencyId,
            toCurrencyId
        ]
    );

    if (currencies.length !== 2) {
        throw new AppError(
            "One or both currencies do not belong to this user.",
            400,
            "INVALID_USER_CURRENCY"
        );
    }

    // --------------------------------------------------
    // Update exchange rate
    // --------------------------------------------------

    await db.query(
        `UPDATE exchange_rate
         SET from_currency_id = ?,
             to_currency_id = ?,
             rate = ?,
             effective_date = ?
         WHERE exchange_rate_id = ?
         AND user_id = ?`,
        [
            fromCurrencyId,
            toCurrencyId,
            exchangeRate,
            effective_date,
            exchangeRateId,
            userId
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Exchange rate updated successfully."
    });
};


// ======================================================
// DELETE EXCHANGE RATE
// DELETE /api/exchange-rates/:id
// ======================================================

exports.deleteExchangeRate = async (req, res) => {

    const userId = req.user.user_id;
    const exchangeRateId = Number(req.params.id);

    // --------------------------------------------------
    // Validate ID
    // --------------------------------------------------

    if (
        !Number.isInteger(exchangeRateId) ||
        exchangeRateId <= 0
    ) {
        throw new AppError(
            "Exchange rate ID must be a valid ID.",
            400,
            "INVALID_EXCHANGE_RATE_ID"
        );
    }

    const [result] = await db.query(
        `DELETE FROM exchange_rate
         WHERE exchange_rate_id = ?
         AND user_id = ?`,
        [
            exchangeRateId,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Exchange rate not found.",
            404,
            "EXCHANGE_RATE_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Exchange rate deleted successfully."
    });
};
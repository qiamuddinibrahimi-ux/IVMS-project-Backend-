const db = require("../config/database.js");
const AppError = require("../utils/AppError");


// ======================================================
// CREATE PURCHASE PAYMENT
// POST /api/purchase-payments
// ======================================================

exports.createPurchasePayment = async (req, res) => {

    const userId = req.user.user_id;

    const {
        purchase_id,
        vendor_id,
        currency_id,
        amount,
        payment_date
    } = req.body;


    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        purchase_id === undefined ||
        purchase_id === null ||
        vendor_id === undefined ||
        vendor_id === null ||
        currency_id === undefined ||
        currency_id === null ||
        amount === undefined ||
        amount === null ||
        payment_date === undefined ||
        payment_date === null ||
        payment_date === ""
    ) {
        throw new AppError(
            "Purchase, vendor, currency, amount and payment date are required.",
            400,
            "MISSING_PAYMENT_FIELDS"
        );
    }


    const purchaseId = Number(purchase_id);
    const vendorId = Number(vendor_id);
    const currencyId = Number(currency_id);
    const paymentAmount = Number(amount);


    if (
        !Number.isInteger(purchaseId) ||
        purchaseId <= 0
    ) {
        throw new AppError(
            "Purchase ID must be a valid ID.",
            400,
            "INVALID_PURCHASE_ID"
        );
    }


    if (
        !Number.isInteger(vendorId) ||
        vendorId <= 0
    ) {
        throw new AppError(
            "Vendor ID must be a valid ID.",
            400,
            "INVALID_VENDOR_ID"
        );
    }


    if (
        !Number.isInteger(currencyId) ||
        currencyId <= 0
    ) {
        throw new AppError(
            "Currency ID must be a valid ID.",
            400,
            "INVALID_CURRENCY_ID"
        );
    }


    if (
        !Number.isFinite(paymentAmount) ||
        paymentAmount <= 0
    ) {
        throw new AppError(
            "Payment amount must be greater than zero.",
            400,
            "INVALID_PAYMENT_AMOUNT"
        );
    }


    // --------------------------------------------------
    // Get purchase
    // --------------------------------------------------

    const [purchase] = await db.query(
        `
        SELECT
            purchase_id,
            vendor_id,
            currency_id

        FROM purchases

        WHERE purchase_id = ?
          AND user_id = ?
        `,
        [
            purchaseId,
            userId
        ]
    );


    if (purchase.length === 0) {
        throw new AppError(
            "Purchase not found.",
            404,
            "PURCHASE_NOT_FOUND"
        );
    }


    // --------------------------------------------------
    // Vendor must match purchase
    // --------------------------------------------------

    if (
        Number(purchase[0].vendor_id) !== vendorId
    ) {
        throw new AppError(
            "Vendor does not match the purchase.",
            400,
            "VENDOR_PURCHASE_MISMATCH"
        );
    }


    // --------------------------------------------------
    // Currency must match purchase
    // --------------------------------------------------

    if (
        Number(purchase[0].currency_id) !== currencyId
    ) {
        throw new AppError(
            "Currency does not match the purchase.",
            400,
            "CURRENCY_PURCHASE_MISMATCH"
        );
    }


    // --------------------------------------------------
    // Insert payment
    // --------------------------------------------------

    const [result] = await db.query(
        `
        INSERT INTO purchase_payment
        (
            user_id,
            purchase_id,
            vendor_id,
            currency_id,
            amount,
            payment_date
        )

        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            userId,
            purchaseId,
            vendorId,
            currencyId,
            paymentAmount,
            payment_date
        ]
    );


    return res.status(201).json({
        success: true,
        message: "Purchase payment created successfully.",
        payment_id: result.insertId
    });
};


// ======================================================
// GET ALL PURCHASE PAYMENTS
// GET /api/purchase-payments
// ======================================================

exports.getPurchasePayments = async (req, res) => {

    const userId = req.user.user_id;


    const [payments] = await db.query(
        `
        SELECT
            pp.payment_id,

            pp.purchase_id,
            p.invoice_no,
            p.purchase_date,

            pp.vendor_id,
            v.vendor_name,

            pp.currency_id,
            c.currency_name,
            c.currency_code,
            c.symbol,

            pp.amount,
            pp.payment_date

        FROM purchase_payment pp

        INNER JOIN purchases p
            ON pp.purchase_id = p.purchase_id
            AND pp.user_id = p.user_id
            AND pp.vendor_id = p.vendor_id
            AND pp.currency_id = p.currency_id

        INNER JOIN vendors v
            ON pp.vendor_id = v.vendor_id
            AND pp.user_id = v.user_id

        INNER JOIN currencies c
            ON pp.currency_id = c.currency_id
            AND pp.user_id = c.user_id

        WHERE pp.user_id = ?

        ORDER BY pp.payment_id DESC
        `,
        [userId]
    );


    return res.status(200).json({
        success: true,
        count: payments.length,
        data: payments
    });
};


// ======================================================
// GET PURCHASE PAYMENT BY ID
// GET /api/purchase-payments/:id
// ======================================================

exports.getPurchasePaymentById = async (req, res) => {

    const userId = req.user.user_id;

    const paymentId = Number(req.params.id);


    // --------------------------------------------------
    // Validate payment ID
    // --------------------------------------------------

    if (
        !Number.isInteger(paymentId) ||
        paymentId <= 0
    ) {
        throw new AppError(
            "Payment ID must be a valid ID.",
            400,
            "INVALID_PAYMENT_ID"
        );
    }


    const [payments] = await db.query(
        `
        SELECT
            pp.payment_id,

            pp.purchase_id,
            p.invoice_no,
            p.purchase_date,

            pp.vendor_id,
            v.vendor_name,

            pp.currency_id,
            c.currency_name,
            c.currency_code,
            c.symbol,

            pp.amount,
            pp.payment_date

        FROM purchase_payment pp

        INNER JOIN purchases p
            ON pp.purchase_id = p.purchase_id
            AND pp.user_id = p.user_id
            AND pp.vendor_id = p.vendor_id
            AND pp.currency_id = p.currency_id

        INNER JOIN vendors v
            ON pp.vendor_id = v.vendor_id
            AND pp.user_id = v.user_id

        INNER JOIN currencies c
            ON pp.currency_id = c.currency_id
            AND pp.user_id = c.user_id

        WHERE pp.payment_id = ?
          AND pp.user_id = ?
        `,
        [
            paymentId,
            userId
        ]
    );


    if (payments.length === 0) {
        throw new AppError(
            "Purchase payment not found.",
            404,
            "PURCHASE_PAYMENT_NOT_FOUND"
        );
    }


    return res.status(200).json({
        success: true,
        data: payments[0]
    });
};


// ======================================================
// UPDATE PURCHASE PAYMENT
// PUT /api/purchase-payments/:id
// ======================================================

exports.updatePurchasePayment = async (req, res) => {

    const userId = req.user.user_id;

    const paymentId = Number(req.params.id);

    const {
        purchase_id,
        vendor_id,
        currency_id,
        amount,
        payment_date
    } = req.body;


    // --------------------------------------------------
    // Validate payment ID
    // --------------------------------------------------

    if (
        !Number.isInteger(paymentId) ||
        paymentId <= 0
    ) {
        throw new AppError(
            "Payment ID must be a valid ID.",
            400,
            "INVALID_PAYMENT_ID"
        );
    }


    // --------------------------------------------------
    // Validate required fields
    // --------------------------------------------------

    if (
        purchase_id === undefined ||
        purchase_id === null ||
        vendor_id === undefined ||
        vendor_id === null ||
        currency_id === undefined ||
        currency_id === null ||
        amount === undefined ||
        amount === null ||
        payment_date === undefined ||
        payment_date === null ||
        payment_date === ""
    ) {
        throw new AppError(
            "Purchase, vendor, currency, amount and payment date are required.",
            400,
            "MISSING_PAYMENT_FIELDS"
        );
    }


    const purchaseId = Number(purchase_id);
    const vendorId = Number(vendor_id);
    const currencyId = Number(currency_id);
    const paymentAmount = Number(amount);


    if (
        !Number.isInteger(purchaseId) ||
        purchaseId <= 0
    ) {
        throw new AppError(
            "Purchase ID must be a valid ID.",
            400,
            "INVALID_PURCHASE_ID"
        );
    }


    if (
        !Number.isInteger(vendorId) ||
        vendorId <= 0
    ) {
        throw new AppError(
            "Vendor ID must be a valid ID.",
            400,
            "INVALID_VENDOR_ID"
        );
    }


    if (
        !Number.isInteger(currencyId) ||
        currencyId <= 0
    ) {
        throw new AppError(
            "Currency ID must be a valid ID.",
            400,
            "INVALID_CURRENCY_ID"
        );
    }


    if (
        !Number.isFinite(paymentAmount) ||
        paymentAmount <= 0
    ) {
        throw new AppError(
            "Payment amount must be greater than zero.",
            400,
            "INVALID_PAYMENT_AMOUNT"
        );
    }


    // --------------------------------------------------
    // Check payment belongs to current user
    // --------------------------------------------------

    const [existingPayment] = await db.query(
        `
        SELECT payment_id

        FROM purchase_payment

        WHERE payment_id = ?
          AND user_id = ?
        `,
        [
            paymentId,
            userId
        ]
    );


    if (existingPayment.length === 0) {
        throw new AppError(
            "Purchase payment not found.",
            404,
            "PURCHASE_PAYMENT_NOT_FOUND"
        );
    }


    // --------------------------------------------------
    // Get purchase
    // --------------------------------------------------

    const [purchase] = await db.query(
        `
        SELECT
            purchase_id,
            vendor_id,
            currency_id

        FROM purchases

        WHERE purchase_id = ?
          AND user_id = ?
        `,
        [
            purchaseId,
            userId
        ]
    );


    if (purchase.length === 0) {
        throw new AppError(
            "Purchase not found.",
            404,
            "PURCHASE_NOT_FOUND"
        );
    }


    // --------------------------------------------------
    // Vendor must match purchase
    // --------------------------------------------------

    if (
        Number(purchase[0].vendor_id) !== vendorId
    ) {
        throw new AppError(
            "Vendor does not match the purchase.",
            400,
            "VENDOR_PURCHASE_MISMATCH"
        );
    }


    // --------------------------------------------------
    // Currency must match purchase
    // --------------------------------------------------

    if (
        Number(purchase[0].currency_id) !== currencyId
    ) {
        throw new AppError(
            "Currency does not match the purchase.",
            400,
            "CURRENCY_PURCHASE_MISMATCH"
        );
    }


    // --------------------------------------------------
    // Update payment
    // --------------------------------------------------

    const [result] = await db.query(
        `
        UPDATE purchase_payment

        SET
            purchase_id = ?,
            vendor_id = ?,
            currency_id = ?,
            amount = ?,
            payment_date = ?

        WHERE payment_id = ?
          AND user_id = ?
        `,
        [
            purchaseId,
            vendorId,
            currencyId,
            paymentAmount,
            payment_date,
            paymentId,
            userId
        ]
    );


    if (result.affectedRows === 0) {
        throw new AppError(
            "Purchase payment could not be updated.",
            404,
            "PURCHASE_PAYMENT_NOT_FOUND"
        );
    }


    return res.status(200).json({
        success: true,
        message: "Purchase payment updated successfully."
    });
};


// ======================================================
// DELETE PURCHASE PAYMENT
// DELETE /api/purchase-payments/:id
// ======================================================

exports.deletePurchasePayment = async (req, res) => {

    const userId = req.user.user_id;

    const paymentId = Number(req.params.id);


    // --------------------------------------------------
    // Validate payment ID
    // --------------------------------------------------

    if (
        !Number.isInteger(paymentId) ||
        paymentId <= 0
    ) {
        throw new AppError(
            "Payment ID must be a valid ID.",
            400,
            "INVALID_PAYMENT_ID"
        );
    }


    // --------------------------------------------------
    // Delete payment
    // --------------------------------------------------

    const [result] = await db.query(
        `
        DELETE FROM purchase_payment

        WHERE payment_id = ?
          AND user_id = ?
        `,
        [
            paymentId,
            userId
        ]
    );


    if (result.affectedRows === 0) {
        throw new AppError(
            "Purchase payment not found.",
            404,
            "PURCHASE_PAYMENT_NOT_FOUND"
        );
    }


    return res.status(200).json({
        success: true,
        message: "Purchase payment deleted successfully."
    });
};
const db = require("../config/database.js");
const AppError = require("../utils/AppError");


// ======================================================
// CREATE CUSTOMER PAYMENT
// POST /api/customer-payments
// ======================================================

exports.createCustomerPayment = async (req, res) => {

    const userId = req.user.user_id;

    const {
        customer_id,
        sale_id,
        currency_id,
        amount,
        payment_date
    } = req.body;

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        !customer_id ||
        !sale_id ||
        !currency_id ||
        amount === undefined ||
        amount === null ||
        !payment_date
    ) {
        throw new AppError(
            "Customer, sale, currency, amount and payment date are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    const customerId = Number(customer_id);
    const saleId = Number(sale_id);
    const currencyId = Number(currency_id);
    const paymentAmount = Number(amount);

    if (
        !Number.isInteger(customerId) ||
        customerId <= 0
    ) {
        throw new AppError(
            "Customer ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_ID"
        );
    }

    if (
        !Number.isInteger(saleId) ||
        saleId <= 0
    ) {
        throw new AppError(
            "Sale ID must be a valid positive integer.",
            400,
            "INVALID_SALE_ID"
        );
    }

    if (
        !Number.isInteger(currencyId) ||
        currencyId <= 0
    ) {
        throw new AppError(
            "Currency ID must be a valid positive integer.",
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
    // Check sale belongs to current user
    // --------------------------------------------------

    const [sale] = await db.query(
        `
        SELECT
            sale_id,
            customer_id,
            currency_id
        FROM sales
        WHERE sale_id = ?
        AND user_id = ?
        `,
        [saleId, userId]
    );

    if (sale.length === 0) {
        throw new AppError(
            "Sale not found.",
            404,
            "SALE_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Customer must match sale
    // --------------------------------------------------

    if (
        Number(sale[0].customer_id) !== customerId
    ) {
        throw new AppError(
            "Customer does not match the sale.",
            400,
            "CUSTOMER_SALE_MISMATCH"
        );
    }

    // --------------------------------------------------
    // Currency must match sale
    // --------------------------------------------------

    if (
        Number(sale[0].currency_id) !== currencyId
    ) {
        throw new AppError(
            "Currency does not match the sale.",
            400,
            "CURRENCY_SALE_MISMATCH"
        );
    }

    // --------------------------------------------------
    // Insert customer payment
    // --------------------------------------------------

    const [result] = await db.query(
        `
        INSERT INTO customer_payment
        (
            user_id,
            customer_id,
            sale_id,
            currency_id,
            amount,
            payment_date
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            userId,
            customerId,
            saleId,
            currencyId,
            paymentAmount,
            payment_date
        ]
    );

    return res.status(201).json({
        success: true,
        message: "Customer payment created successfully.",
        customer_payment_id: result.insertId
    });
};


// ======================================================
// GET ALL CUSTOMER PAYMENTS
// GET /api/customer-payments
// ======================================================

exports.getCustomerPayments = async (req, res) => {

    const userId = req.user.user_id;

    const [payments] = await db.query(
        `
        SELECT
            cp.customer_payment_id,

            cp.customer_id,
            cu.customer_name,

            cp.sale_id,
            s.invoice_no,
            s.sale_date,

            cp.currency_id,
            c.currency_name,
            c.currency_code,
            c.symbol,

            cp.amount,
            cp.payment_date

        FROM customer_payment cp

        INNER JOIN sales s
            ON cp.sale_id = s.sale_id
            AND cp.user_id = s.user_id
            AND cp.customer_id = s.customer_id

        INNER JOIN customers cu
            ON cp.customer_id = cu.customer_id
            AND cp.user_id = cu.user_id

        INNER JOIN currencies c
            ON cp.currency_id = c.currency_id
            AND cp.user_id = c.user_id

        WHERE cp.user_id = ?

        ORDER BY cp.customer_payment_id DESC
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
// GET CUSTOMER PAYMENT BY ID
// GET /api/customer-payments/:id
// ======================================================

exports.getCustomerPaymentById = async (req, res) => {

    const userId = req.user.user_id;
    const paymentId = Number(req.params.id);

    // --------------------------------------------------
    // Validate ID
    // --------------------------------------------------

    if (
        !Number.isInteger(paymentId) ||
        paymentId <= 0
    ) {
        throw new AppError(
            "Customer payment ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_PAYMENT_ID"
        );
    }

    const [payments] = await db.query(
        `
        SELECT
            cp.customer_payment_id,

            cp.customer_id,
            cu.customer_name,

            cp.sale_id,
            s.invoice_no,
            s.sale_date,

            cp.currency_id,
            c.currency_name,
            c.currency_code,
            c.symbol,

            cp.amount,
            cp.payment_date

        FROM customer_payment cp

        INNER JOIN sales s
            ON cp.sale_id = s.sale_id
            AND cp.user_id = s.user_id
            AND cp.customer_id = s.customer_id

        INNER JOIN customers cu
            ON cp.customer_id = cu.customer_id
            AND cp.user_id = cu.user_id

        INNER JOIN currencies c
            ON cp.currency_id = c.currency_id
            AND cp.user_id = c.user_id

        WHERE cp.customer_payment_id = ?
        AND cp.user_id = ?
        `,
        [paymentId, userId]
    );

    if (payments.length === 0) {
        throw new AppError(
            "Customer payment not found.",
            404,
            "CUSTOMER_PAYMENT_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        data: payments[0]
    });
};


// ======================================================
// UPDATE CUSTOMER PAYMENT
// PUT /api/customer-payments/:id
// ======================================================

exports.updateCustomerPayment = async (req, res) => {

    const userId = req.user.user_id;
    const paymentId = Number(req.params.id);

    const {
        customer_id,
        sale_id,
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
            "Customer payment ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_PAYMENT_ID"
        );
    }

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        !customer_id ||
        !sale_id ||
        !currency_id ||
        amount === undefined ||
        amount === null ||
        !payment_date
    ) {
        throw new AppError(
            "Customer, sale, currency, amount and payment date are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    const customerId = Number(customer_id);
    const saleId = Number(sale_id);
    const currencyId = Number(currency_id);
    const paymentAmount = Number(amount);

    if (
        !Number.isInteger(customerId) ||
        customerId <= 0
    ) {
        throw new AppError(
            "Customer ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_ID"
        );
    }

    if (
        !Number.isInteger(saleId) ||
        saleId <= 0
    ) {
        throw new AppError(
            "Sale ID must be a valid positive integer.",
            400,
            "INVALID_SALE_ID"
        );
    }

    if (
        !Number.isInteger(currencyId) ||
        currencyId <= 0
    ) {
        throw new AppError(
            "Currency ID must be a valid positive integer.",
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
        SELECT customer_payment_id
        FROM customer_payment
        WHERE customer_payment_id = ?
        AND user_id = ?
        `,
        [paymentId, userId]
    );

    if (existingPayment.length === 0) {
        throw new AppError(
            "Customer payment not found.",
            404,
            "CUSTOMER_PAYMENT_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Get sale
    // --------------------------------------------------

    const [sale] = await db.query(
        `
        SELECT
            sale_id,
            customer_id,
            currency_id
        FROM sales
        WHERE sale_id = ?
        AND user_id = ?
        `,
        [saleId, userId]
    );

    if (sale.length === 0) {
        throw new AppError(
            "Sale not found.",
            404,
            "SALE_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Customer must match sale
    // --------------------------------------------------

    if (
        Number(sale[0].customer_id) !== customerId
    ) {
        throw new AppError(
            "Customer does not match the sale.",
            400,
            "CUSTOMER_SALE_MISMATCH"
        );
    }

    // --------------------------------------------------
    // Currency must match sale
    // --------------------------------------------------

    if (
        Number(sale[0].currency_id) !== currencyId
    ) {
        throw new AppError(
            "Currency does not match the sale.",
            400,
            "CURRENCY_SALE_MISMATCH"
        );
    }

    // --------------------------------------------------
    // Update payment
    // --------------------------------------------------

    await db.query(
        `
        UPDATE customer_payment
        SET
            customer_id = ?,
            sale_id = ?,
            currency_id = ?,
            amount = ?,
            payment_date = ?
        WHERE customer_payment_id = ?
        AND user_id = ?
        `,
        [
            customerId,
            saleId,
            currencyId,
            paymentAmount,
            payment_date,
            paymentId,
            userId
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Customer payment updated successfully."
    });
};


// ======================================================
// DELETE CUSTOMER PAYMENT
// DELETE /api/customer-payments/:id
// ======================================================

exports.deleteCustomerPayment = async (req, res) => {

    const userId = req.user.user_id;
    const paymentId = Number(req.params.id);

    // Validate ID
    if (
        !Number.isInteger(paymentId) ||
        paymentId <= 0
    ) {
        throw new AppError(
            "Customer payment ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_PAYMENT_ID"
        );
    }

    const [result] = await db.query(
        `
        DELETE FROM customer_payment
        WHERE customer_payment_id = ?
        AND user_id = ?
        `,
        [paymentId, userId]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Customer payment not found.",
            404,
            "CUSTOMER_PAYMENT_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Customer payment deleted successfully."
    });
};
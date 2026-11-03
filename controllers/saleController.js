const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ======================================================
// CREATE SALE
// POST /api/sales
// ======================================================

exports.createSale = async (req, res) => {

    const userId = req.user.user_id;

    const {
        customer_id,
        currency_id,
        sale_date,
        invoice_no
    } = req.body;

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        customer_id === undefined ||
        customer_id === null ||
        customer_id === "" ||
        currency_id === undefined ||
        currency_id === null ||
        currency_id === "" ||
        !sale_date ||
        !invoice_no
    ) {
        throw new AppError(
            "Customer, currency, sale date and invoice number are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    const customerId = Number(customer_id);
    const currencyId = Number(currency_id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
        throw new AppError(
            "Customer ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_ID"
        );
    }

    if (!Number.isInteger(currencyId) || currencyId <= 0) {
        throw new AppError(
            "Currency ID must be a valid positive integer.",
            400,
            "INVALID_CURRENCY_ID"
        );
    }

    const invoiceNo = String(invoice_no).trim();

    if (invoiceNo.length === 0) {
        throw new AppError(
            "Invoice number cannot be empty.",
            400,
            "INVALID_INVOICE_NUMBER"
        );
    }

    // --------------------------------------------------
    // Check customer belongs to current user
    // --------------------------------------------------

    const [customer] = await db.query(
        `
        SELECT customer_id
        FROM customers
        WHERE customer_id = ?
        AND user_id = ?
        `,
        [customerId, userId]
    );

    if (customer.length === 0) {
        throw new AppError(
            "Invalid customer.",
            400,
            "INVALID_CUSTOMER"
        );
    }

    // --------------------------------------------------
    // Check currency belongs to current user
    // --------------------------------------------------

    const [currency] = await db.query(
        `
        SELECT currency_id
        FROM currencies
        WHERE currency_id = ?
        AND user_id = ?
        `,
        [currencyId, userId]
    );

    if (currency.length === 0) {
        throw new AppError(
            "Invalid currency.",
            400,
            "INVALID_CURRENCY"
        );
    }

    // --------------------------------------------------
    // Check duplicate invoice number
    // --------------------------------------------------

    const [existingInvoice] = await db.query(
        `
        SELECT sale_id
        FROM sales
        WHERE user_id = ?
        AND invoice_no = ?
        `,
        [userId, invoiceNo]
    );

    if (existingInvoice.length > 0) {
        throw new AppError(
            "Invoice number already exists.",
            409,
            "DUPLICATE_INVOICE"
        );
    }

    // --------------------------------------------------
    // Insert sale
    // --------------------------------------------------

    const [result] = await db.query(
        `
        INSERT INTO sales
        (
            user_id,
            customer_id,
            currency_id,
            sale_date,
            invoice_no
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            userId,
            customerId,
            currencyId,
            sale_date,
            invoiceNo
        ]
    );

    return res.status(201).json({
        success: true,
        message: "Sale created successfully.",
        sale_id: result.insertId
    });
};


// ======================================================
// GET ALL SALES
// GET /api/sales
// ======================================================

exports.getSales = async (req, res) => {

    const userId = req.user.user_id;

    const [sales] = await db.query(
        `
        SELECT
            s.sale_id,

            s.customer_id,
            cu.customer_name,

            s.currency_id,
            c.currency_name,
            c.currency_code,
            c.symbol,

            s.sale_date,
            s.invoice_no

        FROM sales s

        INNER JOIN customers cu
            ON s.customer_id = cu.customer_id
            AND s.user_id = cu.user_id

        INNER JOIN currencies c
            ON s.currency_id = c.currency_id
            AND s.user_id = c.user_id

        WHERE s.user_id = ?

        ORDER BY s.sale_id DESC
        `,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: sales.length,
        data: sales
    });
};


// ======================================================
// GET SALE BY ID
// GET /api/sales/:id
// ======================================================

exports.getSaleById = async (req, res) => {

    const userId = req.user.user_id;
    const saleId = Number(req.params.id);

    // --------------------------------------------------
    // Validate sale ID
    // --------------------------------------------------

    if (!Number.isInteger(saleId) || saleId <= 0) {
        throw new AppError(
            "Sale ID must be a valid positive integer.",
            400,
            "INVALID_SALE_ID"
        );
    }

    const [sales] = await db.query(
        `
        SELECT
            s.sale_id,

            s.customer_id,
            cu.customer_name,

            s.currency_id,
            c.currency_name,
            c.currency_code,
            c.symbol,

            s.sale_date,
            s.invoice_no

        FROM sales s

        INNER JOIN customers cu
            ON s.customer_id = cu.customer_id
            AND s.user_id = cu.user_id

        INNER JOIN currencies c
            ON s.currency_id = c.currency_id
            AND s.user_id = c.user_id

        WHERE s.sale_id = ?
        AND s.user_id = ?
        `,
        [saleId, userId]
    );

    if (sales.length === 0) {
        throw new AppError(
            "Sale not found.",
            404,
            "SALE_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        data: sales[0]
    });
};


// ======================================================
// UPDATE SALE
// PUT /api/sales/:id
// ======================================================

exports.updateSale = async (req, res) => {

    const userId = req.user.user_id;
    const saleId = Number(req.params.id);

    const {
        customer_id,
        currency_id,
        sale_date,
        invoice_no
    } = req.body;

    // --------------------------------------------------
    // Validate sale ID
    // --------------------------------------------------

    if (!Number.isInteger(saleId) || saleId <= 0) {
        throw new AppError(
            "Sale ID must be a valid positive integer.",
            400,
            "INVALID_SALE_ID"
        );
    }

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        customer_id === undefined ||
        customer_id === null ||
        customer_id === "" ||
        currency_id === undefined ||
        currency_id === null ||
        currency_id === "" ||
        !sale_date ||
        !invoice_no
    ) {
        throw new AppError(
            "Customer, currency, sale date and invoice number are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    const customerId = Number(customer_id);
    const currencyId = Number(currency_id);
    const invoiceNo = String(invoice_no).trim();

    if (!Number.isInteger(customerId) || customerId <= 0) {
        throw new AppError(
            "Customer ID must be a valid positive integer.",
            400,
            "INVALID_CUSTOMER_ID"
        );
    }

    if (!Number.isInteger(currencyId) || currencyId <= 0) {
        throw new AppError(
            "Currency ID must be a valid positive integer.",
            400,
            "INVALID_CURRENCY_ID"
        );
    }

    if (invoiceNo.length === 0) {
        throw new AppError(
            "Invoice number cannot be empty.",
            400,
            "INVALID_INVOICE_NUMBER"
        );
    }

    // --------------------------------------------------
    // Check sale belongs to current user
    // --------------------------------------------------

    const [existingSale] = await db.query(
        `
        SELECT sale_id
        FROM sales
        WHERE sale_id = ?
        AND user_id = ?
        `,
        [saleId, userId]
    );

    if (existingSale.length === 0) {
        throw new AppError(
            "Sale not found.",
            404,
            "SALE_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Check customer belongs to current user
    // --------------------------------------------------

    const [customer] = await db.query(
        `
        SELECT customer_id
        FROM customers
        WHERE customer_id = ?
        AND user_id = ?
        `,
        [customerId, userId]
    );

    if (customer.length === 0) {
        throw new AppError(
            "Invalid customer.",
            400,
            "INVALID_CUSTOMER"
        );
    }

    // --------------------------------------------------
    // Check currency belongs to current user
    // --------------------------------------------------

    const [currency] = await db.query(
        `
        SELECT currency_id
        FROM currencies
        WHERE currency_id = ?
        AND user_id = ?
        `,
        [currencyId, userId]
    );

    if (currency.length === 0) {
        throw new AppError(
            "Invalid currency.",
            400,
            "INVALID_CURRENCY"
        );
    }

    // --------------------------------------------------
    // Check duplicate invoice
    // --------------------------------------------------

    const [duplicateInvoice] = await db.query(
        `
        SELECT sale_id
        FROM sales
        WHERE user_id = ?
        AND invoice_no = ?
        AND sale_id != ?
        `,
        [userId, invoiceNo, saleId]
    );

    if (duplicateInvoice.length > 0) {
        throw new AppError(
            "Invoice number already exists.",
            409,
            "DUPLICATE_INVOICE"
        );
    }

    // --------------------------------------------------
    // Update sale
    // --------------------------------------------------

    const [result] = await db.query(
        `
        UPDATE sales
        SET
            customer_id = ?,
            currency_id = ?,
            sale_date = ?,
            invoice_no = ?
        WHERE sale_id = ?
        AND user_id = ?
        `,
        [
            customerId,
            currencyId,
            sale_date,
            invoiceNo,
            saleId,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Sale was not updated.",
            404,
            "SALE_NOT_UPDATED"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Sale updated successfully."
    });
};


// ======================================================
// DELETE SALE
// DELETE /api/sales/:id
// ======================================================

exports.deleteSale = async (req, res) => {

    const userId = req.user.user_id;
    const saleId = Number(req.params.id);

    // --------------------------------------------------
    // Validate sale ID
    // --------------------------------------------------

    if (!Number.isInteger(saleId) || saleId <= 0) {
        throw new AppError(
            "Sale ID must be a valid positive integer.",
            400,
            "INVALID_SALE_ID"
        );
    }

    // --------------------------------------------------
    // Delete sale
    // --------------------------------------------------

    try {

        const [result] = await db.query(
            `
            DELETE FROM sales
            WHERE sale_id = ?
            AND user_id = ?
            `,
            [saleId, userId]
        );

        if (result.affectedRows === 0) {
            throw new AppError(
                "Sale not found.",
                404,
                "SALE_NOT_FOUND"
            );
        }

        return res.status(200).json({
            success: true,
            message: "Sale deleted successfully."
        });

    } catch (error) {

        // Keep AppError for the global handler
        if (error instanceof AppError) {
            throw error;
        }

        // Foreign-key dependency
        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            throw new AppError(
                "Cannot delete this sale because related records exist.",
                409,
                "SALE_IN_USE"
            );
        }

        throw error;
    }
};
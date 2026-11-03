const db = require("../config/database.js");
const AppError = require("../utils/AppError");


// ======================================================
// CREATE PURCHASE
// POST /api/purchases
// ======================================================

exports.createPurchase = async (req, res) => {

    const userId = req.user.user_id;

    const {
        vendor_id,
        currency_id,
        purchase_date,
        invoice_no
    } = req.body;


    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        vendor_id === undefined ||
        vendor_id === null ||
        currency_id === undefined ||
        currency_id === null ||
        purchase_date === undefined ||
        purchase_date === null ||
        purchase_date === "" ||
        invoice_no === undefined ||
        invoice_no === null ||
        invoice_no === ""
    ) {
        throw new AppError(
            "Vendor, currency, purchase date and invoice number are required.",
            400,
            "MISSING_PURCHASE_FIELDS"
        );
    }


    const vendorId = Number(vendor_id);
    const currencyId = Number(currency_id);

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


    if (typeof invoice_no !== "string") {
        throw new AppError(
            "Invoice number must be a valid string.",
            400,
            "INVALID_INVOICE_NUMBER"
        );
    }


    const normalizedInvoiceNo = invoice_no.trim();


    if (normalizedInvoiceNo.length === 0) {
        throw new AppError(
            "Invoice number cannot be empty.",
            400,
            "INVALID_INVOICE_NUMBER"
        );
    }


    // --------------------------------------------------
    // Check vendor belongs to current user
    // --------------------------------------------------

    const [vendor] = await db.query(
        `
        SELECT vendor_id

        FROM vendors

        WHERE vendor_id = ?
          AND user_id = ?
        `,
        [
            vendorId,
            userId
        ]
    );


    if (vendor.length === 0) {
        throw new AppError(
            "Invalid vendor.",
            400,
            "INVALID_VENDOR"
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
        [
            currencyId,
            userId
        ]
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
        SELECT purchase_id

        FROM purchases

        WHERE user_id = ?
          AND invoice_no = ?
        `,
        [
            userId,
            normalizedInvoiceNo
        ]
    );


    if (existingInvoice.length > 0) {
        throw new AppError(
            "Invoice number already exists.",
            409,
            "DUPLICATE_INVOICE_NUMBER"
        );
    }


    // --------------------------------------------------
    // Insert purchase
    // --------------------------------------------------

    const [result] = await db.query(
        `
        INSERT INTO purchases
        (
            user_id,
            vendor_id,
            currency_id,
            purchase_date,
            invoice_no
        )

        VALUES (?, ?, ?, ?, ?)
        `,
        [
            userId,
            vendorId,
            currencyId,
            purchase_date,
            normalizedInvoiceNo
        ]
    );


    return res.status(201).json({
        success: true,
        message: "Purchase created successfully.",
        purchase_id: result.insertId
    });
};


// ======================================================
// GET ALL PURCHASES
// GET /api/purchases
// ======================================================

exports.getPurchases = async (req, res) => {

    const userId = req.user.user_id;


    const [purchases] = await db.query(
        `
        SELECT
            p.purchase_id,
            p.vendor_id,
            v.vendor_name,
            p.currency_id,
            c.currency_name,
            c.currency_code,
            c.symbol,
            p.purchase_date,
            p.invoice_no

        FROM purchases p

        INNER JOIN vendors v
            ON p.vendor_id = v.vendor_id
            AND p.user_id = v.user_id

        INNER JOIN currencies c
            ON p.currency_id = c.currency_id
            AND p.user_id = c.user_id

        WHERE p.user_id = ?

        ORDER BY p.purchase_id DESC
        `,
        [userId]
    );


    return res.status(200).json({
        success: true,
        count: purchases.length,
        data: purchases
    });
};


// ======================================================
// GET PURCHASE BY ID
// GET /api/purchases/:id
// ======================================================

exports.getPurchaseById = async (req, res) => {

    const userId = req.user.user_id;

    const purchaseId = Number(req.params.id);


    // --------------------------------------------------
    // Validate purchase ID
    // --------------------------------------------------

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


    // --------------------------------------------------
    // Get purchase
    // --------------------------------------------------

    const [purchases] = await db.query(
        `
        SELECT
            p.purchase_id,
            p.vendor_id,
            v.vendor_name,
            p.currency_id,
            c.currency_name,
            c.currency_code,
            c.symbol,
            p.purchase_date,
            p.invoice_no

        FROM purchases p

        INNER JOIN vendors v
            ON p.vendor_id = v.vendor_id
            AND p.user_id = v.user_id

        INNER JOIN currencies c
            ON p.currency_id = c.currency_id
            AND p.user_id = c.user_id

        WHERE p.purchase_id = ?
          AND p.user_id = ?
        `,
        [
            purchaseId,
            userId
        ]
    );


    if (purchases.length === 0) {
        throw new AppError(
            "Purchase not found.",
            404,
            "PURCHASE_NOT_FOUND"
        );
    }


    return res.status(200).json({
        success: true,
        data: purchases[0]
    });
};


// ======================================================
// UPDATE PURCHASE
// PUT /api/purchases/:id
// ======================================================

exports.updatePurchase = async (req, res) => {

    const userId = req.user.user_id;

    const purchaseId = Number(req.params.id);

    const {
        vendor_id,
        currency_id,
        purchase_date,
        invoice_no
    } = req.body;


    // --------------------------------------------------
    // Validate purchase ID
    // --------------------------------------------------

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


    // --------------------------------------------------
    // Validate required fields
    // --------------------------------------------------

    if (
        vendor_id === undefined ||
        vendor_id === null ||
        currency_id === undefined ||
        currency_id === null ||
        purchase_date === undefined ||
        purchase_date === null ||
        purchase_date === "" ||
        invoice_no === undefined ||
        invoice_no === null ||
        invoice_no === ""
    ) {
        throw new AppError(
            "Vendor, currency, purchase date and invoice number are required.",
            400,
            "MISSING_PURCHASE_FIELDS"
        );
    }


    const vendorId = Number(vendor_id);
    const currencyId = Number(currency_id);


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


    if (typeof invoice_no !== "string") {
        throw new AppError(
            "Invoice number must be a valid string.",
            400,
            "INVALID_INVOICE_NUMBER"
        );
    }


    const normalizedInvoiceNo = invoice_no.trim();


    if (normalizedInvoiceNo.length === 0) {
        throw new AppError(
            "Invoice number cannot be empty.",
            400,
            "INVALID_INVOICE_NUMBER"
        );
    }


    // --------------------------------------------------
    // Check purchase belongs to current user
    // --------------------------------------------------

    const [existingPurchase] = await db.query(
        `
        SELECT purchase_id

        FROM purchases

        WHERE purchase_id = ?
          AND user_id = ?
        `,
        [
            purchaseId,
            userId
        ]
    );


    if (existingPurchase.length === 0) {
        throw new AppError(
            "Purchase not found.",
            404,
            "PURCHASE_NOT_FOUND"
        );
    }


    // --------------------------------------------------
    // Check vendor
    // --------------------------------------------------

    const [vendor] = await db.query(
        `
        SELECT vendor_id

        FROM vendors

        WHERE vendor_id = ?
          AND user_id = ?
        `,
        [
            vendorId,
            userId
        ]
    );


    if (vendor.length === 0) {
        throw new AppError(
            "Invalid vendor.",
            400,
            "INVALID_VENDOR"
        );
    }


    // --------------------------------------------------
    // Check currency
    // --------------------------------------------------

    const [currency] = await db.query(
        `
        SELECT currency_id

        FROM currencies

        WHERE currency_id = ?
          AND user_id = ?
        `,
        [
            currencyId,
            userId
        ]
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
        SELECT purchase_id

        FROM purchases

        WHERE user_id = ?
          AND invoice_no = ?
          AND purchase_id != ?
        `,
        [
            userId,
            normalizedInvoiceNo,
            purchaseId
        ]
    );


    if (duplicateInvoice.length > 0) {
        throw new AppError(
            "Invoice number already exists.",
            409,
            "DUPLICATE_INVOICE_NUMBER"
        );
    }


    // --------------------------------------------------
    // Update purchase
    // --------------------------------------------------

    const [result] = await db.query(
        `
        UPDATE purchases

        SET
            vendor_id = ?,
            currency_id = ?,
            purchase_date = ?,
            invoice_no = ?

        WHERE purchase_id = ?
          AND user_id = ?
        `,
        [
            vendorId,
            currencyId,
            purchase_date,
            normalizedInvoiceNo,
            purchaseId,
            userId
        ]
    );


    if (result.affectedRows === 0) {
        throw new AppError(
            "Purchase could not be updated.",
            404,
            "PURCHASE_NOT_FOUND"
        );
    }


    return res.status(200).json({
        success: true,
        message: "Purchase updated successfully."
    });
};


// ======================================================
// DELETE PURCHASE
// DELETE /api/purchases/:id
// ======================================================

exports.deletePurchase = async (req, res) => {

    const userId = req.user.user_id;

    const purchaseId = Number(req.params.id);


    // --------------------------------------------------
    // Validate purchase ID
    // --------------------------------------------------

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


    // --------------------------------------------------
    // Delete purchase
    // --------------------------------------------------

    try {

        const [result] = await db.query(
            `
            DELETE FROM purchases

            WHERE purchase_id = ?
              AND user_id = ?
            `,
            [
                purchaseId,
                userId
            ]
        );


        if (result.affectedRows === 0) {
            throw new AppError(
                "Purchase not found.",
                404,
                "PURCHASE_NOT_FOUND"
            );
        }


        return res.status(200).json({
            success: true,
            message: "Purchase deleted successfully."
        });

    } catch (error) {

        // Preserve AppError
        if (error instanceof AppError) {
            throw error;
        }


        // Purchase is referenced by another table
        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            throw new AppError(
                "Cannot delete this purchase because payment or detail records exist for it.",
                409,
                "PURCHASE_IN_USE"
            );
        }


        throw error;
    }
};
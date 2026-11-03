
const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ======================================================
// VALIDATE SALES DETAIL INPUT
// ======================================================

function validateDetailInput(body) {
    const { sale_id, item_id, quantity, unit_price } = body;

    if (
        sale_id === undefined || sale_id === null || sale_id === "" ||
        item_id === undefined || item_id === null || item_id === "" ||
        quantity === undefined || quantity === null || quantity === "" ||
        unit_price === undefined || unit_price === null || unit_price === ""
    ) {
        throw new AppError(
            "Sale, item, quantity and unit price are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    const saleId = Number(sale_id);
    const itemId = Number(item_id);
    const qty = Number(quantity);
    const price = Number(unit_price);

    if (!Number.isSafeInteger(saleId) || saleId <= 0) {
        throw new AppError("Invalid sale ID.", 400, "INVALID_SALE_ID");
    }

    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
        throw new AppError("Invalid item ID.", 400, "INVALID_ITEM_ID");
    }

    if (!Number.isFinite(qty) || qty <= 0) {
        throw new AppError(
            "Quantity must be greater than zero.",
            400,
            "INVALID_QUANTITY"
        );
    }

    if (!Number.isFinite(price) || price < 0) {
        throw new AppError(
            "Unit price must be zero or greater.",
            400,
            "INVALID_UNIT_PRICE"
        );
    }

    return {
        saleId,
        itemId,
        quantity: qty,
        unitPrice: price
    };
}

// ======================================================
// CHECK SALE AND ITEM BELONG TO CURRENT TENANT
// ======================================================

async function validateSaleAndItem(saleId, itemId, userId) {
    const [sales] = await db.query(
        `SELECT sale_id
         FROM sales
         WHERE sale_id = ? AND user_id = ?`,
        [saleId, userId]
    );

    if (sales.length === 0) {
        throw new AppError(
            "Sale not found for this user.",
            404,
            "SALE_NOT_FOUND"
        );
    }

    const [items] = await db.query(
        `SELECT item_id
         FROM items
         WHERE item_id = ? AND user_id = ?`,
        [itemId, userId]
    );

    if (items.length === 0) {
        throw new AppError(
            "Item not found for this user.",
            404,
            "ITEM_NOT_FOUND"
        );
    }
}

// ======================================================
// CREATE SALES DETAIL
// POST /api/sales-details
// ======================================================

exports.createSalesDetail = async (req, res) => {
    const userId = req.user.user_id;

    const {
        saleId,
        itemId,
        quantity,
        unitPrice
    } = validateDetailInput(req.body);

    await validateSaleAndItem(saleId, itemId, userId);

    const [result] = await db.query(
        `INSERT INTO sales_details
            (user_id, sale_id, item_id, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, saleId, itemId, quantity, unitPrice]
    );

    return res.status(201).json({
        success: true,
        message: "Sales detail created successfully.",
        sale_detail_id: result.insertId
    });
};

// ======================================================
// GET ALL SALES DETAILS
// GET /api/sales-details
// Optional query filters: sale_id, item_id
// ======================================================

exports.getSalesDetails = async (req, res) => {
    
    const userId = req.user.user_id;
    const { sale_id, item_id } = req.query;

    const conditions = ["sd.user_id = ?"];
    const params = [userId];

    if (sale_id !== undefined) {
        const saleId = Number(sale_id);

        if (!Number.isSafeInteger(saleId) || saleId <= 0) {
            throw new AppError("Invalid sale ID.", 400, "INVALID_SALE_ID");
        }

        conditions.push("sd.sale_id = ?");
        params.push(saleId);
    }

    if (item_id !== undefined) {
        const itemId = Number(item_id);

        if (!Number.isSafeInteger(itemId) || itemId <= 0) {
            throw new AppError("Invalid item ID.", 400, "INVALID_ITEM_ID");
        }

        conditions.push("sd.item_id = ?");
        params.push(itemId);
    }

    const [details] = await db.query(
        `SELECT
            sd.sale_detail_id,
            sd.sale_id,
            sd.item_id,
            sd.quantity,
            sd.unit_price,
            i.item_name
         FROM sales_details sd
         INNER JOIN items i
            ON i.item_id = sd.item_id
            AND i.user_id = sd.user_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY sd.sale_detail_id DESC`,
        params
    );

    return res.status(200).json({
        success: true,
        count: details.length,
        data: details
    });
};

// ======================================================
// GET SALES DETAIL BY ID
// GET /api/sales-details/:id
// ======================================================

exports.getSalesDetailById = async (req, res) => {
    const userId = req.user.user_id;
    const detailId = Number(req.params.id);

    if (!Number.isSafeInteger(detailId) || detailId <= 0) {
        throw new AppError(
            "Invalid sales detail ID.",
            400,
            "INVALID_SALES_DETAIL_ID"
        );
    }

    const [details] = await db.query(
        `SELECT
            sd.sale_detail_id,
            sd.sale_id,
            sd.item_id,
            sd.quantity,
            sd.unit_price,
            i.item_name
         FROM sales_details sd
         INNER JOIN items i
            ON i.item_id = sd.item_id
            AND i.user_id = sd.user_id
         WHERE sd.sale_detail_id = ?
           AND sd.user_id = ?`,
        [detailId, userId]
    );

    if (details.length === 0) {
        throw new AppError(
            "Sales detail not found.",
            404,
            "SALES_DETAIL_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        data: details[0]
    });
};

// ======================================================
// UPDATE SALES DETAIL
// PUT /api/sales-details/:id
// ======================================================

exports.updateSalesDetail = async (req, res) => {
    const userId = req.user.user_id;
    const detailId = Number(req.params.id);

    if (!Number.isSafeInteger(detailId) || detailId <= 0) {
        throw new AppError(
            "Invalid sales detail ID.",
            400,
            "INVALID_SALES_DETAIL_ID"
        );
    }

    const {
        saleId,
        itemId,
        quantity,
        unitPrice
    } = validateDetailInput(req.body);

    const [existing] = await db.query(
        `SELECT sale_detail_id
         FROM sales_details
         WHERE sale_detail_id = ? AND user_id = ?`,
        [detailId, userId]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Sales detail not found.",
            404,
            "SALES_DETAIL_NOT_FOUND"
        );
    }

    await validateSaleAndItem(saleId, itemId, userId);

    await db.query(
        `UPDATE sales_details
         SET sale_id = ?,
             item_id = ?,
             quantity = ?,
             unit_price = ?
         WHERE sale_detail_id = ?
           AND user_id = ?`,
        [saleId, itemId, quantity, unitPrice, detailId, userId]
    );

    return res.status(200).json({
        success: true,
        message: "Sales detail updated successfully."
    });
};

// ======================================================
// DELETE SALES DETAIL
// DELETE /api/sales-details/:id
// ======================================================

exports.deleteSalesDetail = async (req, res) => {
    const userId = req.user.user_id;
    const detailId = Number(req.params.id);

    if (!Number.isSafeInteger(detailId) || detailId <= 0) {
        throw new AppError(
            "Invalid sales detail ID.",
            400,
            "INVALID_SALES_DETAIL_ID"
        );
    }

    const [result] = await db.query(
        `DELETE FROM sales_details
         WHERE sale_detail_id = ? AND user_id = ?`,
        [detailId, userId]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Sales detail not found.",
            404,
            "SALES_DETAIL_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Sales detail deleted successfully."
    });
};

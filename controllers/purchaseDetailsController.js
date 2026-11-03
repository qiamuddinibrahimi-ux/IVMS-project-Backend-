
const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ======================================================
// VALIDATE PURCHASE DETAIL INPUT
// ======================================================

function validateDetailInput(body) {
    const { purchase_id, item_id, quantity, unit_price } = body;

    if (
        purchase_id === undefined || purchase_id === null || purchase_id === "" ||
        item_id === undefined || item_id === null || item_id === "" ||
        quantity === undefined || quantity === null || quantity === "" ||
        unit_price === undefined || unit_price === null || unit_price === ""
    ) {
        throw new AppError(
            "Purchase, item, quantity and unit price are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    const purchaseId = Number(purchase_id);
    const itemId = Number(item_id);
    const qty = Number(quantity);
    const price = Number(unit_price);

    if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) {
        throw new AppError(
            "Invalid purchase ID.",
            400,
            "INVALID_PURCHASE_ID"
        );
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
        purchaseId,
        itemId,
        quantity: qty,
        unitPrice: price
    };
}

// ======================================================
// CHECK PURCHASE AND ITEM BELONG TO CURRENT TENANT
// ======================================================

async function validatePurchaseAndItem(purchaseId, itemId, userId) {
    const [purchases] = await db.query(
        `SELECT purchase_id
         FROM purchases
         WHERE purchase_id = ? AND user_id = ?`,
        [purchaseId, userId]
    );

    if (purchases.length === 0) {
        throw new AppError(
            "Purchase not found for this user.",
            404,
            "PURCHASE_NOT_FOUND"
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
// CREATE PURCHASE DETAIL
// POST /api/purchase-details
// ======================================================

exports.createPurchaseDetail = async (req, res) => {
    const userId = req.user.user_id;

    const {
        purchaseId,
        itemId,
        quantity,
        unitPrice
    } = validateDetailInput(req.body);

    await validatePurchaseAndItem(purchaseId, itemId, userId);

    const [result] = await db.query(
        `INSERT INTO purchase_details
            (user_id, purchase_id, item_id, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, purchaseId, itemId, quantity, unitPrice]
    );

    return res.status(201).json({
        success: true,
        message: "Purchase detail created successfully.",
        purchase_detail_id: result.insertId
    });
};

// ======================================================
// GET ALL PURCHASE DETAILS
// GET /api/purchase-details
// Optional query filters: purchase_id, item_id
// ======================================================

exports.getPurchaseDetails = async (req, res) => {
    
    const userId = req.user.user_id;
    const { purchase_id, item_id } = req.query;

    const conditions = ["pd.user_id = ?"];
    const params = [userId];

    if (purchase_id !== undefined) {
        const purchaseId = Number(purchase_id);

        if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) {
            throw new AppError(
                "Invalid purchase ID.",
                400,
                "INVALID_PURCHASE_ID"
            );
        }

        conditions.push("pd.purchase_id = ?");
        params.push(purchaseId);
    }

    if (item_id !== undefined) {
        const itemId = Number(item_id);

        if (!Number.isSafeInteger(itemId) || itemId <= 0) {
            throw new AppError("Invalid item ID.", 400, "INVALID_ITEM_ID");
        }

        conditions.push("pd.item_id = ?");
        params.push(itemId);
    }

    const [details] = await db.query(
        `SELECT
            pd.purchase_detail_id,
            pd.purchase_id,
            pd.item_id,
            pd.quantity,
            pd.unit_price,
            i.item_name
         FROM purchase_details pd
         INNER JOIN items i
            ON i.item_id = pd.item_id
            AND i.user_id = pd.user_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY pd.purchase_detail_id DESC`,
        params
    );

    return res.status(200).json({
        success: true,
        count: details.length,
        data: details
    });
};

// ======================================================
// GET PURCHASE DETAIL BY ID
// GET /api/purchase-details/:id
// ======================================================

exports.getPurchaseDetailById = async (req, res) => {
    const userId = req.user.user_id;
    const detailId = Number(req.params.id);

    if (!Number.isSafeInteger(detailId) || detailId <= 0) {
        throw new AppError(
            "Invalid purchase detail ID.",
            400,
            "INVALID_PURCHASE_DETAIL_ID"
        );
    }

    const [details] = await db.query(
        `SELECT
            pd.purchase_detail_id,
            pd.purchase_id,
            pd.item_id,
            pd.quantity,
            pd.unit_price,
            i.item_name
         FROM purchase_details pd
         INNER JOIN items i
            ON i.item_id = pd.item_id
            AND i.user_id = pd.user_id
         WHERE pd.purchase_detail_id = ?
           AND pd.user_id = ?`,
        [detailId, userId]
    );

    if (details.length === 0) {
        throw new AppError(
            "Purchase detail not found.",
            404,
            "PURCHASE_DETAIL_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        data: details[0]
    });
};

// ======================================================
// UPDATE PURCHASE DETAIL
// PUT /api/purchase-details/:id
// ======================================================

exports.updatePurchaseDetail = async (req, res) => {
    const userId = req.user.user_id;
    const detailId = Number(req.params.id);

    if (!Number.isSafeInteger(detailId) || detailId <= 0) {
        throw new AppError(
            "Invalid purchase detail ID.",
            400,
            "INVALID_PURCHASE_DETAIL_ID"
        );
    }

    const {
        purchaseId,
        itemId,
        quantity,
        unitPrice
    } = validateDetailInput(req.body);

    const [existing] = await db.query(
        `SELECT purchase_detail_id
         FROM purchase_details
         WHERE purchase_detail_id = ? AND user_id = ?`,
        [detailId, userId]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Purchase detail not found.",
            404,
            "PURCHASE_DETAIL_NOT_FOUND"
        );
    }

    await validatePurchaseAndItem(purchaseId, itemId, userId);

    await db.query(
        `UPDATE purchase_details
         SET purchase_id = ?,
             item_id = ?,
             quantity = ?,
             unit_price = ?
         WHERE purchase_detail_id = ?
           AND user_id = ?`,
        [purchaseId, itemId, quantity, unitPrice, detailId, userId]
    );

    return res.status(200).json({
        success: true,
        message: "Purchase detail updated successfully."
    });
};

// ======================================================
// DELETE PURCHASE DETAIL
// DELETE /api/purchase-details/:id
// ======================================================

exports.deletePurchaseDetail = async (req, res) => {
    const userId = req.user.user_id;
    const detailId = Number(req.params.id);

    if (!Number.isSafeInteger(detailId) || detailId <= 0) {
        throw new AppError(
            "Invalid purchase detail ID.",
            400,
            "INVALID_PURCHASE_DETAIL_ID"
        );
    }

    const [result] = await db.query(
        `DELETE FROM purchase_details
         WHERE purchase_detail_id = ? AND user_id = ?`,
        [detailId, userId]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Purchase detail not found.",
            404,
            "PURCHASE_DETAIL_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Purchase detail deleted successfully."
    });
};

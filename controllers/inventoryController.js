
const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ======================================================
// INVENTORY CONTROLLER
// Inventory is calculated from stock_movements.
// IN = adds stock; OUT = removes stock.
// Current stock = SUM(IN) - SUM(OUT)
// ======================================================


// ======================================================
// GET COMPLETE INVENTORY
// GET /api/inventory
// ======================================================

exports.getInventory = async (req, res) => {
    const userId = req.user.user_id;

    const [rows] = await db.query(
        `
        SELECT
            i.item_id,
            i.item_name,
            i.barcode,
            i.description,

            c.category_id,
            c.category_name,

            u.unit_id,
            u.unit_name,

            COALESCE(SUM(
                CASE
                    WHEN sm.movement_type = 'IN'
                        THEN sm.quantity
                    WHEN sm.movement_type = 'OUT'
                        THEN -sm.quantity
                    ELSE 0
                END
            ), 0) AS current_stock,

            COALESCE(SUM(
                CASE
                    WHEN sm.movement_type = 'IN'
                        THEN sm.quantity
                    ELSE 0
                END
            ), 0) AS total_stock_in,

            COALESCE(SUM(
                CASE
                    WHEN sm.movement_type = 'OUT'
                        THEN sm.quantity
                    ELSE 0
                END
            ), 0) AS total_stock_out

        FROM items i

        INNER JOIN categories c
            ON c.user_id = i.user_id
           AND c.category_id = i.category_id

        INNER JOIN units u
            ON u.user_id = i.user_id
           AND u.unit_id = i.unit_id

        LEFT JOIN stock_movements sm
            ON sm.user_id = i.user_id
           AND sm.item_id = i.item_id

        WHERE i.user_id = ?

        GROUP BY
            i.item_id,
            i.item_name,
            i.barcode,
            i.description,
            c.category_id,
            c.category_name,
            u.unit_id,
            u.unit_name

        ORDER BY i.item_id DESC
        `,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        data: rows
    });
};


// ======================================================
// GET INVENTORY BY ITEM
// GET /api/inventory/:itemId
// ======================================================

exports.getInventoryByItem = async (req, res) => {
    const userId = req.user.user_id;
    const itemId = Number(req.params.itemId);

    if (!Number.isInteger(itemId) || itemId <= 0) {
        throw new AppError(
            "Item ID must be a valid ID.",
            400,
            "INVALID_ITEM_ID"
        );
    }

    const [items] = await db.query(
        `
        SELECT
            i.item_id,
            i.item_name,
            i.barcode,
            i.description,
            c.category_name,
            u.unit_name

        FROM items i

        INNER JOIN categories c
            ON c.user_id = i.user_id
           AND c.category_id = i.category_id

        INNER JOIN units u
            ON u.user_id = i.user_id
           AND u.unit_id = i.unit_id

        WHERE i.item_id = ?
          AND i.user_id = ?
        `,
        [itemId, userId]
    );

    if (items.length === 0) {
        throw new AppError(
            "Item not found.",
            404,
            "ITEM_NOT_FOUND"
        );
    }

    const [stock] = await db.query(
        `
        SELECT
            COALESCE(SUM(
                CASE
                    WHEN movement_type = 'IN'
                        THEN quantity
                    ELSE 0
                END
            ), 0) AS total_stock_in,

            COALESCE(SUM(
                CASE
                    WHEN movement_type = 'OUT'
                        THEN quantity
                    ELSE 0
                END
            ), 0) AS total_stock_out,

            COALESCE(SUM(
                CASE
                    WHEN movement_type = 'IN'
                        THEN quantity
                    WHEN movement_type = 'OUT'
                        THEN -quantity
                    ELSE 0
                END
            ), 0) AS current_stock

        FROM stock_movements
        WHERE user_id = ?
          AND item_id = ?
        `,
        [userId, itemId]
    );

    return res.status(200).json({
        success: true,
        data: {
            item: items[0],
            stock: stock[0]
        }
    });
};


// ======================================================
// GET INVENTORY SUMMARY
// GET /api/inventory/summary
// ======================================================

exports.getInventorySummary = async (req, res) => {
    const userId = req.user.user_id;

    // Aggregate movements separately to avoid multiplying
    // stock totals when an item has multiple movements.
    const [summary] = await db.query(
        `
        SELECT
            (SELECT COUNT(*)
             FROM items
             WHERE user_id = ?) AS total_items,

            COALESCE((
                SELECT SUM(
                    CASE
                        WHEN movement_type = 'IN' THEN quantity
                        WHEN movement_type = 'OUT' THEN -quantity
                        ELSE 0
                    END
                )
                FROM stock_movements
                WHERE user_id = ?
            ), 0) AS total_current_stock,

            COALESCE((
                SELECT SUM(quantity)
                FROM stock_movements
                WHERE user_id = ?
                  AND movement_type = 'IN'
            ), 0) AS total_stock_in,

            COALESCE((
                SELECT SUM(quantity)
                FROM stock_movements
                WHERE user_id = ?
                  AND movement_type = 'OUT'
            ), 0) AS total_stock_out
        `,
        [userId, userId, userId, userId]
    );

    return res.status(200).json({
        success: true,
        data: summary[0]
    });
};


// ======================================================
// GET LOW / OUT OF STOCK ITEMS
// GET /api/inventory/low-stock?threshold=5
// ======================================================

exports.getLowStockItems = async (req, res) => {
    const userId = req.user.user_id;

    const threshold = req.query.threshold !== undefined
        ? Number(req.query.threshold)
        : 5;

    if (!Number.isFinite(threshold) || threshold < 0) {
        throw new AppError(
            "threshold must be a valid non-negative number.",
            400,
            "INVALID_THRESHOLD"
        );
    }

    const [rows] = await db.query(
        `
        SELECT
            i.item_id,
            i.item_name,
            i.barcode,
            c.category_name,
            u.unit_name,

            COALESCE(SUM(
                CASE
                    WHEN sm.movement_type = 'IN'
                        THEN sm.quantity
                    WHEN sm.movement_type = 'OUT'
                        THEN -sm.quantity
                    ELSE 0
                END
            ), 0) AS current_stock

        FROM items i

        INNER JOIN categories c
            ON c.user_id = i.user_id
           AND c.category_id = i.category_id

        INNER JOIN units u
            ON u.user_id = i.user_id
           AND u.unit_id = i.unit_id

        LEFT JOIN stock_movements sm
            ON sm.user_id = i.user_id
           AND sm.item_id = i.item_id

        WHERE i.user_id = ?

        GROUP BY
            i.item_id,
            i.item_name,
            i.barcode,
            c.category_name,
            u.unit_name

        HAVING current_stock <= ?

        ORDER BY current_stock ASC
        `,
        [userId, threshold]
    );

    return res.status(200).json({
        success: true,
        threshold,
        count: rows.length,
        data: rows
    });
};


// ======================================================
// GET STOCK MOVEMENT HISTORY
// GET /api/inventory/movements
// Optional: item_id, movement_type, source_type
// ======================================================

exports.getStockMovementHistory = async (req, res) => {
    const userId = req.user.user_id;

    const { item_id, movement_type, source_type } = req.query;

    let sql = `
        SELECT
            sm.movement_id,
            sm.item_id,
            i.item_name,
            i.barcode,
            sm.movement_type,
            sm.quantity,
            sm.source_type,
            sm.source_id,
            sm.created_at

        FROM stock_movements sm

        INNER JOIN items i
            ON i.user_id = sm.user_id
           AND i.item_id = sm.item_id

        WHERE sm.user_id = ?
    `;

    const params = [userId];

    if (item_id !== undefined) {
        const itemId = Number(item_id);

        if (!Number.isInteger(itemId) || itemId <= 0) {
            throw new AppError(
                "item_id must be a valid ID.",
                400,
                "INVALID_ITEM_ID"
            );
        }

        sql += " AND sm.item_id = ?";
        params.push(itemId);
    }

    if (movement_type !== undefined) {
        if (!["IN", "OUT"].includes(movement_type)) {
            throw new AppError(
                "movement_type must be IN or OUT.",
                400,
                "INVALID_MOVEMENT_TYPE"
            );
        }

        sql += " AND sm.movement_type = ?";
        params.push(movement_type);
    }

    if (source_type !== undefined) {
        const validSourceTypes = [
            "PURCHASE",
            "SALE",
            "OPENING",
            "ADJUSTMENT",
            "RETURN"
        ];

        if (!validSourceTypes.includes(source_type)) {
            throw new AppError(
                "Invalid source_type.",
                400,
                "INVALID_SOURCE_TYPE"
            );
        }

        sql += " AND sm.source_type = ?";
        params.push(source_type);
    }

    sql += `
        ORDER BY sm.created_at DESC, sm.movement_id DESC
    `;

    const [rows] = await db.query(sql, params);

    return res.status(200).json({
        success: true,
        count: rows.length,
        data: rows
    });
};


// ======================================================
// CREATE INVENTORY ADJUSTMENT
// POST /api/inventory/adjustment
// ======================================================

exports.createAdjustment = async (req, res) => {
    const userId = req.user.user_id;
    const { item_id, movement_type, quantity } = req.body;

    const itemId = Number(item_id);
    const adjustmentQuantity = Number(quantity);

    if (
        item_id === undefined ||
        item_id === null ||
        item_id === "" ||
        !Number.isInteger(itemId) ||
        itemId <= 0
    ) {
        throw new AppError(
            "item_id must be a valid ID.",
            400,
            "INVALID_ITEM_ID"
        );
    }

    if (!["IN", "OUT"].includes(movement_type)) {
        throw new AppError(
            "movement_type must be IN or OUT.",
            400,
            "INVALID_MOVEMENT_TYPE"
        );
    }

    if (
        quantity === undefined ||
        quantity === null ||
        quantity === "" ||
        !Number.isFinite(adjustmentQuantity) ||
        adjustmentQuantity <= 0
    ) {
        throw new AppError(
            "quantity must be greater than 0.",
            400,
            "INVALID_QUANTITY"
        );
    }

    const [items] = await db.query(
        `
        SELECT item_id
        FROM items
        WHERE item_id = ?
          AND user_id = ?
        `,
        [itemId, userId]
    );

    if (items.length === 0) {
        throw new AppError(
            "Item not found.",
            404,
            "ITEM_NOT_FOUND"
        );
    }

    const [result] = await db.query(
        `
        INSERT INTO stock_movements
            (user_id, item_id, movement_type, quantity,
             source_type, source_id)
        VALUES (?, ?, ?, ?, 'ADJUSTMENT', NULL)
        `,
        [userId, itemId, movement_type, adjustmentQuantity]
    );

    return res.status(201).json({
        success: true,
        message: "Inventory adjustment created successfully.",
        movement_id: result.insertId
    });
};


// ======================================================
// UPDATE INVENTORY ADJUSTMENT
// PUT /api/inventory/adjustment/:movementId
// ======================================================

exports.updateAdjustment = async (req, res) => {
    const userId = req.user.user_id;
    const movementId = Number(req.params.movementId);
    const { item_id, movement_type, quantity } = req.body;

    const itemId = Number(item_id);
    const adjustmentQuantity = Number(quantity);

    if (!Number.isInteger(movementId) || movementId <= 0) {
        throw new AppError(
            "Movement ID must be a valid ID.",
            400,
            "INVALID_MOVEMENT_ID"
        );
    }

    if (
        item_id === undefined ||
        item_id === null ||
        item_id === "" ||
        !Number.isInteger(itemId) ||
        itemId <= 0
    ) {
        throw new AppError(
            "item_id must be a valid ID.",
            400,
            "INVALID_ITEM_ID"
        );
    }

    if (!["IN", "OUT"].includes(movement_type)) {
        throw new AppError(
            "movement_type must be IN or OUT.",
            400,
            "INVALID_MOVEMENT_TYPE"
        );
    }

    if (
        quantity === undefined ||
        quantity === null ||
        quantity === "" ||
        !Number.isFinite(adjustmentQuantity) ||
        adjustmentQuantity <= 0
    ) {
        throw new AppError(
            "quantity must be greater than 0.",
            400,
            "INVALID_QUANTITY"
        );
    }

    const [existing] = await db.query(
        `
        SELECT movement_id
        FROM stock_movements
        WHERE movement_id = ?
          AND user_id = ?
          AND source_type = 'ADJUSTMENT'
        `,
        [movementId, userId]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Adjustment not found.",
            404,
            "ADJUSTMENT_NOT_FOUND"
        );
    }

    const [items] = await db.query(
        `
        SELECT item_id
        FROM items
        WHERE item_id = ?
          AND user_id = ?
        `,
        [itemId, userId]
    );

    if (items.length === 0) {
        throw new AppError(
            "Item not found.",
            404,
            "ITEM_NOT_FOUND"
        );
    }

    await db.query(
        `
        UPDATE stock_movements
        SET item_id = ?,
            movement_type = ?,
            quantity = ?
        WHERE movement_id = ?
          AND user_id = ?
          AND source_type = 'ADJUSTMENT'
        `,
        [itemId, movement_type, adjustmentQuantity, movementId, userId]
    );

    return res.status(200).json({
        success: true,
        message: "Inventory adjustment updated successfully."
    });
};


// ======================================================
// DELETE INVENTORY ADJUSTMENT
// DELETE /api/inventory/adjustment/:movementId
// ======================================================

exports.deleteAdjustment = async (req, res) => {
    const userId = req.user.user_id;
    const movementId = Number(req.params.movementId);

    if (!Number.isInteger(movementId) || movementId <= 0) {
        throw new AppError(
            "Movement ID must be a valid ID.",
            400,
            "INVALID_MOVEMENT_ID"
        );
    }

    const [result] = await db.query(
        `
        DELETE FROM stock_movements
        WHERE movement_id = ?
          AND user_id = ?
          AND source_type = 'ADJUSTMENT'
        `,
        [movementId, userId]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Adjustment not found.",
            404,
            "ADJUSTMENT_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Inventory adjustment deleted successfully."
    });
};

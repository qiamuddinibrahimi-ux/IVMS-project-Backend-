const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ======================================================
// STOCK MOVEMENT CONTROLLER
// ======================================================
// Multi-tenant:
// user_id always comes from req.user.user_id
//
// Movement types:
// IN / OUT
//
// Source types:
// PURCHASE / SALE / OPENING / ADJUSTMENT / RETURN
// ======================================================


// ======================================================
// CREATE STOCK MOVEMENT
// POST /api/stock-movements
// ======================================================

exports.createStockMovement = async (req, res) => {

    const userId = req.user.user_id;

    const {
        item_id,
        movement_type,
        quantity,
        source_type,
        source_id
    } = req.body;

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        item_id === undefined ||
        item_id === null ||
        item_id === ""
    ) {
        throw new AppError(
            "item_id is required.",
            400,
            "ITEM_ID_REQUIRED"
        );
    }

    if (!movement_type) {
        throw new AppError(
            "movement_type is required.",
            400,
            "MOVEMENT_TYPE_REQUIRED"
        );
    }

    if (!["IN", "OUT"].includes(movement_type)) {
        throw new AppError(
            "movement_type must be either IN or OUT.",
            400,
            "INVALID_MOVEMENT_TYPE"
        );
    }

    if (
        quantity === undefined ||
        quantity === null ||
        quantity === ""
    ) {
        throw new AppError(
            "quantity is required.",
            400,
            "QUANTITY_REQUIRED"
        );
    }

    const itemId = Number(item_id);
    const movementQuantity = Number(quantity);

    if (!Number.isInteger(itemId) || itemId <= 0) {
        throw new AppError(
            "item_id must be a valid positive integer.",
            400,
            "INVALID_ITEM_ID"
        );
    }

    if (
        !Number.isFinite(movementQuantity) ||
        movementQuantity <= 0
    ) {
        throw new AppError(
            "quantity must be greater than 0.",
            400,
            "INVALID_QUANTITY"
        );
    }

    const validSourceTypes = [
        "PURCHASE",
        "SALE",
        "OPENING",
        "ADJUSTMENT",
        "RETURN"
    ];

    const finalSourceType = source_type || "ADJUSTMENT";

    if (!validSourceTypes.includes(finalSourceType)) {
        throw new AppError(
            "source_type must be PURCHASE, SALE, OPENING, ADJUSTMENT, or RETURN.",
            400,
            "INVALID_SOURCE_TYPE"
        );
    }

    // --------------------------------------------------
    // Check item belongs to current user
    // --------------------------------------------------

    const [items] = await db.query(
        `
        SELECT
            item_id,
            item_name
        FROM items
        WHERE item_id = ?
        AND user_id = ?
        `,
        [itemId, userId]
    );

    if (items.length === 0) {
        throw new AppError(
            "Item not found or does not belong to this user.",
            404,
            "ITEM_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Source ID validation
    // --------------------------------------------------

    let finalSourceId = null;

    if (
        source_id !== undefined &&
        source_id !== null &&
        source_id !== ""
    ) {
        finalSourceId = Number(source_id);

        if (
            !Number.isInteger(finalSourceId) ||
            finalSourceId <= 0
        ) {
            throw new AppError(
                "source_id must be a valid positive integer.",
                400,
                "INVALID_SOURCE_ID"
            );
        }
    }

    if (
        ["PURCHASE", "SALE"].includes(finalSourceType) &&
        finalSourceId === null
    ) {
        throw new AppError(
            `source_id is required for ${finalSourceType}.`,
            400,
            "SOURCE_ID_REQUIRED"
        );
    }

    // --------------------------------------------------
    // Insert
    // --------------------------------------------------

    const [result] = await db.query(
        `
        INSERT INTO stock_movements
        (
            user_id,
            item_id,
            movement_type,
            quantity,
            source_type,
            source_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            userId,
            itemId,
            movement_type,
            movementQuantity,
            finalSourceType,
            finalSourceId
        ]
    );

    // --------------------------------------------------
    // Get created record
    // --------------------------------------------------

    const [rows] = await db.query(
        `
        SELECT
            sm.movement_id,
            sm.user_id,
            sm.item_id,
            i.item_name,
            sm.movement_type,
            sm.quantity,
            sm.source_type,
            sm.source_id,
            sm.created_at
        FROM stock_movements sm

        INNER JOIN items i
            ON i.user_id = sm.user_id
            AND i.item_id = sm.item_id

        WHERE sm.movement_id = ?
        AND sm.user_id = ?
        `,
        [result.insertId, userId]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Stock movement was created but could not be retrieved.",
            500,
            "STOCK_MOVEMENT_RETRIEVAL_FAILED"
        );
    }

    return res.status(201).json({
        success: true,
        message: "Stock movement created successfully.",
        data: rows[0]
    });
};


// ======================================================
// GET ALL STOCK MOVEMENTS
// GET /api/stock-movements
// ======================================================

exports.getStockMovements = async (req, res) => {

    const userId = req.user.user_id;

    const [rows] = await db.query(
        `
        SELECT
            sm.movement_id,
            sm.user_id,
            sm.item_id,
            i.item_name,
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

        ORDER BY
            sm.created_at DESC,
            sm.movement_id DESC
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
// GET STOCK MOVEMENT BY ID
// GET /api/stock-movements/:id
// ======================================================

exports.getStockMovementById = async (req, res) => {

    const userId = req.user.user_id;
    const movementId = Number(req.params.id);

    // --------------------------------------------------
    // Validate movement ID
    // --------------------------------------------------

    if (
        !Number.isInteger(movementId) ||
        movementId <= 0
    ) {
        throw new AppError(
            "Stock movement ID must be a valid positive integer.",
            400,
            "INVALID_MOVEMENT_ID"
        );
    }

    const [rows] = await db.query(
        `
        SELECT
            sm.movement_id,
            sm.user_id,
            sm.item_id,
            i.item_name,
            sm.movement_type,
            sm.quantity,
            sm.source_type,
            sm.source_id,
            sm.created_at

        FROM stock_movements sm

        INNER JOIN items i
            ON i.user_id = sm.user_id
            AND i.item_id = sm.item_id

        WHERE sm.movement_id = ?
        AND sm.user_id = ?
        `,
        [movementId, userId]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Stock movement not found.",
            404,
            "STOCK_MOVEMENT_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        data: rows[0]
    });
};


// ======================================================
// UPDATE STOCK MOVEMENT
// PUT /api/stock-movements/:id
// ======================================================

exports.updateStockMovement = async (req, res) => {

    const userId = req.user.user_id;
    const movementId = Number(req.params.id);

    const {
        item_id,
        movement_type,
        quantity,
        source_type,
        source_id
    } = req.body;

    // --------------------------------------------------
    // Validate movement ID
    // --------------------------------------------------

    if (
        !Number.isInteger(movementId) ||
        movementId <= 0
    ) {
        throw new AppError(
            "Stock movement ID must be a valid positive integer.",
            400,
            "INVALID_MOVEMENT_ID"
        );
    }

    // --------------------------------------------------
    // Check existing movement
    // --------------------------------------------------

    const [existing] = await db.query(
        `
        SELECT movement_id
        FROM stock_movements
        WHERE movement_id = ?
        AND user_id = ?
        `,
        [movementId, userId]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Stock movement not found.",
            404,
            "STOCK_MOVEMENT_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        item_id === undefined ||
        item_id === null ||
        item_id === ""
    ) {
        throw new AppError(
            "item_id is required.",
            400,
            "ITEM_ID_REQUIRED"
        );
    }

    if (!movement_type) {
        throw new AppError(
            "movement_type is required.",
            400,
            "MOVEMENT_TYPE_REQUIRED"
        );
    }

    if (!["IN", "OUT"].includes(movement_type)) {
        throw new AppError(
            "movement_type must be either IN or OUT.",
            400,
            "INVALID_MOVEMENT_TYPE"
        );
    }

    if (
        quantity === undefined ||
        quantity === null ||
        quantity === ""
    ) {
        throw new AppError(
            "quantity is required.",
            400,
            "QUANTITY_REQUIRED"
        );
    }

    const itemId = Number(item_id);
    const movementQuantity = Number(quantity);

    if (!Number.isInteger(itemId) || itemId <= 0) {
        throw new AppError(
            "item_id must be a valid positive integer.",
            400,
            "INVALID_ITEM_ID"
        );
    }

    if (
        !Number.isFinite(movementQuantity) ||
        movementQuantity <= 0
    ) {
        throw new AppError(
            "quantity must be greater than 0.",
            400,
            "INVALID_QUANTITY"
        );
    }

    const validSourceTypes = [
        "PURCHASE",
        "SALE",
        "OPENING",
        "ADJUSTMENT",
        "RETURN"
    ];

    if (
        !source_type ||
        !validSourceTypes.includes(source_type)
    ) {
        throw new AppError(
            "source_type must be PURCHASE, SALE, OPENING, ADJUSTMENT, or RETURN.",
            400,
            "INVALID_SOURCE_TYPE"
        );
    }

    // --------------------------------------------------
    // Check item belongs to user
    // --------------------------------------------------

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
            "Item not found or does not belong to this user.",
            404,
            "ITEM_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Source ID validation
    // --------------------------------------------------

    let finalSourceId = null;

    if (
        source_id !== undefined &&
        source_id !== null &&
        source_id !== ""
    ) {
        finalSourceId = Number(source_id);

        if (
            !Number.isInteger(finalSourceId) ||
            finalSourceId <= 0
        ) {
            throw new AppError(
                "source_id must be a valid positive integer.",
                400,
                "INVALID_SOURCE_ID"
            );
        }
    }

    if (
        ["PURCHASE", "SALE"].includes(source_type) &&
        finalSourceId === null
    ) {
        throw new AppError(
            `source_id is required for ${source_type}.`,
            400,
            "SOURCE_ID_REQUIRED"
        );
    }

    // --------------------------------------------------
    // Update
    // --------------------------------------------------

    const [result] = await db.query(
        `
        UPDATE stock_movements
        SET
            item_id = ?,
            movement_type = ?,
            quantity = ?,
            source_type = ?,
            source_id = ?
        WHERE movement_id = ?
        AND user_id = ?
        `,
        [
            itemId,
            movement_type,
            movementQuantity,
            source_type,
            finalSourceId,
            movementId,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Stock movement was not updated.",
            404,
            "STOCK_MOVEMENT_NOT_UPDATED"
        );
    }

    // --------------------------------------------------
    // Get updated record
    // --------------------------------------------------

    const [rows] = await db.query(
        `
        SELECT
            sm.movement_id,
            sm.user_id,
            sm.item_id,
            i.item_name,
            sm.movement_type,
            sm.quantity,
            sm.source_type,
            sm.source_id,
            sm.created_at

        FROM stock_movements sm

        INNER JOIN items i
            ON i.user_id = sm.user_id
            AND i.item_id = sm.item_id

        WHERE sm.movement_id = ?
        AND sm.user_id = ?
        `,
        [movementId, userId]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Updated stock movement could not be retrieved.",
            500,
            "STOCK_MOVEMENT_RETRIEVAL_FAILED"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Stock movement updated successfully.",
        data: rows[0]
    });
};


// ======================================================
// DELETE STOCK MOVEMENT
// DELETE /api/stock-movements/:id
// ======================================================

exports.deleteStockMovement = async (req, res) => {

    const userId = req.user.user_id;
    const movementId = Number(req.params.id);

    // --------------------------------------------------
    // Validate movement ID
    // --------------------------------------------------

    if (
        !Number.isInteger(movementId) ||
        movementId <= 0
    ) {
        throw new AppError(
            "Stock movement ID must be a valid positive integer.",
            400,
            "INVALID_MOVEMENT_ID"
        );
    }

    // --------------------------------------------------
    // Delete
    // --------------------------------------------------

    const [result] = await db.query(
        `
        DELETE FROM stock_movements
        WHERE movement_id = ?
        AND user_id = ?
        `,
        [movementId, userId]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Stock movement not found.",
            404,
            "STOCK_MOVEMENT_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Stock movement deleted successfully."
    });
};
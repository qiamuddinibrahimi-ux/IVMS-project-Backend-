const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ======================================================
// CREATE ITEM
// POST /api/items
// ======================================================

exports.createItem = async (req, res) => {

    const userId = req.user.user_id;

    const {
        item_name,
        category_id,
        unit_id,
        barcode,
        description
    } = req.body;

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        item_name === undefined ||
        item_name === null ||
        item_name === "" ||
        category_id === undefined ||
        category_id === null ||
        category_id === "" ||
        unit_id === undefined ||
        unit_id === null ||
        unit_id === ""
    ) {
        throw new AppError(
            "Item name, category and unit are required.",
            400,
            "MISSING_ITEM_FIELDS"
        );
    }

    const categoryId = Number(category_id);
    const unitId = Number(unit_id);

    if (
        !Number.isInteger(categoryId) ||
        categoryId <= 0
    ) {
        throw new AppError(
            "Category ID must be a valid ID.",
            400,
            "INVALID_CATEGORY_ID"
        );
    }

    if (
        !Number.isInteger(unitId) ||
        unitId <= 0
    ) {
        throw new AppError(
            "Unit ID must be a valid ID.",
            400,
            "INVALID_UNIT_ID"
        );
    }

    if (
        typeof item_name !== "string" ||
        item_name.trim().length < 2
    ) {
        throw new AppError(
            "Item name must contain at least 2 characters.",
            400,
            "INVALID_ITEM_NAME"
        );
    }

    // --------------------------------------------------
    // Check category belongs to user
    // --------------------------------------------------

    const [category] = await db.query(
        `
        SELECT category_id
        FROM categories
        WHERE category_id = ?
          AND user_id = ?
        `,
        [
            categoryId,
            userId
        ]
    );

    if (category.length === 0) {
        throw new AppError(
            "Invalid category.",
            400,
            "INVALID_CATEGORY"
        );
    }

    // --------------------------------------------------
    // Check unit belongs to user
    // --------------------------------------------------

    const [unit] = await db.query(
        `
        SELECT unit_id
        FROM units
        WHERE unit_id = ?
          AND user_id = ?
        `,
        [
            unitId,
            userId
        ]
    );

    if (unit.length === 0) {
        throw new AppError(
            "Invalid unit.",
            400,
            "INVALID_UNIT"
        );
    }

    // --------------------------------------------------
    // Check barcode
    // --------------------------------------------------

    if (
        barcode !== undefined &&
        barcode !== null &&
        barcode !== ""
    ) {

        const [existingBarcode] = await db.query(
            `
            SELECT item_id
            FROM items
            WHERE user_id = ?
              AND barcode = ?
            `,
            [
                userId,
                barcode
            ]
        );

        if (existingBarcode.length > 0) {
            throw new AppError(
                "Barcode already exists.",
                409,
                "DUPLICATE_BARCODE"
            );
        }
    }

    // --------------------------------------------------
    // Insert item
    // --------------------------------------------------

    const [result] = await db.query(
        `
        INSERT INTO items
        (
            user_id,
            item_name,
            category_id,
            unit_id,
            barcode,
            description
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            userId,
            item_name.trim(),
            categoryId,
            unitId,
            barcode || null,
            description || null
        ]
    );

    return res.status(201).json({
        success: true,
        message: "Item created successfully.",
        item_id: result.insertId
    });
};


// ======================================================
// GET ALL ITEMS
// GET /api/items
// ======================================================

exports.getItems = async (req, res) => {

    const userId = req.user.user_id;

    const [items] = await db.query(
        `
        SELECT
            i.item_id,
            i.item_name,
            i.category_id,
            c.category_name,
            i.unit_id,
            u.unit_name,
            i.barcode,
            i.description

        FROM items i

        INNER JOIN categories c
            ON i.category_id = c.category_id
           AND i.user_id = c.user_id

        INNER JOIN units u
            ON i.unit_id = u.unit_id
           AND i.user_id = u.user_id

        WHERE i.user_id = ?

        ORDER BY i.item_id DESC
        `,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: items.length,
        data: items
    });
};


// ======================================================
// GET ITEM BY ID
// GET /api/items/:id
// ======================================================

exports.getItemById = async (req, res) => {

    const userId = req.user.user_id;
    const itemId = Number(req.params.id);

    // --------------------------------------------------
    // Validate ID
    // --------------------------------------------------

    if (
        !Number.isInteger(itemId) ||
        itemId <= 0
    ) {
        throw new AppError(
            "Item ID must be a valid ID.",
            400,
            "INVALID_ITEM_ID"
        );
    }

    // --------------------------------------------------
    // Get item
    // --------------------------------------------------

    const [items] = await db.query(
        `
        SELECT
            i.item_id,
            i.item_name,
            i.category_id,
            c.category_name,
            i.unit_id,
            u.unit_name,
            i.barcode,
            i.description

        FROM items i

        INNER JOIN categories c
            ON i.category_id = c.category_id
           AND i.user_id = c.user_id

        INNER JOIN units u
            ON i.unit_id = u.unit_id
           AND i.user_id = u.user_id

        WHERE i.item_id = ?
          AND i.user_id = ?
        `,
        [
            itemId,
            userId
        ]
    );

    if (items.length === 0) {
        throw new AppError(
            "Item not found.",
            404,
            "ITEM_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        data: items[0]
    });
};


// ======================================================
// UPDATE ITEM
// PUT /api/items/:id
// ======================================================

exports.updateItem = async (req, res) => {

    const userId = req.user.user_id;
    const itemId = Number(req.params.id);

    const {
        item_name,
        category_id,
        unit_id,
        barcode,
        description
    } = req.body;

    // --------------------------------------------------
    // Validate item ID
    // --------------------------------------------------

    if (
        !Number.isInteger(itemId) ||
        itemId <= 0
    ) {
        throw new AppError(
            "Item ID must be a valid ID.",
            400,
            "INVALID_ITEM_ID"
        );
    }

    // --------------------------------------------------
    // Validate required fields
    // --------------------------------------------------

    if (
        item_name === undefined ||
        item_name === null ||
        item_name === "" ||
        category_id === undefined ||
        category_id === null ||
        category_id === "" ||
        unit_id === undefined ||
        unit_id === null ||
        unit_id === ""
    ) {
        throw new AppError(
            "Item name, category and unit are required.",
            400,
            "MISSING_ITEM_FIELDS"
        );
    }

    if (
        typeof item_name !== "string" ||
        item_name.trim().length < 2
    ) {
        throw new AppError(
            "Item name must contain at least 2 characters.",
            400,
            "INVALID_ITEM_NAME"
        );
    }

    const categoryId = Number(category_id);
    const unitId = Number(unit_id);

    if (
        !Number.isInteger(categoryId) ||
        categoryId <= 0
    ) {
        throw new AppError(
            "Category ID must be a valid ID.",
            400,
            "INVALID_CATEGORY_ID"
        );
    }

    if (
        !Number.isInteger(unitId) ||
        unitId <= 0
    ) {
        throw new AppError(
            "Unit ID must be a valid ID.",
            400,
            "INVALID_UNIT_ID"
        );
    }

    // --------------------------------------------------
    // Check item belongs to user
    // --------------------------------------------------

    const [existingItem] = await db.query(
        `
        SELECT item_id
        FROM items
        WHERE item_id = ?
          AND user_id = ?
        `,
        [
            itemId,
            userId
        ]
    );

    if (existingItem.length === 0) {
        throw new AppError(
            "Item not found.",
            404,
            "ITEM_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Check category belongs to user
    // --------------------------------------------------

    const [category] = await db.query(
        `
        SELECT category_id
        FROM categories
        WHERE category_id = ?
          AND user_id = ?
        `,
        [
            categoryId,
            userId
        ]
    );

    if (category.length === 0) {
        throw new AppError(
            "Invalid category.",
            400,
            "INVALID_CATEGORY"
        );
    }

    // --------------------------------------------------
    // Check unit belongs to user
    // --------------------------------------------------

    const [unit] = await db.query(
        `
        SELECT unit_id
        FROM units
        WHERE unit_id = ?
          AND user_id = ?
        `,
        [
            unitId,
            userId
        ]
    );

    if (unit.length === 0) {
        throw new AppError(
            "Invalid unit.",
            400,
            "INVALID_UNIT"
        );
    }

    // --------------------------------------------------
    // Check duplicate barcode
    // --------------------------------------------------

    if (
        barcode !== undefined &&
        barcode !== null &&
        barcode !== ""
    ) {

        const [duplicateBarcode] = await db.query(
            `
            SELECT item_id
            FROM items
            WHERE user_id = ?
              AND barcode = ?
              AND item_id != ?
            `,
            [
                userId,
                barcode,
                itemId
            ]
        );

        if (duplicateBarcode.length > 0) {
            throw new AppError(
                "Barcode already exists.",
                409,
                "DUPLICATE_BARCODE"
            );
        }
    }

    // --------------------------------------------------
    // Update item
    // --------------------------------------------------

    await db.query(
        `
        UPDATE items
        SET
            item_name = ?,
            category_id = ?,
            unit_id = ?,
            barcode = ?,
            description = ?

        WHERE item_id = ?
          AND user_id = ?
        `,
        [
            item_name.trim(),
            categoryId,
            unitId,
            barcode || null,
            description || null,
            itemId,
            userId
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Item updated successfully."
    });
};


// ======================================================
// DELETE ITEM
// DELETE /api/items/:id
// ======================================================

exports.deleteItem = async (req, res) => {

    const userId = req.user.user_id;
    const itemId = Number(req.params.id);

    // --------------------------------------------------
    // Validate ID
    // --------------------------------------------------

    if (
        !Number.isInteger(itemId) ||
        itemId <= 0
    ) {
        throw new AppError(
            "Item ID must be a valid ID.",
            400,
            "INVALID_ITEM_ID"
        );
    }

    // --------------------------------------------------
    // Delete item
    // --------------------------------------------------

    const [result] = await db.query(
        `
        DELETE FROM items
        WHERE item_id = ?
          AND user_id = ?
        `,
        [
            itemId,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Item not found.",
            404,
            "ITEM_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Item deleted successfully."
    });
};
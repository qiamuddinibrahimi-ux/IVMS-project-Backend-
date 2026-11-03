
const db = require("../config/database.js");

const AppError = require("../utils/AppError");

// ======================================================
// CREATE CATEGORY
// POST /api/categories
// ======================================================

exports.createCategory = async (req, res) => {
    const userId = req.user.user_id;

    const { category_name } = req.body;

    // ==================================================
    // VALIDATE CATEGORY NAME
    // ==================================================

    if (
        !category_name ||
        typeof category_name !== "string" ||
        category_name.trim() === ""
    ) {
        throw new AppError(
            "Category name is required.",
            400,
            "CATEGORY_NAME_REQUIRED"
        );
    }

    const name = category_name.trim();

    if (name.length < 2) {
        throw new AppError(
            "Category name must contain at least 2 characters.",
            400,
            "INVALID_CATEGORY_NAME"
        );
    }

    // ==================================================
    // CHECK DUPLICATE CATEGORY
    // ==================================================

    const [existing] = await db.query(
        `SELECT category_id
         FROM categories
         WHERE user_id = ?
         AND category_name = ?`,
        [userId, name]
    );

    if (existing.length > 0) {
        throw new AppError(
            "Category already exists.",
            409,
            "CATEGORY_ALREADY_EXISTS"
        );
    }

    // ==================================================
    // INSERT CATEGORY
    // ==================================================

    const [result] = await db.query(
        `INSERT INTO categories
            (user_id, category_name)
         VALUES (?, ?)`,
        [
            userId,
            name
        ]
    );

    // ==================================================
    // GET CREATED CATEGORY
    // ==================================================

    const [rows] = await db.query(
        `SELECT
            category_id,
            category_name
         FROM categories
         WHERE category_id = ?
         AND user_id = ?`,
        [
            result.insertId,
            userId
        ]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Category was created but could not be retrieved.",
            500,
            "CATEGORY_CREATION_ERROR"
        );
    }

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(201).json({
        success: true,
        message: "Category created successfully.",
        category: rows[0]
    });
};

// ======================================================
// GET ALL CATEGORIES
// GET /api/categories
// ======================================================

exports.getCategories = async (req, res) => {
    const userId = req.user.user_id;

    const [rows] = await db.query(
        `SELECT
            category_id,
            category_name
         FROM categories
         WHERE user_id = ?
         ORDER BY category_id DESC`,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        categories: rows
    });
};

// ======================================================
// GET CATEGORY BY ID
// GET /api/categories/:id
// ======================================================

exports.getCategoryById = async (req, res) => {
    const userId = req.user.user_id;

    const categoryId = Number(req.params.id);

    // ==================================================
    // VALIDATE ID
    // ==================================================

    if (
        !Number.isInteger(categoryId) ||
        categoryId <= 0
    ) {
        throw new AppError(
            "Category ID must be a valid positive integer.",
            400,
            "INVALID_CATEGORY_ID"
        );
    }

    // ==================================================
    // FIND CATEGORY
    // ==================================================

    const [rows] = await db.query(
        `SELECT
            category_id,
            category_name
         FROM categories
         WHERE category_id = ?
         AND user_id = ?`,
        [
            categoryId,
            userId
        ]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Category not found.",
            404,
            "CATEGORY_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        category: rows[0]
    });
};

// ======================================================
// UPDATE CATEGORY
// PUT /api/categories/:id
// ======================================================

exports.updateCategory = async (req, res) => {
    const userId = req.user.user_id;

    const categoryId = Number(req.params.id);

    const { category_name } = req.body;

    // ==================================================
    // VALIDATE ID
    // ==================================================

    if (
        !Number.isInteger(categoryId) ||
        categoryId <= 0
    ) {
        throw new AppError(
            "Category ID must be a valid positive integer.",
            400,
            "INVALID_CATEGORY_ID"
        );
    }

    // ==================================================
    // VALIDATE CATEGORY NAME
    // ==================================================

    if (
        !category_name ||
        typeof category_name !== "string" ||
        category_name.trim() === ""
    ) {
        throw new AppError(
            "Category name is required.",
            400,
            "CATEGORY_NAME_REQUIRED"
        );
    }

    const name = category_name.trim();

    if (name.length < 2) {
        throw new AppError(
            "Category name must contain at least 2 characters.",
            400,
            "INVALID_CATEGORY_NAME"
        );
    }

    // ==================================================
    // FIND EXISTING CATEGORY
    // ==================================================

    const [existing] = await db.query(
        `SELECT category_id
         FROM categories
         WHERE category_id = ?
         AND user_id = ?`,
        [
            categoryId,
            userId
        ]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Category not found.",
            404,
            "CATEGORY_NOT_FOUND"
        );
    }

    // ==================================================
    // CHECK DUPLICATE CATEGORY NAME
    // ==================================================

    const [duplicate] = await db.query(
        `SELECT category_id
         FROM categories
         WHERE user_id = ?
         AND category_name = ?
         AND category_id != ?`,
        [
            userId,
            name,
            categoryId
        ]
    );

    if (duplicate.length > 0) {
        throw new AppError(
            "Another category with this name already exists.",
            409,
            "CATEGORY_ALREADY_EXISTS"
        );
    }

    // ==================================================
    // UPDATE CATEGORY
    // ==================================================

    await db.query(
        `UPDATE categories
         SET category_name = ?
         WHERE category_id = ?
         AND user_id = ?`,
        [
            name,
            categoryId,
            userId
        ]
    );

    // ==================================================
    // GET UPDATED CATEGORY
    // ==================================================

    const [rows] = await db.query(
        `SELECT
            category_id,
            category_name
         FROM categories
         WHERE category_id = ?
         AND user_id = ?`,
        [
            categoryId,
            userId
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Category updated successfully.",
        category: rows[0]
    });
};

// ======================================================
// DELETE CATEGORY
// DELETE /api/categories/:id
// ======================================================

exports.deleteCategory = async (req, res) => {
    const userId = req.user.user_id;

    const categoryId = Number(req.params.id);

    // ==================================================
    // VALIDATE ID
    // ==================================================

    if (
        !Number.isInteger(categoryId) ||
        categoryId <= 0
    ) {
        throw new AppError(
            "Category ID must be a valid positive integer.",
            400,
            "INVALID_CATEGORY_ID"
        );
    }

    // ==================================================
    // CHECK CATEGORY EXISTS
    // ==================================================

    const [existing] = await db.query(
        `SELECT category_id
         FROM categories
         WHERE category_id = ?
         AND user_id = ?`,
        [
            categoryId,
            userId
        ]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Category not found.",
            404,
            "CATEGORY_NOT_FOUND"
        );
    }

    // ==================================================
    // DELETE CATEGORY
    // ==================================================

    const [result] = await db.query(
        `DELETE FROM categories
         WHERE category_id = ?
         AND user_id = ?`,
        [
            categoryId,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Category not found.",
            404,
            "CATEGORY_NOT_FOUND"
        );
    }

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
        success: true,
        message: "Category deleted successfully."
    });
};

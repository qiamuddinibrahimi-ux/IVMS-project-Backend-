const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ======================================================
// CREATE UNIT
// POST /api/units
// ======================================================

exports.createUnit = async (req, res) => {

    const userId = req.user.user_id;
    const { unit_name } = req.body;

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (
        unit_name === undefined ||
        unit_name === null ||
        String(unit_name).trim() === ""
    ) {
        throw new AppError(
            "Unit name is required.",
            400,
            "UNIT_NAME_REQUIRED"
        );
    }

    const name = String(unit_name).trim();

    if (name.length < 1) {
        throw new AppError(
            "Unit name is required.",
            400,
            "UNIT_NAME_REQUIRED"
        );
    }

    // --------------------------------------------------
    // Check duplicate unit
    // --------------------------------------------------

    const [existing] = await db.query(
        `
        SELECT unit_id
        FROM units
        WHERE user_id = ?
        AND unit_name = ?
        `,
        [userId, name]
    );

    if (existing.length > 0) {
        throw new AppError(
            "Unit already exists.",
            409,
            "DUPLICATE_UNIT"
        );
    }

    // --------------------------------------------------
    // Insert unit
    // --------------------------------------------------

    const [result] = await db.query(
        `
        INSERT INTO units
        (
            user_id,
            unit_name
        )
        VALUES (?, ?)
        `,
        [userId, name]
    );

    // --------------------------------------------------
    // Get created unit
    // --------------------------------------------------

    const [rows] = await db.query(
        `
        SELECT
            unit_id,
            unit_name
        FROM units
        WHERE unit_id = ?
        AND user_id = ?
        `,
        [result.insertId, userId]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Unit was created but could not be retrieved.",
            500,
            "UNIT_RETRIEVAL_FAILED"
        );
    }

    return res.status(201).json({
        success: true,
        message: "Unit created successfully.",
        unit: rows[0]
    });
};


// ======================================================
// GET ALL UNITS
// GET /api/units
// ======================================================

exports.getUnits = async (req, res) => {

    const userId = req.user.user_id;

    const [rows] = await db.query(
        `
        SELECT
            unit_id,
            unit_name
        FROM units
        WHERE user_id = ?
        ORDER BY unit_id DESC
        `,
        [userId]
    );

    return res.status(200).json({
        success: true,
        count: rows.length,
        units: rows
    });
};


// ======================================================
// GET UNIT BY ID
// GET /api/units/:id
// ======================================================

exports.getUnitById = async (req, res) => {

    const userId = req.user.user_id;
    const unitId = Number(req.params.id);

    // --------------------------------------------------
    // Validate unit ID
    // --------------------------------------------------

    if (!Number.isInteger(unitId) || unitId <= 0) {
        throw new AppError(
            "Unit ID must be a valid positive integer.",
            400,
            "INVALID_UNIT_ID"
        );
    }

    const [rows] = await db.query(
        `
        SELECT
            unit_id,
            unit_name
        FROM units
        WHERE unit_id = ?
        AND user_id = ?
        `,
        [unitId, userId]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Unit not found.",
            404,
            "UNIT_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        unit: rows[0]
    });
};


// ======================================================
// UPDATE UNIT
// PUT /api/units/:id
// ======================================================

exports.updateUnit = async (req, res) => {

    const userId = req.user.user_id;
    const unitId = Number(req.params.id);

    const { unit_name } = req.body;

    // --------------------------------------------------
    // Validate unit ID
    // --------------------------------------------------

    if (!Number.isInteger(unitId) || unitId <= 0) {
        throw new AppError(
            "Unit ID must be a valid positive integer.",
            400,
            "INVALID_UNIT_ID"
        );
    }

    // --------------------------------------------------
    // Validate unit name
    // --------------------------------------------------

    if (
        unit_name === undefined ||
        unit_name === null ||
        String(unit_name).trim() === ""
    ) {
        throw new AppError(
            "Unit name is required.",
            400,
            "UNIT_NAME_REQUIRED"
        );
    }

    const name = String(unit_name).trim();

    // --------------------------------------------------
    // Check unit exists and belongs to user
    // --------------------------------------------------

    const [existing] = await db.query(
        `
        SELECT unit_id
        FROM units
        WHERE unit_id = ?
        AND user_id = ?
        `,
        [unitId, userId]
    );

    if (existing.length === 0) {
        throw new AppError(
            "Unit not found.",
            404,
            "UNIT_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Check duplicate name
    // --------------------------------------------------

    const [duplicate] = await db.query(
        `
        SELECT unit_id
        FROM units
        WHERE user_id = ?
        AND unit_name = ?
        AND unit_id != ?
        `,
        [userId, name, unitId]
    );

    if (duplicate.length > 0) {
        throw new AppError(
            "Another unit with this name already exists.",
            409,
            "DUPLICATE_UNIT"
        );
    }

    // --------------------------------------------------
    // Update unit
    // --------------------------------------------------

    const [result] = await db.query(
        `
        UPDATE units
        SET unit_name = ?
        WHERE unit_id = ?
        AND user_id = ?
        `,
        [name, unitId, userId]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Unit was not updated.",
            404,
            "UNIT_NOT_UPDATED"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Unit updated successfully."
    });
};


// ======================================================
// DELETE UNIT
// DELETE /api/units/:id
// ======================================================

exports.deleteUnit = async (req, res) => {

    const userId = req.user.user_id;
    const unitId = Number(req.params.id);

    // --------------------------------------------------
    // Validate unit ID
    // --------------------------------------------------

    if (!Number.isInteger(unitId) || unitId <= 0) {
        throw new AppError(
            "Unit ID must be a valid positive integer.",
            400,
            "INVALID_UNIT_ID"
        );
    }

    // --------------------------------------------------
    // Delete unit
    // --------------------------------------------------

    try {

        const [result] = await db.query(
            `
            DELETE FROM units
            WHERE unit_id = ?
            AND user_id = ?
            `,
            [unitId, userId]
        );

        if (result.affectedRows === 0) {
            throw new AppError(
                "Unit not found.",
                404,
                "UNIT_NOT_FOUND"
            );
        }

        return res.status(200).json({
            success: true,
            message: "Unit deleted successfully."
        });

    } catch (error) {

        if (error instanceof AppError) {
            throw error;
        }

        // Unit may be referenced by items
        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            throw new AppError(
                "Unit cannot be deleted because it is being used by another record.",
                409,
                "UNIT_IN_USE"
            );
        }

        throw error;
    }
};
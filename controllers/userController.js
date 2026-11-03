const db = require("../config/database.js");
const bcrypt = require("bcryptjs");
const AppError = require("../utils/AppError");

// ======================================================
// GET CURRENT USER
// GET /api/users/me
// ======================================================

exports.getMe = async (req, res) => {

    const userId = req.user.user_id;

    const [users] = await db.query(
        `
        SELECT
            user_id,
            name,
            email,
            is_active,
            created_at,
            updated_at,
            last_login_at
        FROM users
        WHERE user_id = ?
        `,
        [userId]
    );

    if (users.length === 0) {
        throw new AppError(
            "User not found.",
            404,
            "USER_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        user: users[0]
    });
};


// ======================================================
// UPDATE CURRENT USER
// PUT /api/users/me
// ======================================================

exports.updateMe = async (req, res) => {

    const userId = req.user.user_id;

    const { name, email } = req.body;

    // --------------------------------------------------
    // Validate input
    // --------------------------------------------------

    if (
        (name === undefined || name === null || String(name).trim() === "") &&
        (email === undefined || email === null || String(email).trim() === "")
    ) {
        throw new AppError(
            "Provide name or email to update.",
            400,
            "UPDATE_FIELDS_REQUIRED"
        );
    }

    let normalizedName = null;
    let normalizedEmail = null;

    // --------------------------------------------------
    // Validate name
    // --------------------------------------------------

    if (name !== undefined && name !== null) {

        normalizedName = String(name).trim();

        if (normalizedName === "") {
            throw new AppError(
                "Name cannot be empty.",
                400,
                "INVALID_NAME"
            );
        }

        if (normalizedName.length < 2) {
            throw new AppError(
                "Name must contain at least 2 characters.",
                400,
                "INVALID_NAME"
            );
        }
    }

    // --------------------------------------------------
    // Validate email
    // --------------------------------------------------

    if (email !== undefined && email !== null) {

        normalizedEmail = String(email).trim().toLowerCase();

        if (normalizedEmail === "") {
            throw new AppError(
                "Email cannot be empty.",
                400,
                "INVALID_EMAIL"
            );
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            throw new AppError(
                "Please provide a valid email address.",
                400,
                "INVALID_EMAIL"
            );
        }

        // --------------------------------------------------
        // Check duplicate email
        // --------------------------------------------------

        const [existing] = await db.query(
            `
            SELECT user_id
            FROM users
            WHERE email = ?
            AND user_id != ?
            `,
            [
                normalizedEmail,
                userId
            ]
        );

        if (existing.length > 0) {
            throw new AppError(
                "Email is already used by another account.",
                409,
                "EMAIL_ALREADY_EXISTS"
            );
        }
    }

    // --------------------------------------------------
    // Update profile
    // --------------------------------------------------

    const [result] = await db.query(
        `
        UPDATE users
        SET
            name = COALESCE(?, name),
            email = COALESCE(?, email)
        WHERE user_id = ?
        `,
        [
            normalizedName,
            normalizedEmail,
            userId
        ]
    );

    if (result.affectedRows === 0) {

        const [checkUser] = await db.query(
            `
            SELECT user_id
            FROM users
            WHERE user_id = ?
            `,
            [userId]
        );

        if (checkUser.length === 0) {
            throw new AppError(
                "User not found.",
                404,
                "USER_NOT_FOUND"
            );
        }
    }

    // --------------------------------------------------
    // Get updated user
    // --------------------------------------------------

    const [users] = await db.query(
        `
        SELECT
            user_id,
            name,
            email,
            is_active,
            created_at,
            updated_at,
            last_login_at
        FROM users
        WHERE user_id = ?
        `,
        [userId]
    );

    if (users.length === 0) {
        throw new AppError(
            "Updated user could not be retrieved.",
            500,
            "USER_RETRIEVAL_FAILED"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        user: users[0]
    });
};


// ======================================================
// CHANGE PASSWORD
// PUT /api/users/me/password
// ======================================================

exports.changePassword = async (req, res) => {

    const userId = req.user.user_id;

    const {
        currentPassword,
        newPassword
    } = req.body;

    // --------------------------------------------------
    // Validate required fields
    // --------------------------------------------------

    if (!currentPassword || !newPassword) {
        throw new AppError(
            "Current password and new password are required.",
            400,
            "PASSWORD_FIELDS_REQUIRED"
        );
    }

    // --------------------------------------------------
    // Validate new password
    // --------------------------------------------------

    if (typeof newPassword !== "string") {
        throw new AppError(
            "New password must be a string.",
            400,
            "INVALID_PASSWORD"
        );
    }

    if (newPassword.length < 8) {
        throw new AppError(
            "New password must contain at least 8 characters.",
            400,
            "WEAK_PASSWORD"
        );
    }

    // --------------------------------------------------
    // Get current password
    // --------------------------------------------------

    const [users] = await db.query(
        `
        SELECT password_hash
        FROM users
        WHERE user_id = ?
        `,
        [userId]
    );

    if (users.length === 0) {
        throw new AppError(
            "User not found.",
            404,
            "USER_NOT_FOUND"
        );
    }

    const user = users[0];

    // --------------------------------------------------
    // Compare passwords
    // --------------------------------------------------

    const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.password_hash
    );

    if (!passwordMatch) {
        throw new AppError(
            "Current password is incorrect.",
            401,
            "INVALID_CURRENT_PASSWORD"
        );
    }

    // --------------------------------------------------
    // Hash new password
    // --------------------------------------------------

    const newPasswordHash = await bcrypt.hash(
        newPassword,
        12
    );

    // --------------------------------------------------
    // Update password
    // --------------------------------------------------

    await db.query(
        `
        UPDATE users
        SET password_hash = ?
        WHERE user_id = ?
        `,
        [
            newPasswordHash,
            userId
        ]
    );

    // --------------------------------------------------
    // Revoke all refresh tokens
    // --------------------------------------------------

    await db.query(
        `
        DELETE FROM refresh_tokens
        WHERE user_id = ?
        `,
        [userId]
    );

    return res.status(200).json({
        success: true,
        message: "Password changed successfully. Please login again."
    });
};


// ======================================================
// DEACTIVATE ACCOUNT
// PATCH /api/users/me/deactivate
// ======================================================

exports.deactivateAccount = async (req, res) => {

    const userId = req.user.user_id;

    // --------------------------------------------------
    // Check user exists
    // --------------------------------------------------

    const [users] = await db.query(
        `
        SELECT user_id, is_active
        FROM users
        WHERE user_id = ?
        `,
        [userId]
    );

    if (users.length === 0) {
        throw new AppError(
            "User not found.",
            404,
            "USER_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Deactivate account
    // --------------------------------------------------

    await db.query(
        `
        UPDATE users
        SET is_active = 0
        WHERE user_id = ?
        `,
        [userId]
    );

    // --------------------------------------------------
    // Remove refresh tokens
    // --------------------------------------------------

    await db.query(
        `
        DELETE FROM refresh_tokens
        WHERE user_id = ?
        `,
        [userId]
    );

    return res.status(200).json({
        success: true,
        message: "Account deactivated successfully."
    });
};


// ======================================================
// DELETE ACCOUNT
// DELETE /api/users/me
// ======================================================

exports.deleteAccount = async (req, res) => {

    const userId = req.user.user_id;

    try {

        // --------------------------------------------------
        // Delete account
        // --------------------------------------------------

        const [result] = await db.query(
            `
            DELETE FROM users
            WHERE user_id = ?
            `,
            [userId]
        );

        if (result.affectedRows === 0) {
            throw new AppError(
                "User not found.",
                404,
                "USER_NOT_FOUND"
            );
        }

        return res.status(200).json({
            success: true,
            message: "Account deleted successfully."
        });

    } catch (error) {

        // Preserve our AppError
        if (error instanceof AppError) {
            throw error;
        }

        // --------------------------------------------------
        // Foreign key protection
        // --------------------------------------------------

        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            throw new AppError(
                "Account cannot be deleted because it has related records.",
                409,
                "USER_HAS_RELATED_RECORDS"
            );
        }

        throw error;
    }
};
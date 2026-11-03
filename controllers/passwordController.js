const db = require("../config/database.js");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const AppError = require("../utils/AppError");

// ======================================================
// Helper: Create Reset Token
// ======================================================

function createResetToken() {

    return crypto
        .randomBytes(48)
        .toString("hex");
}


// ======================================================
// Helper: Hash Reset Token
// ======================================================

function hashResetToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


// ======================================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// ======================================================

exports.forgotPassword = async (req, res) => {

    const { email } = req.body;

    // --------------------------------------------------
    // Validate email
    // --------------------------------------------------

    if (
        email === undefined ||
        email === null ||
        email === ""
    ) {
        throw new AppError(
            "Email is required.",
            400,
            "EMAIL_REQUIRED"
        );
    }

    if (typeof email !== "string") {
        throw new AppError(
            "Email must be a valid string.",
            400,
            "INVALID_EMAIL"
        );
    }

    const normalizedEmail = email
        .trim()
        .toLowerCase();

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
    // Find user
    // --------------------------------------------------

    const [users] = await db.query(
        `
        SELECT
            user_id,
            email,
            is_active

        FROM users

        WHERE email = ?
        `,
        [normalizedEmail]
    );

    // --------------------------------------------------
    // Security:
    // Do not reveal whether email exists
    // --------------------------------------------------

    if (users.length === 0) {

        return res.status(200).json({
            success: true,
            message:
                "If the account exists, a password reset link will be generated."
        });
    }

    const user = users[0];

    if (!user.is_active) {

        return res.status(200).json({
            success: true,
            message:
                "If the account exists, a password reset link will be generated."
        });
    }

    // --------------------------------------------------
    // Remove previous unused tokens
    // --------------------------------------------------

    await db.query(
        `
        DELETE FROM password_reset_tokens

        WHERE user_id = ?
          AND used_at IS NULL
        `,
        [user.user_id]
    );

    // --------------------------------------------------
    // Create reset token
    // --------------------------------------------------

    const resetToken = createResetToken();

    const tokenHash = hashResetToken(resetToken);

    // Token valid for 15 minutes
    const expiresAt = new Date(
        Date.now() + 15 * 60 * 1000
    );

    // --------------------------------------------------
    // Store hashed token
    // --------------------------------------------------

    await db.query(
        `
        INSERT INTO password_reset_tokens
        (
            user_id,
            token_hash,
            expires_at
        )

        VALUES (?, ?, ?)
        `,
        [
            user.user_id,
            tokenHash,
            expiresAt
        ]
    );

    /*
     * DEVELOPMENT ONLY
     *
     * Later this token should be sent
     * through email.
     */

    return res.status(200).json({
        success: true,
        message: "Password reset token generated.",

        // REMOVE THIS IN PRODUCTION
        resetToken: resetToken
    });
};


// ======================================================
// VALIDATE RESET TOKEN
// POST /api/auth/validate-reset-token
// ======================================================

exports.validateResetToken = async (req, res) => {

    const { resetToken } = req.body;

    // --------------------------------------------------
    // Validate token
    // --------------------------------------------------

    if (
        resetToken === undefined ||
        resetToken === null ||
        resetToken === ""
    ) {
        throw new AppError(
            "Reset token is required.",
            400,
            "RESET_TOKEN_REQUIRED"
        );
    }

    if (typeof resetToken !== "string") {
        throw new AppError(
            "Reset token must be a valid string.",
            400,
            "INVALID_RESET_TOKEN"
        );
    }

    const tokenHash = hashResetToken(resetToken);

    // --------------------------------------------------
    // Find token
    // --------------------------------------------------

    const [tokens] = await db.query(
        `
        SELECT
            reset_token_id,
            user_id,
            expires_at,
            used_at

        FROM password_reset_tokens

        WHERE token_hash = ?
        `,
        [tokenHash]
    );

    if (tokens.length === 0) {
        throw new AppError(
            "Invalid reset token.",
            400,
            "INVALID_RESET_TOKEN"
        );
    }

    const token = tokens[0];

    // --------------------------------------------------
    // Check used token
    // --------------------------------------------------

    if (token.used_at !== null) {
        throw new AppError(
            "Reset token has already been used.",
            400,
            "RESET_TOKEN_USED"
        );
    }

    // --------------------------------------------------
    // Check expiration
    // --------------------------------------------------

    if (new Date(token.expires_at) < new Date()) {
        throw new AppError(
            "Reset token has expired.",
            400,
            "RESET_TOKEN_EXPIRED"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Reset token is valid."
    });
};


// ======================================================
// RESET PASSWORD
// POST /api/auth/reset-password
// ======================================================

exports.resetPassword = async (req, res) => {

    const {
        resetToken,
        newPassword
    } = req.body;

    // --------------------------------------------------
    // Validate required fields
    // --------------------------------------------------

    if (
        resetToken === undefined ||
        resetToken === null ||
        resetToken === "" ||
        newPassword === undefined ||
        newPassword === null ||
        newPassword === ""
    ) {
        throw new AppError(
            "Reset token and new password are required.",
            400,
            "MISSING_RESET_FIELDS"
        );
    }

    // --------------------------------------------------
    // Validate password
    // --------------------------------------------------

    if (typeof newPassword !== "string") {
        throw new AppError(
            "New password must be a valid string.",
            400,
            "INVALID_PASSWORD"
        );
    }

    if (newPassword.length < 6) {
        throw new AppError(
            "Password must contain at least 6 characters.",
            400,
            "WEAK_PASSWORD"
        );
    }

    if (typeof resetToken !== "string") {
        throw new AppError(
            "Reset token must be a valid string.",
            400,
            "INVALID_RESET_TOKEN"
        );
    }

    const tokenHash = hashResetToken(resetToken);

    // --------------------------------------------------
    // Find reset token
    // --------------------------------------------------

    const [tokens] = await db.query(
        `
        SELECT
            reset_token_id,
            user_id,
            expires_at,
            used_at

        FROM password_reset_tokens

        WHERE token_hash = ?
        `,
        [tokenHash]
    );

    if (tokens.length === 0) {
        throw new AppError(
            "Invalid reset token.",
            400,
            "INVALID_RESET_TOKEN"
        );
    }

    const token = tokens[0];

    // --------------------------------------------------
    // Check if already used
    // --------------------------------------------------

    if (token.used_at !== null) {
        throw new AppError(
            "Reset token has already been used.",
            400,
            "RESET_TOKEN_USED"
        );
    }

    // --------------------------------------------------
    // Check expiration
    // --------------------------------------------------

    if (new Date(token.expires_at) < new Date()) {
        throw new AppError(
            "Reset token has expired.",
            400,
            "RESET_TOKEN_EXPIRED"
        );
    }

    // --------------------------------------------------
    // Hash new password
    // --------------------------------------------------

    const passwordHash = await bcrypt.hash(
        newPassword,
        12
    );

    // --------------------------------------------------
    // Update password
    // --------------------------------------------------

    const [passwordResult] = await db.query(
        `
        UPDATE users

        SET password_hash = ?

        WHERE user_id = ?
        `,
        [
            passwordHash,
            token.user_id
        ]
    );

    if (passwordResult.affectedRows === 0) {
        throw new AppError(
            "User account could not be updated.",
            404,
            "USER_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Mark reset token as used
    // --------------------------------------------------

    await db.query(
        `
        UPDATE password_reset_tokens

        SET used_at = CURRENT_TIMESTAMP

        WHERE reset_token_id = ?
        `,
        [token.reset_token_id]
    );

    // --------------------------------------------------
    // Revoke all refresh tokens
    // --------------------------------------------------

    await db.query(
        `
        DELETE FROM refresh_tokens

        WHERE user_id = ?
        `,
        [token.user_id]
    );

    return res.status(200).json({
        success: true,
        message:
            "Password reset successfully. Please login again."
    });
};


// ======================================================
// CLEAN EXPIRED RESET TOKENS
//
// Can later be used by a scheduled job.
// ======================================================

exports.cleanupResetTokens = async (req, res) => {

    const [result] = await db.query(
        `
        DELETE FROM password_reset_tokens

        WHERE expires_at < CURRENT_TIMESTAMP
           OR used_at IS NOT NULL
        `
    );

    return res.status(200).json({
        success: true,
        message: "Expired reset tokens cleaned.",
        deletedTokens: result.affectedRows
    });
};
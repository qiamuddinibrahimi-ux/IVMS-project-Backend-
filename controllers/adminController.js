const db = require("../config/database.js");

const jwt = require("jsonwebtoken");

const AppError = require("../utils/AppError");

// ======================================================
// Helper: Create Admin Access Token
// ======================================================

function createAdminToken(admin) {
    return jwt.sign(
        {
            admin_id: admin.admin_id,
            email: admin.email,
            type: "admin"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "15m"
        }
    );
}

// ======================================================
// GET ALL NORMAL USERS
// GET /api/admin/users
// ======================================================

exports.getAllUsers = async (req, res) => {

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
        ORDER BY user_id DESC
        `
    );

    return res.status(200).json({
        success: true,
        count: users.length,
        users
    });
};
// ======================================================
// ADMIN LOGIN
// POST /api/admin/login
// ======================================================

exports.login = async (req, res) => {
    const { email, password } = req.body;

    // --------------------------------------------------
    // Validate required fields
    // --------------------------------------------------

    if (!email || !password) {
        throw new AppError(
            "Email and password are required.",
            400,
            "MISSING_LOGIN_FIELDS"
        );
    }

    if (
        typeof email !== "string" ||
        typeof password !== "string"
    ) {
        throw new AppError(
            "Email and password must be valid text values.",
            400,
            "INVALID_LOGIN_DATA"
        );
    }

    // --------------------------------------------------
    // Normalize email
    // --------------------------------------------------

    const normalizedEmail = email.trim().toLowerCase();

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
    // Find admin
    // --------------------------------------------------

    const [admins] = await db.query(
        `
        SELECT
            admin_id,
            admin_name,
            email,
            password_hash,
            is_active,
            last_login_at,
            created_at,
            updated_at
        FROM system_admin
        WHERE email = ?
        `,
        [normalizedEmail]
    );

    if (admins.length === 0) {
        throw new AppError(
            "Invalid admin email or password.",
            401,
            "INVALID_ADMIN_CREDENTIALS"
        );
    }

    const admin = admins[0];

    // --------------------------------------------------
    // Check admin status
    // --------------------------------------------------

    if (!admin.is_active) {
        throw new AppError(
            "Admin account is inactive.",
            403,
            "ADMIN_ACCOUNT_INACTIVE"
        );
    }

    // --------------------------------------------------
    // Compare plain-text password
    // --------------------------------------------------

    if (password !== admin.password_hash) {
        throw new AppError(
            "Invalid admin email or password.",
            401,
            "INVALID_ADMIN_CREDENTIALS"
        );
    }

    // --------------------------------------------------
    // Update last login
    // --------------------------------------------------

    await db.query(
        `
        UPDATE system_admin
        SET last_login_at = CURRENT_TIMESTAMP
        WHERE admin_id = ?
        `,
        [admin.admin_id]
    );

    // --------------------------------------------------
    // Create admin JWT
    // --------------------------------------------------

    const accessToken = createAdminToken(admin);

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    return res.status(200).json({
        success: true,
        message: "Admin login successful.",
        accessToken,
        admin: {
            admin_id: admin.admin_id,
            admin_name: admin.admin_name,
            email: admin.email,
            is_active: admin.is_active
        }
    });
};

// ======================================================
// GET ADMIN PROFILE
// GET /api/admin/me
// ======================================================

exports.getMe = async (req, res) => {
    const adminId = req.admin.admin_id;

    const [admins] = await db.query(
        `
        SELECT
            admin_id,
            admin_name,
            email,
            is_active,
            last_login_at,
            created_at,
            updated_at
        FROM system_admin
        WHERE admin_id = ?
        `,
        [adminId]
    );

    if (admins.length === 0) {
        throw new AppError(
            "Admin not found.",
            404,
            "ADMIN_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        admin: admins[0]
    });
};

// ======================================================
// UPDATE ADMIN PROFILE
// PUT /api/admin/me
// ======================================================

exports.updateMe = async (req, res) => {
    const adminId = req.admin.admin_id;

    const {
        admin_name,
        email
    } = req.body;

    // --------------------------------------------------
    // Validate update fields
    // --------------------------------------------------

    if (!admin_name && !email) {
        throw new AppError(
            "Provide admin name or email.",
            400,
            "NO_UPDATE_FIELDS"
        );
    }

    // --------------------------------------------------
    // Validate admin name
    // --------------------------------------------------

    if (admin_name !== undefined) {
        if (
            typeof admin_name !== "string" ||
            admin_name.trim().length < 2
        ) {
            throw new AppError(
                "Admin name must contain at least 2 characters.",
                400,
                "INVALID_ADMIN_NAME"
            );
        }
    }

    // --------------------------------------------------
    // Validate email
    // --------------------------------------------------

    let normalizedEmail = null;

    if (email !== undefined) {
        if (typeof email !== "string") {
            throw new AppError(
                "Email must be a valid text value.",
                400,
                "INVALID_EMAIL"
            );
        }

        normalizedEmail = email.trim().toLowerCase();

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            throw new AppError(
                "Please provide a valid email address.",
                400,
                "INVALID_EMAIL"
            );
        }

        const [existing] = await db.query(
            `
            SELECT admin_id
            FROM system_admin
            WHERE email = ?
            AND admin_id != ?
            `,
            [
                normalizedEmail,
                adminId
            ]
        );

        if (existing.length > 0) {
            throw new AppError(
                "Email is already used by another admin.",
                409,
                "ADMIN_EMAIL_EXISTS"
            );
        }
    }

    // --------------------------------------------------
    // Update admin
    // --------------------------------------------------

    await db.query(
        `
        UPDATE system_admin
        SET
            admin_name = COALESCE(?, admin_name),
            email = COALESCE(?, email)
        WHERE admin_id = ?
        `,
        [
            admin_name !== undefined
                ? admin_name.trim()
                : null,

            normalizedEmail,

            adminId
        ]
    );

    // --------------------------------------------------
    // Get updated admin
    // --------------------------------------------------

    const [admins] = await db.query(
        `
        SELECT
            admin_id,
            admin_name,
            email,
            is_active,
            last_login_at,
            created_at,
            updated_at
        FROM system_admin
        WHERE admin_id = ?
        `,
        [adminId]
    );

    if (admins.length === 0) {
        throw new AppError(
            "Admin not found.",
            404,
            "ADMIN_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Admin profile updated successfully.",
        admin: admins[0]
    });
};

// ======================================================
// CHANGE ADMIN PASSWORD
// PUT /api/admin/me/password
// ======================================================

exports.changePassword = async (req, res) => {
    const adminId = req.admin.admin_id;

    const {
        currentPassword,
        newPassword
    } = req.body;

    // --------------------------------------------------
    // Validate fields
    // --------------------------------------------------

    if (!currentPassword || !newPassword) {
        throw new AppError(
            "Current and new passwords are required.",
            400,
            "MISSING_PASSWORD_FIELDS"
        );
    }

    if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string"
    ) {
        throw new AppError(
            "Passwords must be valid text values.",
            400,
            "INVALID_PASSWORD_DATA"
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

    const [admins] = await db.query(
        `
        SELECT password_hash
        FROM system_admin
        WHERE admin_id = ?
        `,
        [adminId]
    );

    if (admins.length === 0) {
        throw new AppError(
            "Admin not found.",
            404,
            "ADMIN_NOT_FOUND"
        );
    }

    // --------------------------------------------------
    // Compare plain-text password
    // --------------------------------------------------

    if (currentPassword !== admins[0].password_hash) {
        throw new AppError(
            "Current password is incorrect.",
            401,
            "INCORRECT_CURRENT_PASSWORD"
        );
    }

    // --------------------------------------------------
    // Store new plain-text password
    // --------------------------------------------------

    await db.query(
        `
        UPDATE system_admin
        SET password_hash = ?
        WHERE admin_id = ?
        `,
        [
            newPassword,
            adminId
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Admin password changed successfully."
    });
};

// ======================================================
// DEACTIVATE ADMIN
// PATCH /api/admin/me/deactivate
// ======================================================

exports.deactivateMe = async (req, res) => {
    const adminId = req.admin.admin_id;

    const [result] = await db.query(
        `
        UPDATE system_admin
        SET is_active = 0
        WHERE admin_id = ?
        `,
        [adminId]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Admin not found.",
            404,
            "ADMIN_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Admin account deactivated."
    });
};

// ======================================================
// DELETE ADMIN
// DELETE /api/admin/me
// ======================================================

exports.deleteMe = async (req, res) => {
    const adminId = req.admin.admin_id;

    const [result] = await db.query(
        `
        DELETE FROM system_admin
        WHERE admin_id = ?
        `,
        [adminId]
    );

    if (result.affectedRows === 0) {
        throw new AppError(
            "Admin not found.",
            404,
            "ADMIN_NOT_FOUND"
        );
    }

    return res.status(200).json({
        success: true,
        message: "Admin deleted successfully."
    });
};

// ======================================================
// ADMIN LOGOUT
// POST /api/admin/logout
// ======================================================

exports.logout = async (req, res) => {
    return res.status(200).json({
        success: true,
        message:
            "Admin logout successful. Remove the access token on the client."
    });
};
const db = require("../config/database.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const AppError = require("../utils/AppError");


// ======================================================
// Helper: Create Access Token
// ======================================================

function createAccessToken(user) {
    return jwt.sign(
        {
            user_id: user.user_id,
            email: user.email,
            type: "user"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "15m"
        }
    );
}


// ======================================================
// Helper: Create Refresh Token
// ======================================================

function createRefreshToken() {
    return crypto.randomBytes(64).toString("hex");
}


// ======================================================
// Helper: Hash Refresh Token
// ======================================================

function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


// ======================================================
// REGISTER
// POST /api/auth/register
// ======================================================

exports.register = async (req, res) => {

    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
        throw new AppError(
            "Name, email and password are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    if (typeof name !== "string" || name.trim().length < 2) {
        throw new AppError(
            "Name must contain at least 2 characters.",
            400,
            "INVALID_NAME"
        );
    }

    if (typeof email !== "string") {
        throw new AppError(
            "Email must be a valid string.",
            400,
            "INVALID_EMAIL"
        );
    }

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

    if (typeof password !== "string" || password.length < 8) {
        throw new AppError(
            "Password must contain at least 8 characters.",
            400,
            "WEAK_PASSWORD"
        );
    }

    // Check existing user
    const [existingUsers] = await db.query(
        `SELECT user_id
         FROM users
         WHERE email = ?`,
        [normalizedEmail]
    );

    if (existingUsers.length > 0) {
        throw new AppError(
            "Email is already registered.",
            409,
            "EMAIL_ALREADY_EXISTS"
        );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user
    const [result] = await db.query(
        `INSERT INTO users
            (name, email, password_hash)
         VALUES (?, ?, ?)`,
        [
            name.trim(),
            normalizedEmail,
            passwordHash
        ]
    );

    // Get created user
    const [users] = await db.query(
        `SELECT
            user_id,
            name,
            email,
            is_active,
            created_at,
            updated_at,
            last_login_at
         FROM users
         WHERE user_id = ?`,
        [result.insertId]
    );

    if (users.length === 0) {
        throw new AppError(
            "User was created but could not be retrieved.",
            500,
            "USER_CREATION_ERROR"
        );
    }

    return res.status(201).json({
        success: true,
        message: "User registered successfully.",
        user: users[0]
    });
};


// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================

exports.login = async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError(
            "Email and password are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    if (typeof email !== "string") {
        throw new AppError(
            "Email must be a valid string.",
            400,
            "INVALID_EMAIL"
        );
    }

    if (typeof password !== "string") {
        throw new AppError(
            "Password must be a valid string.",
            400,
            "INVALID_PASSWORD"
        );
    }

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

    // Find user
    const [users] = await db.query(
        `SELECT *
         FROM users
         WHERE email = ?`,
        [normalizedEmail]
    );

    if (users.length === 0) {
        throw new AppError(
            "Invalid email or password.",
            401,
            "INVALID_CREDENTIALS"
        );
    }

    const user = users[0];

    // Check account status
    if (!user.is_active) {
        throw new AppError(
            "Your account is inactive.",
            403,
            "ACCOUNT_INACTIVE"
        );
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatch) {
        throw new AppError(
            "Invalid email or password.",
            401,
            "INVALID_CREDENTIALS"
        );
    }

    // Update last login
    await db.query(
        `UPDATE users
         SET last_login_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [user.user_id]
    );

    // Create access token
    const accessToken = createAccessToken(user);

    // Create refresh token
    const refreshToken = createRefreshToken();

    const refreshTokenHash = hashToken(refreshToken);

    // Refresh token expiration
    const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    // Save refresh token
    await db.query(
        `INSERT INTO refresh_tokens
            (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
        [
            user.user_id,
            refreshTokenHash,
            expiresAt
        ]
    );

    return res.status(200).json({
        success: true,
        message: "Login successful.",

        accessToken,

        refreshToken,

        user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            is_active: user.is_active
        }
    });
};


// ======================================================
// REFRESH ACCESS TOKEN
// POST /api/auth/refresh
// ======================================================

exports.refreshToken = async (req, res) => {

    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new AppError(
            "Refresh token is required.",
            400,
            "REFRESH_TOKEN_REQUIRED"
        );
    }

    if (typeof refreshToken !== "string") {
        throw new AppError(
            "Refresh token must be a valid string.",
            400,
            "INVALID_REFRESH_TOKEN"
        );
    }

    const tokenHash = hashToken(refreshToken);

    // Find refresh token
    const [tokens] = await db.query(
        `SELECT
            rt.refresh_token_id,
            rt.user_id,
            rt.expires_at,
            u.name,
            u.email,
            u.is_active
         FROM refresh_tokens rt
         INNER JOIN users u
             ON u.user_id = rt.user_id
         WHERE rt.token_hash = ?`,
        [tokenHash]
    );

    if (tokens.length === 0) {
        throw new AppError(
            "Invalid refresh token.",
            401,
            "INVALID_REFRESH_TOKEN"
        );
    }

    const token = tokens[0];

    // Check expiration
    if (new Date(token.expires_at) < new Date()) {

        await db.query(
            `DELETE FROM refresh_tokens
             WHERE refresh_token_id = ?`,
            [token.refresh_token_id]
        );

        throw new AppError(
            "Refresh token has expired.",
            401,
            "REFRESH_TOKEN_EXPIRED"
        );
    }

    // Check user
    if (!token.is_active) {
        throw new AppError(
            "User account is inactive.",
            403,
            "ACCOUNT_INACTIVE"
        );
    }

    // Create new access token
    const accessToken = createAccessToken({
        user_id: token.user_id,
        email: token.email
    });

    return res.status(200).json({
        success: true,
        accessToken
    });
};


// ======================================================
// LOGOUT
// POST /api/auth/logout
// ======================================================

exports.logout = async (req, res) => {

    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new AppError(
            "Refresh token is required.",
            400,
            "REFRESH_TOKEN_REQUIRED"
        );
    }

    if (typeof refreshToken !== "string") {
        throw new AppError(
            "Refresh token must be a valid string.",
            400,
            "INVALID_REFRESH_TOKEN"
        );
    }

    const tokenHash = hashToken(refreshToken);

    await db.query(
        `DELETE FROM refresh_tokens
         WHERE token_hash = ?`,
        [tokenHash]
    );

    return res.status(200).json({
        success: true,
        message: "Logout successful."
    });
};


// ======================================================
// LOGOUT FROM ALL DEVICES
// POST /api/auth/logout-all
// Requires authentication
// ======================================================

exports.logoutAll = async (req, res) => {

    const userId = req.user.user_id;

    if (!userId) {
        throw new AppError(
            "Authenticated user was not found.",
            401,
            "AUTHENTICATION_REQUIRED"
        );
    }

    await db.query(
        `DELETE FROM refresh_tokens
         WHERE user_id = ?`,
        [userId]
    );

    return res.status(200).json({
        success: true,
        message: "Logged out from all devices."
    });
};
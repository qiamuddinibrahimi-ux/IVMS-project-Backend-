const db = require("../config/database.js");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

// ======================================================
// HELPERS: TOKEN CREATION
// ======================================================

function createAdminToken(admin) {
    return jwt.sign(
        { admin_id: admin.admin_id, email: admin.email, type: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "15m" } // Short-lived access
    );
}

function createAdminRefreshToken(admin) {
    return jwt.sign(
        { admin_id: admin.admin_id, email: admin.email, type: "admin_refresh" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" } // Long-lived refresh
    );
}

// ======================================================
// ADMIN LOGIN
// POST /api/admin/login
// ======================================================

exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError("Email and password are required.", 400, "MISSING_LOGIN_FIELDS");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [admins] = await db.query(
        `SELECT admin_id, admin_name, email, password_hash, is_active, last_login_at, created_at, updated_at
         FROM system_admin WHERE email = ?`,
        [normalizedEmail]
    );

    if (admins.length === 0) {
        throw new AppError("Invalid admin email or password.", 401, "INVALID_ADMIN_CREDENTIALS");
    }

    const admin = admins[0];

    if (!admin.is_active) {
        throw new AppError("Admin account is inactive.", 403, "ADMIN_ACCOUNT_INACTIVE");
    }

    if (password !== admin.password_hash) {
        throw new AppError("Invalid admin email or password.", 401, "INVALID_ADMIN_CREDENTIALS");
    }

    // Update last login
    await db.query(`UPDATE system_admin SET last_login_at = CURRENT_TIMESTAMP WHERE admin_id = ?`, [admin.admin_id]);

    // ✅ Create BOTH tokens
    const accessToken = createAdminToken(admin);
    const refreshToken = createAdminRefreshToken(admin);

    return res.status(200).json({
        success: true,
        message: "Admin login successful.",
        accessToken,
        refreshToken, // ✅ KEY: This enables auto-refresh
        admin: {
            admin_id: admin.admin_id,
            admin_name: admin.admin_name,
            email: admin.email,
            is_active: admin.is_active
        }
    });
};

// ======================================================
// REFRESH ADMIN TOKEN
// POST /api/admin/refresh
// ======================================================

exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ success: false, message: "Refresh token required." });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        if (decoded.type !== "admin_refresh") {
            return res.status(403).json({ success: false, message: "Invalid token type." });
        }

        const [admins] = await db.query(`SELECT * FROM system_admin WHERE admin_id = ?`, [decoded.admin_id]);

        if (admins.length === 0 || !admins[0].is_active) {
            return res.status(403).json({ success: false, message: "Admin inactive or not found." });
        }

        const newAccessToken = createAdminToken(admins[0]);

        return res.status(200).json({
            success: true,
            accessToken: newAccessToken
        });
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired refresh token." });
    }
};

// ======================================================
// GET ADMIN PROFILE
// GET /api/admin/me
// ======================================================

exports.getMe = async (req, res) => {
    const adminId = req.admin.admin_id;

    const [admins] = await db.query(
        `SELECT admin_id, admin_name, email, is_active, last_login_at, created_at, updated_at
         FROM system_admin WHERE admin_id = ?`,
        [adminId]
    );

    if (admins.length === 0) {
        throw new AppError("Admin not found.", 404, "ADMIN_NOT_FOUND");
    }

    return res.status(200).json({ success: true, admin: admins[0] });
};

// ======================================================
// UPDATE ADMIN PROFILE
// PUT /api/admin/me
// ======================================================

exports.updateMe = async (req, res) => {
    const adminId = req.admin.admin_id;
    const { admin_name, email } = req.body;

    if (!admin_name && !email) {
        throw new AppError("Provide admin name or email.", 400, "NO_UPDATE_FIELDS");
    }

    let normalizedEmail = null;

    if (email !== undefined) {
        normalizedEmail = email.trim().toLowerCase();

        const [existing] = await db.query(
            `SELECT admin_id FROM system_admin WHERE email = ? AND admin_id != ?`,
            [normalizedEmail, adminId]
        );

        if (existing.length > 0) {
            throw new AppError("Email is already used by another admin.", 409, "ADMIN_EMAIL_EXISTS");
        }
    }

    await db.query(
        `UPDATE system_admin SET admin_name = COALESCE(?, admin_name), email = COALESCE(?, email) WHERE admin_id = ?`,
        [admin_name !== undefined ? admin_name.trim() : null, normalizedEmail, adminId]
    );

    const [admins] = await db.query(
        `SELECT admin_id, admin_name, email, is_active, last_login_at, created_at, updated_at
         FROM system_admin WHERE admin_id = ?`,
        [adminId]
    );

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
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        throw new AppError("Current and new passwords are required.", 400, "MISSING_PASSWORD_FIELDS");
    }

    if (newPassword.length < 8) {
        throw new AppError("New password must contain at least 8 characters.", 400, "WEAK_PASSWORD");
    }

    const [admins] = await db.query(`SELECT password_hash FROM system_admin WHERE admin_id = ?`, [adminId]);

    if (admins[0].password_hash !== currentPassword) {
        throw new AppError("Current password is incorrect.", 401, "INCORRECT_CURRENT_PASSWORD");
    }

    await db.query(`UPDATE system_admin SET password_hash = ? WHERE admin_id = ?`, [newPassword, adminId]);

    return res.status(200).json({ success: true, message: "Admin password changed successfully." });
};

// ======================================================
// DEACTIVATE ADMIN
// PATCH /api/admin/me/deactivate
// ======================================================

exports.deactivateMe = async (req, res) => {
    const adminId = req.admin.admin_id;
    await db.query(`UPDATE system_admin SET is_active = 0 WHERE admin_id = ?`, [adminId]);
    return res.status(200).json({ success: true, message: "Admin account deactivated." });
};

// ======================================================
// DELETE ADMIN
// DELETE /api/admin/me
// ======================================================

// ======================================================
// DELETE USER (With Cascading Deletion)
// DELETE /api/admin/users/:id
// ======================================================

// ======================================================
// DELETE USER (With Full Cascading Deletion)
// DELETE /api/admin/users/:id
// ======================================================

exports.deleteUser = async (req, res) => {
    const userId = req.params.id;
    const connection = await db.getConnection(); // Get connection for transaction

    try {
        await connection.beginTransaction();

        // 1. Verify user exists
        const [users] = await connection.query(`SELECT user_id FROM users WHERE user_id = ?`, [userId]);
        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2. Delete Child Records based on your screenshot
        // (Order matters to avoid composite key issues like the items/categories error)

        // Delete items first (because items depend on categories)
        await connection.query(`DELETE FROM items WHERE user_id = ?`, [userId]);

        // Delete tables that depend on sales/purchases
        await connection.query(`DELETE FROM purchase_details WHERE user_id = ?`, [userId]);
        await connection.query(`DELETE FROM customer_payment WHERE user_id = ?`, [userId]);
        await connection.query(`DELETE FROM purchase_payment WHERE user_id = ?`, [userId]);
        await connection.query(`DELETE FROM sales WHERE user_id = ?`, [userId]);
        await connection.query(`DELETE FROM purchases WHERE user_id = ?`, [userId]);

        // Delete other direct child tables
        await connection.query(`DELETE FROM currencies WHERE user_id = ?`, [userId]);
        await connection.query(`DELETE FROM customers WHERE user_id = ?`, [userId]);
        await connection.query(`DELETE FROM exchange_rate WHERE user_id = ?`, [userId]);
        await connection.query(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [userId]);
        await connection.query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userId]);

        // NOTE: If you have a 'sales_details' table, add it here too:
        // await connection.query(`DELETE sd FROM sales_details sd INNER JOIN sales s ON sd.sale_id = s.sale_id WHERE s.user_id = ?`, [userId]);
        
        // NOTE: If you have a 'vendors' table, add it here too:
        // await connection.query(`DELETE FROM vendors WHERE user_id = ?`, [userId]);

        // 3. Finally, delete the user
        await connection.query(`DELETE FROM users WHERE user_id = ?`, [userId]);

        // Commit the transaction if everything succeeded
        await connection.commit();

        return res.status(200).json({ 
            success: true, 
            message: "User and all related data deleted successfully." 
        });

    } catch (error) {
        // Rollback if ANY of the queries fail
        await connection.rollback();
        console.error("Delete User Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// ======================================================
// GET DASHBOARD STATS
// GET /api/admin/stats
// ======================================================

exports.getDashboardStats = async (req, res) => {
    try {
        const [users] = await db.query(`SELECT COUNT(*) AS count FROM users`);
        const [items] = await db.query(`SELECT COUNT(*) AS count FROM items`);
        const [sales] = await db.query(`SELECT COUNT(*) AS count FROM sales`);
        const [purchases] = await db.query(`SELECT COUNT(*) AS count FROM purchases`);

        const [profitData] = await db.query(`
            SELECT 
                c.currency_code,
                (SELECT SUM(sd.quantity * sd.unit_price) FROM sales_details sd 
                 INNER JOIN sales s ON sd.sale_id = s.sale_id 
                 WHERE s.currency_id = c.currency_id) AS revenue,
                (SELECT SUM(pd.quantity * pd.unit_price) FROM purchase_details pd 
                 INNER JOIN purchases p ON pd.purchase_id = p.purchase_id 
                 WHERE p.currency_id = c.currency_id) AS cost
            FROM currencies c
        `);

        let totalRevenue = 0;
        let totalCost = 0;

        for (const row of profitData) {
            const rev = parseFloat(row.revenue) || 0;
            const cst = parseFloat(row.cost) || 0;
            if (rev > 0 || cst > 0) {
                totalRevenue += rev;
                totalCost += cst;
            }
        }

        return res.status(200).json({
            success: true,
            stats: {
                total_users: users[0].count || 0,
                total_items: items[0].count || 0,
                total_sales: sales[0].count || 0,
                total_purchases: purchases[0].count || 0,
                total_profit: totalRevenue - totalCost,
            }
        });
    } catch (error) {
        console.error("Stats Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// GET ACTIVITY LOG
// GET /api/admin/activity
// ======================================================

exports.getActivityLog = async (req, res) => {
    try {
        const [newUsers] = await db.query(`SELECT name, created_at FROM users ORDER BY user_id DESC LIMIT 5`);
        const [newSales] = await db.query(`
            SELECT s.sale_id, s.sale_date, s.invoice_no, u.name as user_name 
            FROM sales s LEFT JOIN users u ON s.user_id = u.user_id 
            ORDER BY s.sale_id DESC LIMIT 5
        `);
        const [newPurchases] = await db.query(`
            SELECT p.purchase_id, p.purchase_date, p.invoice_no, u.name as user_name 
            FROM purchases p LEFT JOIN users u ON p.user_id = u.user_id 
            ORDER BY p.purchase_id DESC LIMIT 5
        `);

        return res.status(200).json({
            success: true,
            new_users: newUsers || [],
            new_sales: newSales || [],
            new_purchases: newPurchases || []
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// GET ALL USERS
// GET /api/admin/users
// ======================================================

exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT user_id, name, email, is_active, created_at, last_login_at
            FROM users ORDER BY user_id DESC
        `);
        return res.status(200).json({ success: true, count: users.length, users });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// GET SINGLE USER DETAILS
// GET /api/admin/users/:id
// ======================================================

exports.getUserDetails = async (req, res) => {
    try {
        const userId = req.params.id;

        const [users] = await db.query(
            `SELECT user_id, name, email, is_active, created_at, last_login_at FROM users WHERE user_id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const [sales] = await db.query(`SELECT COUNT(*) AS count FROM sales WHERE user_id = ?`, [userId]);
        const [purchases] = await db.query(`SELECT COUNT(*) AS count FROM purchases WHERE user_id = ?`, [userId]);
        const [customers] = await db.query(`SELECT COUNT(*) AS count FROM customers WHERE user_id = ?`, [userId]);
        const [vendors] = await db.query(`SELECT COUNT(*) AS count FROM vendors WHERE user_id = ?`, [userId]);

        return res.status(200).json({
            success: true,
            user: users[0],
            stats: {
                sales: sales[0].count || 0,
                purchases: purchases[0].count || 0,
                customers: customers[0].count || 0,
                vendors: vendors[0].count || 0,
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// TOGGLE USER STATUS
// PATCH /api/admin/users/:id/toggle-status
// ======================================================

exports.toggleUserStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const [users] = await db.query(`SELECT is_active FROM users WHERE user_id = ?`, [userId]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const newStatus = users[0].is_active == 1 ? 0 : 1;
        await db.query(`UPDATE users SET is_active = ? WHERE user_id = ?`, [newStatus, userId]);

        return res.status(200).json({
            success: true,
            message: `User ${newStatus === 1 ? 'activated' : 'deactivated'}.`,
            is_active: newStatus
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// DELETE USER
// DELETE /api/admin/users/:id
// ======================================================

exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        const [users] = await db.query(`SELECT user_id FROM users WHERE user_id = ?`, [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        await db.query(`DELETE FROM users WHERE user_id = ?`, [userId]);

        return res.status(200).json({ success: true, message: "User deleted successfully." });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// ADMIN LOGOUT
// POST /api/admin/logout
// ======================================================

exports.logout = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Admin logout successful. Remove the access token on the client."
    });
};
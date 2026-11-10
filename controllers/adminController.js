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
// GET DASHBOARD STATS
// GET /api/admin/stats
// ======================================================

exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Get Total Users
        const [users] = await db.query(`SELECT COUNT(*) AS count FROM users`);
        
        // 2. Get Total Items
        const [items] = await db.query(`SELECT COUNT(*) AS count FROM items`);
        
        // 3. Get Total Sales
        const [sales] = await db.query(`SELECT COUNT(*) AS count FROM sales`);
        
        // 4. Calculate Profit (Revenue)
        // We are summing (quantity * unit_price) from the sales_details table
        const [profit] = await db.query(`
            SELECT SUM(quantity * unit_price) AS total 
            FROM sales_details
        `);
        
        return res.status(200).json({
            success: true,
            stats: {
                total_users: users[0].count || 0,
                total_items: items[0].count || 0,
                total_sales: sales[0].count || 0,
                total_profit: profit[0].total || 0.0, // Will now show real money
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getActivityLog = async (req, res) => {
    try {
        // 1. Latest 5 users
        const [newUsers] = await db.query(`
            SELECT name, created_at 
            FROM users 
            ORDER BY user_id DESC 
            LIMIT 5
        `);

        // 2. Latest 5 sales (Uses sale_date, not created_at)
        const [newSales] = await db.query(`
            SELECT s.sale_id, s.sale_date, s.invoice_no, u.name as user_name 
            FROM sales s
            LEFT JOIN users u ON s.user_id = u.user_id
            ORDER BY s.sale_id DESC 
            LIMIT 5
        `);

        // 3. Latest 5 purchases (New addition for a richer activity feed)
        const [newPurchases] = await db.query(`
            SELECT p.purchase_id, p.purchase_date, p.invoice_no, u.name as user_name 
            FROM purchases p
            LEFT JOIN users u ON p.user_id = u.user_id
            ORDER BY p.purchase_id DESC 
            LIMIT 5
        `);

        return res.status(200).json({
            success: true,
            new_users: newUsers || [],
            new_sales: newSales || [],
            new_purchases: newPurchases || []
        });
    } catch (error) {
        console.error("Activity Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
// ======================================================
// ADMIN LOGOUT
// POST /api/admin/logout
// ======================================================
// ======================================================
// GET SINGLE USER DETAILS (Stats based on user_id)
// GET /api/admin/users/:id
// ======================================================

exports.getUserDetails = async (req, res) => {
    try {
        const userId = req.params.id;

        // 1. Get User Basic Info
        const [users] = await db.query(
            `SELECT user_id, name, email, is_active, created_at, last_login_at FROM users WHERE user_id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2. Get Stats for this user
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
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// TOGGLE USER STATUS (Activate/Deactivate)
// PATCH /api/admin/users/:id/toggle-status
// ======================================================

exports.toggleUserStatus = async (req, res) => {
    try {
        const userId = req.params.id;

        // Get current status
        const [users] = await db.query(`SELECT is_active FROM users WHERE user_id = ?`, [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Toggle it (1 -> 0, 0 -> 1)
        const newStatus = users[0].is_active == 1 ? 0 : 1;

        await db.query(`UPDATE users SET is_active = ? WHERE user_id = ?`, [newStatus, userId]);

        return res.status(200).json({
            success: true,
            message: `User ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`,
            is_active: newStatus
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};




function createAdminToken(admin) {
    return jwt.sign(
        { admin_id: admin.admin_id, email: admin.email, type: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );
}

// ======================================================
// DASHBOARD STATS
// ======================================================
exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Basic Counts
        const [users] = await db.query(`SELECT COUNT(*) AS count FROM users`);
        const [items] = await db.query(`SELECT COUNT(*) AS count FROM items`);
        const [sales] = await db.query(`SELECT COUNT(*) AS count FROM sales`);
        const [purchases] = await db.query(`SELECT COUNT(*) AS count FROM purchases`);

        // 2. Calculate Profit (Grouped by currency)
        // Note: Adjust 'unit_price' and 'quantity' if your column names are different
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

        // Calculate totals (If you have multiple currencies, this represents the raw sum of numbers)
        let totalRevenue = 0;
        let totalCost = 0;
        let profitByCurrency = [];

        for (const row of profitData) {
            const rev = parseFloat(row.revenue) || 0;
            const cst = parseFloat(row.cost) || 0;
            
            if (rev > 0 || cst > 0) {
                totalRevenue += rev;
                totalCost += cst;
                profitByCurrency.push({
                    currency: row.currency_code,
                    revenue: rev,
                    cost: cst,
                    profit: rev - cst
                });
            }
        }

        const totalProfit = totalRevenue - totalCost;

        return res.status(200).json({
            success: true,
            stats: {
                total_users: users[0].count || 0,
                total_items: items[0].count || 0,
                total_sales: sales[0].count || 0,
                total_purchases: purchases[0].count || 0,
                total_profit: totalProfit, // ✅ Real Profit now
                profit_details: profitByCurrency, // Optional: See breakdown by currency
            }
        });
    } catch (error) {
        console.error("Stats Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// GET ALL USERS (For User Management List)
// ======================================================
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT user_id, name, email, is_active, created_at, last_login_at
            FROM users
            ORDER BY user_id DESC
        `);
        return res.status(200).json({ success: true, count: users.length, users });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ======================================================
// GET SINGLE USER DETAILS + STATS
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

        // Fetch counts
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

// ... (Keep your existing login, getMe, updateMe, changePassword, deactivateMe, deleteMe, logout functions here) ...
exports.logout = async (req, res) => {
    return res.status(200).json({
        success: true,
        message:
            "Admin logout successful. Remove the access token on the client."
    });
};
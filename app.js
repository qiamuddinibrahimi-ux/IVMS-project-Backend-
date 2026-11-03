
require("dotenv").config();

const express = require("express");
const db = require("./config/database.js");

// ======================================================
// ROUTE IMPORTS
// ======================================================
const salesDetailsRoutes = require("./routes/salesDetailsRoutes.js");
const purchaseDetailsRoutes = require("./routes/purchaseDetailsRoutes.js");


const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

// Authentication
const authRoutes = require("./routes/authRoutes.js");

// User
const userRoutes = require("./routes/userRoutes.js");

// Password
const passwordRoutes = require("./routes/passwordRoutes.js");

// System Admin
const adminRoutes = require("./routes/adminRoutes.js");

// Categories
const categoryRoutes = require("./routes/categoryRoutes.js");

// Units
const unitRoutes = require("./routes/unitRoutes.js");

// Currencies
const currencyRoutes = require("./routes/currencyRoutes.js");

// Exchange Rates
const exchangeRateRoutes = require("./routes/exchangeRateRoutes.js");

// Items
const itemRoutes = require("./routes/itemRoutes.js");

// Customers
const customerRoutes = require("./routes/customerRoutes.js");

// Vendors
const vendorRoutes = require("./routes/vendorRoutes.js");

// Purchases
const purchaseRoutes = require("./routes/purchaseRoutes.js");

// Purchase Payments
const purchasePaymentRoutes = require("./routes/purchasePaymentRoutes.js");

// Sales
const saleRoutes = require("./routes/saleRoutes.js");

// Customer Payments
const customerPaymentRoutes = require("./routes/customerPaymentRoutes.js");

// Stock Movements
const stockMovementRoutes = require("./routes/stockMovementRoutes.js");

// Sales-Purchase Allocations


// Inventory
const inventoryRoutes = require("./routes/inventoryRoutes.js");
const salesPurchaseAllocationRoutes =
    require("./routes/salesPurchaseAllocationRoutes");
// Reports
const reportRoutes = require("./routes/reportRoutes.js");
// ======================================================
// APP CONFIGURATION
// ======================================================

const app = express();

const PORT = 5000;

// ======================================================
// GLOBAL MIDDLEWARE
// ======================================================

// Allow JSON request bodies


// Parse JSON request bodies
app.use(express.json());
app.use(
    "/api/sales-purchase-allocations",
    salesPurchaseAllocationRoutes
);
// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// ======================================================
// BASIC TEST ROUTE
// ======================================================


app.use("/api/sales-details", salesDetailsRoutes);
app.use("/api/purchase-details", purchaseDetailsRoutes);
app.get("/", (req, res) => {

    res.status(200).json({
        success: true,
        message: "AlMadina Backend is running!"
    });

});

// ======================================================
// DATABASE TEST
// ======================================================

app.get("/test-db", async (req, res) => {

    try {

        const [result] = await db.query(
            "SELECT 1 AS test"
        );

        res.status(200).json({
            success: true,
            message: "Database connected successfully!",
            result
        });

    } catch (error) {

        console.error("Database Error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: error.message
        });

    }

});

// ======================================================
// API ROUTES
// ======================================================

// Authentication
app.use(
    "/api/auth",
    authRoutes
);

// User Account
app.use(
    "/api/users",
    userRoutes
);

// Password Reset
app.use(
    "/api/auth",
    passwordRoutes
);

// System Admin
app.use(
    "/api/admin",
    adminRoutes
);

// Categories
app.use(
    "/api/categories",
    categoryRoutes
);

// Units
app.use(
    "/api/units",
    unitRoutes
);

// Currencies
app.use(
    "/api/currencies",
    currencyRoutes
);

// Exchange Rates
app.use(
    "/api/exchange-rates",
    exchangeRateRoutes
);

// Items
app.use(
    "/api/items",
    itemRoutes
);

// Customers
app.use(
    "/api/customers",
    customerRoutes
);

// Vendors
app.use(
    "/api/vendors",
    vendorRoutes
);

// Purchases
app.use(
    "/api/purchases",
    purchaseRoutes
);

// Purchase Payments
app.use(
    "/api/purchase-payments",
    purchasePaymentRoutes
);

// Sales
app.use(
    "/api/sales",
    saleRoutes
);

// Customer Payments
app.use(
    "/api/customer-payments",
    customerPaymentRoutes
);

// Stock Movements
app.use(
    "/api/stock-movements",
    stockMovementRoutes
);

// Sales-Purchase Allocations

// Inventory
app.use(
    "/api/inventory",
    inventoryRoutes
);

// Reports


app.use("/api/reports", reportRoutes);
// ======================================================
// 404 HANDLER
// MUST BE AFTER ALL ROUTES
// ======================================================

app.use(notFound);

// ======================================================
// GLOBAL ERROR HANDLER
// MUST BE THE LAST MIDDLEWARE
// ======================================================

app.use(errorHandler);

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {

    console.log(
        `AlMadina Backend running on http://localhost:${PORT}`
    );

});


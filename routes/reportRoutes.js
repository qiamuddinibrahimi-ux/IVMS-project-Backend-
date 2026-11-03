
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const reportController = require("../controllers/reportController");

// All report endpoints require an authenticated regular user.
// Each controller filters report data by req.user.user_id.

// 1. Sales
router.get("/sales", authMiddleware, reportController.getSalesReport);

// 2. Purchases
router.get(
    "/purchases",
    authMiddleware,
    reportController.getPurchasesReport
);

// 3. Customer payments
router.get(
    "/customer-payments",
    authMiddleware,
    reportController.getCustomerPaymentsReport
);

// 4. Vendor payments
router.get(
    "/vendor-payments",
    authMiddleware,
    reportController.getVendorPaymentsReport
);

// 5. Customer balances by sale currency
router.get(
    "/customer-balances",
    authMiddleware,
    reportController.getCustomerBalancesReport
);

// 6. Vendor balances by purchase currency
router.get(
    "/vendor-balances",
    authMiddleware,
    reportController.getVendorBalancesReport
);

// 7. Current inventory
router.get(
    "/inventory",
    authMiddleware,
    reportController.getInventoryReport
);

// 8. Item sales by currency
router.get(
    "/item-sales",
    authMiddleware,
    reportController.getItemSalesReport
);

// 9. Item purchases by currency
router.get(
    "/item-purchases",
    authMiddleware,
    reportController.getItemPurchasesReport
);

// 10. Gross profit
router.get(
    "/profit",
    authMiddleware,
    reportController.getProfitReport
);

// 11. Daily summary
router.get(
    "/daily-summary",
    authMiddleware,
    reportController.getDailySummaryReport
);

module.exports = router;

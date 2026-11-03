const express = require("express");

const salesPurchaseAllocationController =
    require("../controllers/salesPurchaseAllocationController");

const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// ======================================================
// 1. STATIC PATHS FIRST
// ======================================================

// RUN FIFO ALLOCATION
// POST /api/sales-purchase-allocations/allocate
router.post(
    "/allocate",
    authMiddleware,
    asyncHandler(salesPurchaseAllocationController.runAllocation)
);

// LIST ALLOCATIONS
// GET /api/sales-purchase-allocations
router.get(
    "/",
    authMiddleware,
    asyncHandler(salesPurchaseAllocationController.getAllocations)
);

// SALE DETAILS DROPDOWN
// GET /api/sales-purchase-allocations/sale-details
router.get(
    "/sale-details",
    authMiddleware,
    asyncHandler(
        salesPurchaseAllocationController.getSaleDetailsForAllocation
    )
);

// PURCHASE DETAILS DROPDOWN
// GET /api/sales-purchase-allocations/purchase-details
router.get(
    "/purchase-details",
    authMiddleware,
    asyncHandler(
        salesPurchaseAllocationController.getPurchaseDetailsForAllocation
    )
);

// BY SALE
// GET /api/sales-purchase-allocations/by-sale/:saleId
router.get(
    "/by-sale/:saleId",
    authMiddleware,
    asyncHandler(
        salesPurchaseAllocationController.getAllocationsBySale
    )
);

// CREATE (manual)
// POST /api/sales-purchase-allocations
router.post(
    "/",
    authMiddleware,
    asyncHandler(
        salesPurchaseAllocationController.createAllocation
    )
);

// CLEAR ALL (current user)
// DELETE /api/sales-purchase-allocations
router.delete(
    "/",
    authMiddleware,
    asyncHandler(
        salesPurchaseAllocationController.clearAllocations
    )
);

// ======================================================
// 2. PARAMETERIZED PATHS LAST
// ======================================================

// GET ONE
// GET /api/sales-purchase-allocations/:id
router.get(
    "/:id",
    authMiddleware,
    asyncHandler(
        salesPurchaseAllocationController.getAllocationById
    )
);

// UPDATE ONE
// PUT /api/sales-purchase-allocations/:id
router.put(
    "/:id",
    authMiddleware,
    asyncHandler(
        salesPurchaseAllocationController.updateAllocation
    )
);

// DELETE ONE
// DELETE /api/sales-purchase-allocations/:id
router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(
        salesPurchaseAllocationController.deleteAllocation
    )
);

module.exports = router;
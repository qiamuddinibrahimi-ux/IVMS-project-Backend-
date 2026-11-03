
const express = require("express");

const inventoryController = require("../controllers/inventoryController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// ======================================================
// ALL INVENTORY ROUTES REQUIRE USER AUTHENTICATION
// ======================================================

// GET /api/inventory
// Get all inventory items
router.get(
  "/",
  authMiddleware,
  asyncHandler(inventoryController.getInventory)
);

// GET /api/inventory/summary
// Get inventory summary
router.get(
  "/summary",
  authMiddleware,
  asyncHandler(inventoryController.getInventorySummary)
);

// GET /api/inventory/low-stock?threshold=5
// Get items with stock below or equal to the threshold
router.get(
  "/low-stock",
  authMiddleware,
  asyncHandler(inventoryController.getLowStockItems)
);

// GET /api/inventory/movements
// Get stock movement history
router.get(
  "/movements",
  authMiddleware,
  asyncHandler(inventoryController.getStockMovementHistory)
);

// POST /api/inventory/adjustment
// Create a stock adjustment
router.post(
  "/adjustment",
  authMiddleware,
  asyncHandler(inventoryController.createAdjustment)
);

// PUT /api/inventory/adjustment/:movementId
// Update an existing stock adjustment
router.put(
  "/adjustment/:movementId",
  authMiddleware,
  asyncHandler(inventoryController.updateAdjustment)
);

// DELETE /api/inventory/adjustment/:movementId
// Delete a stock adjustment
router.delete(
  "/adjustment/:movementId",
  authMiddleware,
  asyncHandler(inventoryController.deleteAdjustment)
);

// GET /api/inventory/:itemId
// Get inventory details for one item
router.get(
  "/:itemId",
  authMiddleware,
  asyncHandler(inventoryController.getInventoryByItem)
);

module.exports = router;

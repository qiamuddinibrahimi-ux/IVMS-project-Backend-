const express = require("express");

const stockMovementController = require("../controllers/stockMovementController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    asyncHandler(stockMovementController.createStockMovement)
);

router.get(
    "/",
    authMiddleware,
    asyncHandler(stockMovementController.getStockMovements)
);

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(stockMovementController.getStockMovementById)
);

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(stockMovementController.updateStockMovement)
);

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(stockMovementController.deleteStockMovement)
);

module.exports = router;
const express = require("express");

const saleController = require("../controllers/saleController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    asyncHandler(saleController.createSale)
);

router.get(
    "/",
    authMiddleware,
    asyncHandler(saleController.getSales)
);

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(saleController.getSaleById)
);

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(saleController.updateSale)
);

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(saleController.deleteSale)
);

module.exports = router;
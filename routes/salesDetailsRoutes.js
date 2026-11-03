
const express = require("express");

const salesDetailsController = require("../controllers/salesDetailsController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// CREATE
router.post(
    "/",
    authMiddleware,
    asyncHandler(salesDetailsController.createSalesDetail)
);

// READ ALL
router.get(
    "/",
    authMiddleware,
    asyncHandler(salesDetailsController.getSalesDetails)
);

// READ ONE
router.get(
    "/:id",
    authMiddleware,
    asyncHandler(salesDetailsController.getSalesDetailById)
);

// UPDATE
router.put(
    "/:id",
    authMiddleware,
    asyncHandler(salesDetailsController.updateSalesDetail)
);

// DELETE
router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(salesDetailsController.deleteSalesDetail)
);

module.exports = router;

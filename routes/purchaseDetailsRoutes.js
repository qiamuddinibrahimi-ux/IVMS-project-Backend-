
const express = require("express");

const purchaseDetailsController = require("../controllers/purchaseDetailsController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// CREATE
router.post(
    "/",
    authMiddleware,
    asyncHandler(purchaseDetailsController.createPurchaseDetail)
);

// READ ALL
router.get(
    "/",
    authMiddleware,
    asyncHandler(purchaseDetailsController.getPurchaseDetails)
);

// READ ONE
router.get(
    "/:id",
    authMiddleware,
    asyncHandler(purchaseDetailsController.getPurchaseDetailById)
);

// UPDATE
router.put(
    "/:id",
    authMiddleware,
    asyncHandler(purchaseDetailsController.updatePurchaseDetail)
);

// DELETE
router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(purchaseDetailsController.deletePurchaseDetail)
);

module.exports = router;

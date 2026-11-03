const express = require("express");

const purchaseController = require("../controllers/purchaseController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();


// ======================================================
// CREATE PURCHASE
// ======================================================

router.post(
    "/",
    authMiddleware,
    asyncHandler(purchaseController.createPurchase)
);


// ======================================================
// GET ALL PURCHASES
// ======================================================

router.get(
    "/",
    authMiddleware,
    asyncHandler(purchaseController.getPurchases)
);


// ======================================================
// GET PURCHASE BY ID
// ======================================================

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(purchaseController.getPurchaseById)
);


// ======================================================
// UPDATE PURCHASE
// ======================================================

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(purchaseController.updatePurchase)
);


// ======================================================
// DELETE PURCHASE
// ======================================================

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(purchaseController.deletePurchase)
);


module.exports = router;
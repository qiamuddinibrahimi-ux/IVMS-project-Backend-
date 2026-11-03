const express = require("express");

const purchasePaymentController = require("../controllers/purchasePaymentController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();


// ======================================================
// CREATE PURCHASE PAYMENT
// ======================================================

router.post(
    "/",
    authMiddleware,
    asyncHandler(purchasePaymentController.createPurchasePayment)
);


// ======================================================
// GET ALL PURCHASE PAYMENTS
// ======================================================

router.get(
    "/",
    authMiddleware,
    asyncHandler(purchasePaymentController.getPurchasePayments)
);


// ======================================================
// GET PURCHASE PAYMENT BY ID
// ======================================================

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(purchasePaymentController.getPurchasePaymentById)
);


// ======================================================
// UPDATE PURCHASE PAYMENT
// ======================================================

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(purchasePaymentController.updatePurchasePayment)
);


// ======================================================
// DELETE PURCHASE PAYMENT
// ======================================================

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(purchasePaymentController.deletePurchasePayment)
);


module.exports = router;
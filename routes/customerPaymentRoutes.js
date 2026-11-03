const express = require("express");

const customerPaymentController = require("../controllers/customerPaymentController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();


// ======================================================
// CUSTOMER PAYMENT ROUTES
// ======================================================

router.post(
    "/",
    authMiddleware,
    asyncHandler(customerPaymentController.createCustomerPayment)
);

router.get(
    "/",
    authMiddleware,
    asyncHandler(customerPaymentController.getCustomerPayments)
);

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(customerPaymentController.getCustomerPaymentById)
);

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(customerPaymentController.updateCustomerPayment)
);

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(customerPaymentController.deleteCustomerPayment)
);


module.exports = router;
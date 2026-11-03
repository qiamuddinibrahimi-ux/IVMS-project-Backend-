
const express = require("express");

const customerController = require("../controllers/customerController");

const authMiddleware = require("../middleware/authMiddleware");

const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// ======================================================
// CUSTOMER ROUTES
// ======================================================

router.post(
    "/",
    authMiddleware,
    asyncHandler(customerController.createCustomer)
);

router.get(
    "/",
    authMiddleware,
    asyncHandler(customerController.getCustomers)
);

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(customerController.getCustomerById)
);

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(customerController.updateCustomer)
);

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(customerController.deleteCustomer)
);

module.exports = router;

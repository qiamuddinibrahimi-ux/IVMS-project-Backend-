const express = require("express");

const currencyController = require("../controllers/currencyController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();


// ======================================================
// CURRENCY ROUTES
// ======================================================

router.post(
    "/",
    authMiddleware,
    asyncHandler(currencyController.createCurrency)
);

router.get(
    "/",
    authMiddleware,
    asyncHandler(currencyController.getCurrencies)
);

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(currencyController.getCurrencyById)
);

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(currencyController.updateCurrency)
);

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(currencyController.deleteCurrency)
);


module.exports = router;
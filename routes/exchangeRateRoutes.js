const express = require("express");

const exchangeRateController = require("../controllers/exchangeRateController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();


// ======================================================
// CREATE EXCHANGE RATE
// POST /api/exchange-rates
// ======================================================

router.post(
    "/",
    authMiddleware,
    asyncHandler(exchangeRateController.createExchangeRate)
);


// ======================================================
// GET ALL EXCHANGE RATES
// GET /api/exchange-rates
// ======================================================

router.get(
    "/",
    authMiddleware,
    asyncHandler(exchangeRateController.getExchangeRates)
);


// ======================================================
// GET EXCHANGE RATE BY ID
// GET /api/exchange-rates/:id
// ======================================================

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(exchangeRateController.getExchangeRateById)
);


// ======================================================
// UPDATE EXCHANGE RATE
// PUT /api/exchange-rates/:id
// ======================================================

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(exchangeRateController.updateExchangeRate)
);


// ======================================================
// DELETE EXCHANGE RATE
// DELETE /api/exchange-rates/:id
// ======================================================

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(exchangeRateController.deleteExchangeRate)
);

module.exports = router;
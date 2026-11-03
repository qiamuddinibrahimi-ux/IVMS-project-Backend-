const express = require("express");

const passwordController = require("../controllers/passwordController");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();


// ======================================================
// FORGOT PASSWORD
// ======================================================

router.post(
    "/forgot-password",
    asyncHandler(passwordController.forgotPassword)
);


// ======================================================
// VALIDATE RESET TOKEN
// ======================================================

router.post(
    "/validate-reset-token",
    asyncHandler(passwordController.validateResetToken)
);


// ======================================================
// RESET PASSWORD
// ======================================================

router.post(
    "/reset-password",
    asyncHandler(passwordController.resetPassword)
);


// ======================================================
// CLEAN RESET TOKENS
// ======================================================

router.delete(
    "/cleanup-reset-tokens",
    asyncHandler(passwordController.cleanupResetTokens)
);

module.exports = router;
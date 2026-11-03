const express = require("express");

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();


// ======================================================
// PUBLIC AUTH ROUTES
// ======================================================

router.post(
    "/register",
    asyncHandler(authController.register)
);

router.post(
    "/login",
    asyncHandler(authController.login)
);

router.post(
    "/refresh",
    asyncHandler(authController.refreshToken)
);

router.post(
    "/logout",
    asyncHandler(authController.logout)
);


// ======================================================
// PROTECTED AUTH ROUTES
// ======================================================

router.post(
    "/logout-all",
    authMiddleware,
    asyncHandler(authController.logoutAll)
);


module.exports = router;
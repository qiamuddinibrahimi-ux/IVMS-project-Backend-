const express = require("express");

const adminController = require("../controllers/adminController");
const adminMiddleware = require("../middleware/adminMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// ======================================================
// ADMIN LOGIN
// POST /api/admin/login
// ======================================================

router.post(
    "/login",
    asyncHandler(adminController.login)
);

// ======================================================
// ADMIN PROFILE
// ======================================================

// GET /api/admin/me
router.get(
    "/me",
    adminMiddleware,
    asyncHandler(adminController.getMe)
);

// PUT /api/admin/me
router.put(
    "/me",
    adminMiddleware,
    asyncHandler(adminController.updateMe)
);

// ======================================================
// ADMIN SECURITY
// ======================================================

// PUT /api/admin/me/password
router.put(
    "/me/password",
    adminMiddleware,
    asyncHandler(adminController.changePassword)
);

// ======================================================
// ADMIN ACCOUNT
// ======================================================

// PATCH /api/admin/me/deactivate
router.patch(
    "/me/deactivate",
    adminMiddleware,
    asyncHandler(adminController.deactivateMe)
);

// DELETE /api/admin/me
router.delete(
    "/me",
    adminMiddleware,
    asyncHandler(adminController.deleteMe)
);
router.get(
    "/users",
    adminMiddleware,
    asyncHandler(adminController.getAllUsers)
);
// POST /api/admin/logout
router.post(
    "/logout",
    adminMiddleware,
    asyncHandler(adminController.logout)
);

module.exports = router;
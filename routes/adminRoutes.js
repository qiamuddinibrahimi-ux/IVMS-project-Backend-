const express = require("express");
const adminController = require("../controllers/adminController");
const adminMiddleware = require("../middleware/adminMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();
// ======================================================
// ADMIN ACTIVITY LOG
// ======================================================
router.get(
    "/activity",
    adminMiddleware,
    asyncHandler(adminController.getActivityLog)
);

// Stats
router.get("/stats", adminMiddleware, asyncHandler(adminController.getDashboardStats));

// Auth
router.post("/login", asyncHandler(adminController.login));

// Admin Profile
router.get("/me", adminMiddleware, asyncHandler(adminController.getMe));
router.put("/me", adminMiddleware, asyncHandler(adminController.updateMe));
router.put("/me/password", adminMiddleware, asyncHandler(adminController.changePassword));
router.patch("/me/deactivate", adminMiddleware, asyncHandler(adminController.deactivateMe));
router.delete("/me", adminMiddleware, asyncHandler(adminController.deleteMe));

// User Management (NEW ROUTES)
router.get("/users", adminMiddleware, asyncHandler(adminController.getAllUsers));
router.get("/users/:id", adminMiddleware, asyncHandler(adminController.getUserDetails));
router.patch("/users/:id/toggle-status", adminMiddleware, asyncHandler(adminController.toggleUserStatus));

// Logout
router.post("/logout", adminMiddleware, asyncHandler(adminController.logout));

module.exports = router;
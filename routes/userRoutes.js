const express = require("express");

const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// GET CURRENT USER
router.get(
    "/me",
    authMiddleware,
    asyncHandler(userController.getMe)
);

// UPDATE CURRENT USER
router.put(
    "/me",
    authMiddleware,
    asyncHandler(userController.updateMe)
);

// CHANGE PASSWORD
router.put(
    "/me/password",
    authMiddleware,
    asyncHandler(userController.changePassword)
);

// DEACTIVATE ACCOUNT
router.patch(
    "/me/deactivate",
    authMiddleware,
    asyncHandler(userController.deactivateAccount)
);

// DELETE ACCOUNT
router.delete(
    "/me",
    authMiddleware,
    asyncHandler(userController.deleteAccount)
);

module.exports = router;

const express = require("express");

const categoryController = require("../controllers/categoryController");

const authMiddleware = require("../middleware/authMiddleware");

const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// ======================================================
// CREATE CATEGORY
// POST /api/categories
// ======================================================

router.post(
    "/",
    authMiddleware,
    asyncHandler(
        categoryController.createCategory
    )
);

// ======================================================
// GET ALL CATEGORIES
// GET /api/categories
// ======================================================

router.get(
    "/",
    authMiddleware,
    asyncHandler(
        categoryController.getCategories
    )
);

// ======================================================
// GET CATEGORY BY ID
// GET /api/categories/:id
// ======================================================

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(
        categoryController.getCategoryById
    )
);

// ======================================================
// UPDATE CATEGORY
// PUT /api/categories/:id
// ======================================================

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(
        categoryController.updateCategory
    )
);

// ======================================================
// DELETE CATEGORY
// DELETE /api/categories/:id
// ======================================================

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(
        categoryController.deleteCategory
    )
);

module.exports = router;


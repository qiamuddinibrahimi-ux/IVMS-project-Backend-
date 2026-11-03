
const express = require("express");

const itemController = require("../controllers/itemController");

const authMiddleware = require("../middleware/authMiddleware");

const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// ======================================================
// CREATE ITEM
// POST /api/items
// ======================================================

router.post(
    "/",
    authMiddleware,
    asyncHandler(
        itemController.createItem
    )
);

// ======================================================
// GET ALL ITEMS
// GET /api/items
// ======================================================

router.get(
    "/",
    authMiddleware,
    asyncHandler(
        itemController.getItems
    )
);

// ======================================================
// GET ITEM BY ID
// GET /api/items/:id
// ======================================================

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(
        itemController.getItemById
    )
);

// ======================================================
// UPDATE ITEM
// PUT /api/items/:id
// ======================================================

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(
        itemController.updateItem
    )
);

// ======================================================
// DELETE ITEM
// DELETE /api/items/:id
// ======================================================

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(
        itemController.deleteItem
    )
);

module.exports = router;


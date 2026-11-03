const express = require("express");

const vendorController = require("../controllers/vendorController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// CREATE
router.post(
    "/",
    authMiddleware,
    asyncHandler(vendorController.createVendor)
);

// GET ALL
router.get(
    "/",
    authMiddleware,
    asyncHandler(vendorController.getVendors)
);

// GET BY ID
router.get(
    "/:id",
    authMiddleware,
    asyncHandler(vendorController.getVendorById)
);

// UPDATE
router.put(
    "/:id",
    authMiddleware,
    asyncHandler(vendorController.updateVendor)
);

// DELETE
router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(vendorController.deleteVendor)
);

module.exports = router;
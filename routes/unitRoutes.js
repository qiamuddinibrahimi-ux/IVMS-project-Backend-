const express = require("express");

const unitController = require("../controllers/unitController");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    asyncHandler(unitController.createUnit)
);

router.get(
    "/",
    authMiddleware,
    asyncHandler(unitController.getUnits)
);

router.get(
    "/:id",
    authMiddleware,
    asyncHandler(unitController.getUnitById)
);

router.put(
    "/:id",
    authMiddleware,
    asyncHandler(unitController.updateUnit)
);

router.delete(
    "/:id",
    authMiddleware,
    asyncHandler(unitController.deleteUnit)
);

module.exports = router;
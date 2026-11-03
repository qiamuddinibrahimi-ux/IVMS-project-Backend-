const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ============================================================
// COMMON HELPERS (mirrors reportController.js style)
// ============================================================

const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function getUserId(req) {
    const userId = req.user && req.user.user_id;

    if (userId === undefined || userId === null) {
        throw new AppError(
            "Authentication is required.",
            401,
            "UNAUTHORIZED"
        );
    }

    return userId;
}

function validateDate(value, fieldName) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        throw new AppError(
            `${fieldName} must use YYYY-MM-DD format.`,
            400,
            "INVALID_DATE_FORMAT"
        );
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        throw new AppError(
            `${fieldName} is not a valid calendar date.`,
            400,
            "INVALID_DATE"
        );
    }

    return value;
}

function round4(n) {
    return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
}

function sendOk(res, data, message = "Success.") {
    return res.status(200).json({
        success: true,
        message,
        count: Array.isArray(data) ? data.length : undefined,
        data,
    });
}

// ============================================================
// RUN FIFO ALLOCATION
// POST /api/sales-purchase-allocations/allocate
// Body (optional): { from_date, to_date }  OR
// Query (optional): ?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
// ============================================================

exports.runAllocation = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const fromSource =
        (req.body && req.body.from_date) || req.query.from_date;
    const toSource =
        (req.body && req.body.to_date) || req.query.to_date;

    const fromDate = validateDate(fromSource, "from_date");
    const toDate = validateDate(toSource, "to_date");

    if (fromDate && toDate && fromDate > toDate) {
        throw new AppError(
            "from_date cannot be later than to_date.",
            400,
            "INVALID_DATE_RANGE"
        );
    }

    // --------------------------------------------------
    // 1. Delete existing allocations inside the range
    //    (tenant-safe, cascades are already set on the FK)
    // --------------------------------------------------

    const deleteParams = [userId];
    let deleteSql = `
        DELETE spa
        FROM sales_purchase_allocation spa
        INNER JOIN sales_details sd
            ON sd.sale_detail_id = spa.sale_detail_id
           AND sd.user_id       = spa.user_id
        INNER JOIN sales s
            ON s.sale_id   = sd.sale_id
           AND s.user_id  = sd.user_id
        WHERE spa.user_id = ?
    `;

    if (fromDate) {
        deleteSql += ` AND s.sale_date >= ?`;
        deleteParams.push(fromDate);
    }

    if (toDate) {
        deleteSql += ` AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)`;
        deleteParams.push(toDate);
    }

    await db.query(deleteSql, deleteParams);

    // --------------------------------------------------
    // 2. Load sale details in the range, oldest first
    // --------------------------------------------------

    const saleParams = [userId];
    let saleSql = `
        SELECT
            sd.sale_detail_id,
            sd.item_id,
            sd.quantity,
            s.sale_id,
            s.sale_date
        FROM sales_details sd
        INNER JOIN sales s
            ON s.sale_id   = sd.sale_id
           AND s.user_id  = sd.user_id
        WHERE sd.user_id = ?
    `;

    if (fromDate) {
        saleSql += ` AND s.sale_date >= ?`;
        saleParams.push(fromDate);
    }

    if (toDate) {
        saleSql += ` AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)`;
        saleParams.push(toDate);
    }

    saleSql += `
        ORDER BY s.sale_date ASC, s.sale_id ASC, sd.sale_detail_id ASC
    `;

    const [saleDetails] = await db.query(saleSql, saleParams);

    // --------------------------------------------------
    // 3. FIFO allocation per sale detail
    // --------------------------------------------------

    let allocationCount = 0;
    let incompleteCount = 0;

    for (const sd of saleDetails) {
        let remaining = round4(sd.quantity);

        const [purchaseDetails] = await db.query(
            `
            SELECT
                pd.purchase_detail_id,
                pd.quantity,
                pd.unit_price,
                p.purchase_date,
                COALESCE((
                    SELECT SUM(spa.allocated_quantity)
                    FROM sales_purchase_allocation spa
                    WHERE spa.purchase_detail_id = pd.purchase_detail_id
                      AND spa.user_id             = pd.user_id
                ), 0) AS already_allocated
            FROM purchase_details pd
            INNER JOIN purchases p
                ON p.purchase_id = pd.purchase_id
               AND p.user_id    = pd.user_id
            WHERE pd.item_id = ?
              AND pd.user_id = ?
            ORDER BY p.purchase_date ASC, pd.purchase_detail_id ASC
            `,
            [sd.item_id, userId]
        );

        for (const pd of purchaseDetails) {
            if (remaining <= 0) break;

            const available = round4(
                Number(pd.quantity) - Number(pd.already_allocated)
            );

            if (available <= 0) continue;

            const take = round4(Math.min(available, remaining));

            await db.query(
                `
                INSERT INTO sales_purchase_allocation
                    (
                        user_id,
                        sale_detail_id,
                        purchase_detail_id,
                        item_id,
                        allocated_quantity
                    )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    userId,
                    sd.sale_detail_id,
                    pd.purchase_detail_id,
                    sd.item_id,
                    take,
                ]
            );

            allocationCount += 1;
            remaining = round4(remaining - take);
        }

        if (remaining > 0) {
            incompleteCount += 1;
        }
    }

    return sendOk(
        res,
        {
            sale_details_processed: saleDetails.length,
            allocation_rows_created: allocationCount,
            incomplete_sale_details: incompleteCount,
        },
        "Allocation completed successfully."
    );
});

// ============================================================
// LIST ALL ALLOCATIONS
// GET /api/sales-purchase-allocations
// ============================================================

exports.getAllocations = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const [rows] = await db.query(
        `
        SELECT
            spa.allocation_id,

            spa.sale_detail_id,
            sd.sale_id,
            sd.quantity       AS sold_quantity,
            sd.unit_price     AS sale_unit_price,

            spa.purchase_detail_id,
            pd.unit_price     AS purchase_unit_price,

            spa.item_id,
            i.item_name,

            spa.allocated_quantity,

            (spa.allocated_quantity * pd.unit_price) AS allocated_cost,

            s.invoice_no      AS sale_invoice_no,
            s.sale_date,

            p.invoice_no      AS purchase_invoice_no,
            p.purchase_date,

            c.currency_id,
            c.currency_code,
            c.currency_name,
            c.symbol

        FROM sales_purchase_allocation spa

        INNER JOIN sales_details sd
            ON sd.sale_detail_id = spa.sale_detail_id
           AND sd.user_id       = spa.user_id

        INNER JOIN sales s
            ON s.sale_id  = sd.sale_id
           AND s.user_id = sd.user_id

        INNER JOIN purchase_details pd
            ON pd.purchase_detail_id = spa.purchase_detail_id
           AND pd.user_id           = spa.user_id

        INNER JOIN purchases p
            ON p.purchase_id = pd.purchase_id
           AND p.user_id    = pd.user_id

        INNER JOIN items i
            ON i.item_id  = spa.item_id
           AND i.user_id = spa.user_id

        INNER JOIN currencies c
            ON c.currency_id = s.currency_id
           AND c.user_id    = s.user_id

        WHERE spa.user_id = ?
        ORDER BY spa.allocation_id DESC
        `,
        [userId]
    );

    return sendOk(res, rows, "Allocations retrieved successfully.");
});

// ============================================================
// GET SINGLE ALLOCATION
// GET /api/sales-purchase-allocations/:id
// ============================================================

exports.getAllocationById = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const allocationId = Number(req.params.id);

    if (!Number.isInteger(allocationId) || allocationId <= 0) {
        throw new AppError(
            "Allocation ID must be a valid integer.",
            400,
            "INVALID_ALLOCATION_ID"
        );
    }

    const [rows] = await db.query(
        `
        SELECT
            spa.allocation_id,
            spa.sale_detail_id,
            spa.purchase_detail_id,
            spa.item_id,
            spa.allocated_quantity,

            sd.sale_id,
            sd.quantity   AS sold_quantity,
            sd.unit_price AS sale_unit_price,

            pd.unit_price AS purchase_unit_price,
            (spa.allocated_quantity * pd.unit_price) AS allocated_cost,

            i.item_name,

            s.invoice_no  AS sale_invoice_no,
            s.sale_date,
            p.invoice_no  AS purchase_invoice_no,
            p.purchase_date,

            c.currency_id,
            c.currency_code,
            c.currency_name,
            c.symbol

        FROM sales_purchase_allocation spa

        INNER JOIN sales_details sd
            ON sd.sale_detail_id = spa.sale_detail_id
           AND sd.user_id       = spa.user_id

        INNER JOIN sales s
            ON s.sale_id  = sd.sale_id
           AND s.user_id = sd.user_id

        INNER JOIN purchase_details pd
            ON pd.purchase_detail_id = spa.purchase_detail_id
           AND pd.user_id           = spa.user_id

        INNER JOIN purchases p
            ON p.purchase_id = pd.purchase_id
           AND p.user_id    = pd.user_id

        INNER JOIN items i
            ON i.item_id  = spa.item_id
           AND i.user_id = spa.user_id

        INNER JOIN currencies c
            ON c.currency_id = s.currency_id
           AND c.user_id    = s.user_id

        WHERE spa.allocation_id = ?
          AND spa.user_id       = ?
        `,
        [allocationId, userId]
    );

    if (rows.length === 0) {
        throw new AppError(
            "Allocation not found.",
            404,
            "ALLOCATION_NOT_FOUND"
        );
    }

    return sendOk(res, rows[0], "Allocation retrieved successfully.");
});

// ============================================================
// GET ALLOCATIONS FOR ONE SALE
// GET /api/sales-purchase-allocations/by-sale/:saleId
// ============================================================

exports.getAllocationsBySale = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const saleId = Number(req.params.saleId);

    if (!Number.isInteger(saleId) || saleId <= 0) {
        throw new AppError(
            "Sale ID must be a valid integer.",
            400,
            "INVALID_SALE_ID"
        );
    }

    const [sale] = await db.query(
        `SELECT sale_id FROM sales WHERE sale_id = ? AND user_id = ?`,
        [saleId, userId]
    );

    if (sale.length === 0) {
        throw new AppError("Sale not found.", 404, "SALE_NOT_FOUND");
    }

    const [rows] = await db.query(
        `
        SELECT
            spa.allocation_id,
            spa.sale_detail_id,
            spa.purchase_detail_id,
            spa.item_id,
            spa.allocated_quantity,
            pd.unit_price AS purchase_unit_price,
            (spa.allocated_quantity * pd.unit_price) AS allocated_cost,
            i.item_name,
            p.invoice_no  AS purchase_invoice_no,
            p.purchase_date
        FROM sales_purchase_allocation spa
        INNER JOIN sales_details sd
            ON sd.sale_detail_id = spa.sale_detail_id
           AND sd.user_id       = spa.user_id
        INNER JOIN purchase_details pd
            ON pd.purchase_detail_id = spa.purchase_detail_id
           AND pd.user_id           = spa.user_id
        INNER JOIN purchases p
            ON p.purchase_id = pd.purchase_id
           AND p.user_id    = pd.user_id
        INNER JOIN items i
            ON i.item_id  = spa.item_id
           AND i.user_id = spa.user_id
        WHERE spa.user_id = ?
          AND sd.sale_id  = ?
        ORDER BY spa.allocation_id ASC
        `,
        [userId, saleId]
    );

    return sendOk(res, rows, "Sale allocations retrieved successfully.");
});
// ============================================================
// GET AVAILABLE SALE DETAILS (for dropdown)
// GET /api/sales-purchase-allocations/sale-details
// ============================================================

exports.getSaleDetailsForAllocation = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const [rows] = await db.query(
        `
        SELECT
            sd.sale_detail_id,
            sd.sale_id,
            s.invoice_no,
            s.sale_date,
            sd.item_id,
            i.item_name,
            sd.quantity       AS sale_quantity,
            sd.unit_price,
            COALESCE((
                SELECT SUM(spa.allocated_quantity)
                FROM sales_purchase_allocation spa
                WHERE spa.sale_detail_id = sd.sale_detail_id
                  AND spa.user_id        = sd.user_id
            ), 0) AS allocated_quantity,
            sd.quantity - COALESCE((
                SELECT SUM(spa.allocated_quantity)
                FROM sales_purchase_allocation spa
                WHERE spa.sale_detail_id = sd.sale_detail_id
                  AND spa.user_id        = sd.user_id
            ), 0) AS remaining_quantity
        FROM sales_details sd
        INNER JOIN sales s
            ON s.sale_id  = sd.sale_id
           AND s.user_id = sd.user_id
        INNER JOIN items i
            ON i.item_id  = sd.item_id
           AND i.user_id = sd.user_id
        WHERE sd.user_id = ?
        ORDER BY s.sale_date ASC, sd.sale_detail_id ASC
        `,
        [userId]
    );

    return sendOk(res, rows, "Sale details retrieved successfully.");
});

// ============================================================
// GET AVAILABLE PURCHASE DETAILS (for dropdown)
// GET /api/sales-purchase-allocations/purchase-details
// ============================================================

exports.getPurchaseDetailsForAllocation = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const [rows] = await db.query(
        `
        SELECT
            pd.purchase_detail_id,
            pd.purchase_id,
            p.invoice_no,
            p.purchase_date,
            pd.item_id,
            i.item_name,
            pd.quantity       AS purchase_quantity,
            pd.unit_price,
            COALESCE((
                SELECT SUM(spa.allocated_quantity)
                FROM sales_purchase_allocation spa
                WHERE spa.purchase_detail_id = pd.purchase_detail_id
                  AND spa.user_id             = pd.user_id
            ), 0) AS allocated_quantity,
            pd.quantity - COALESCE((
                SELECT SUM(spa.allocated_quantity)
                FROM sales_purchase_allocation spa
                WHERE spa.purchase_detail_id = pd.purchase_detail_id
                  AND spa.user_id             = pd.user_id
            ), 0) AS remaining_quantity
        FROM purchase_details pd
        INNER JOIN purchases p
            ON p.purchase_id = pd.purchase_id
           AND p.user_id    = pd.user_id
        INNER JOIN items i
            ON i.item_id  = pd.item_id
           AND i.user_id = pd.user_id
        WHERE pd.user_id = ?
        ORDER BY p.purchase_date ASC, pd.purchase_detail_id ASC
        `,
        [userId]
    );

    return sendOk(res, rows, "Purchase details retrieved successfully.");
});

// ============================================================
// CREATE SINGLE ALLOCATION (manual)
// POST /api/sales-purchase-allocations
// ============================================================

exports.createAllocation = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const {
        sale_detail_id,
        purchase_detail_id,
        item_id,
        allocated_quantity,
    } = req.body || {};

    if (
        sale_detail_id === undefined || sale_detail_id === null ||
        purchase_detail_id === undefined || purchase_detail_id === null ||
        item_id === undefined || item_id === null ||
        allocated_quantity === undefined || allocated_quantity === null
    ) {
        throw new AppError(
            "sale_detail_id, purchase_detail_id, item_id and allocated_quantity are required.",
            400,
            "MISSING_FIELDS"
        );
    }

    const saleDetailId = Number(sale_detail_id);
    const purchaseDetailId = Number(purchase_detail_id);
    const itemId = Number(item_id);
    const qty = Number(allocated_quantity);

    if (!Number.isInteger(saleDetailId) || saleDetailId <= 0) {
        throw new AppError("Invalid sale_detail_id.", 400, "INVALID_SALE_DETAIL_ID");
    }
    if (!Number.isInteger(purchaseDetailId) || purchaseDetailId <= 0) {
        throw new AppError("Invalid purchase_detail_id.", 400, "INVALID_PURCHASE_DETAIL_ID");
    }
    if (!Number.isInteger(itemId) || itemId <= 0) {
        throw new AppError("Invalid item_id.", 400, "INVALID_ITEM_ID");
    }
    if (!Number.isFinite(qty) || qty <= 0) {
        throw new AppError("allocated_quantity must be greater than zero.", 400, "INVALID_QUANTITY");
    }

    // Verify ownership of both details
    const [saleRows] = await db.query(
        `SELECT sale_detail_id, item_id, quantity
         FROM sales_details
         WHERE sale_detail_id = ? AND user_id = ?`,
        [saleDetailId, userId]
    );

    if (saleRows.length === 0) {
        throw new AppError("Sale detail not found.", 404, "SALE_DETAIL_NOT_FOUND");
    }

    if (Number(saleRows[0].item_id) !== itemId) {
        throw new AppError(
            "item_id does not match the sale detail.",
            400,
            "ITEM_MISMATCH"
        );
    }

    const [purchaseRows] = await db.query(
        `SELECT purchase_detail_id, item_id, quantity
         FROM purchase_details
         WHERE purchase_detail_id = ? AND user_id = ?`,
        [purchaseDetailId, userId]
    );

    if (purchaseRows.length === 0) {
        throw new AppError("Purchase detail not found.", 404, "PURCHASE_DETAIL_NOT_FOUND");
    }

    if (Number(purchaseRows[0].item_id) !== itemId) {
        throw new AppError(
            "item_id does not match the purchase detail.",
            400,
            "ITEM_MISMATCH"
        );
    }

    // How much is already allocated on each side?
    const [saleAllocated] = await db.query(
        `SELECT COALESCE(SUM(allocated_quantity), 0) AS total
         FROM sales_purchase_allocation
         WHERE sale_detail_id = ? AND user_id = ?`,
        [saleDetailId, userId]
    );

    const [purchaseAllocated] = await db.query(
        `SELECT COALESCE(SUM(allocated_quantity), 0) AS total
         FROM sales_purchase_allocation
         WHERE purchase_detail_id = ? AND user_id = ?`,
        [purchaseDetailId, userId]
    );

    const saleRemaining = Number(saleRows[0].quantity) - Number(saleAllocated[0].total);
    const purchaseRemaining = Number(purchaseRows[0].quantity) - Number(purchaseAllocated[0].total);

    if (qty > saleRemaining + 1e-6) {
        throw new AppError(
            `Quantity exceeds sale remaining (${saleRemaining}).`,
            400,
            "QUANTITY_EXCEEDS_SALE"
        );
    }

    if (qty > purchaseRemaining + 1e-6) {
        throw new AppError(
            `Quantity exceeds purchase remaining (${purchaseRemaining}).`,
            400,
            "QUANTITY_EXCEEDS_PURCHASE"
        );
    }

    const [result] = await db.query(
        `
        INSERT INTO sales_purchase_allocation
            (user_id, sale_detail_id, purchase_detail_id, item_id, allocated_quantity)
        VALUES (?, ?, ?, ?, ?)
        `,
        [userId, saleDetailId, purchaseDetailId, itemId, qty]
    );

    // Return the full allocation row via the existing getter shape
    const [rows] = await db.query(
        `
        SELECT
            spa.allocation_id,
            spa.sale_detail_id,
            spa.purchase_detail_id,
            spa.item_id,
            spa.allocated_quantity,
            i.item_name,
            sd.sale_id,
            s.invoice_no AS sale_invoice_no,
            s.sale_date,
            sd.quantity AS sale_quantity,
            sd.unit_price AS sale_unit_price,
            pd.purchase_id,
            p.invoice_no AS purchase_invoice_no,
            p.purchase_date,
            pd.quantity AS purchase_quantity,
            pd.unit_price AS purchase_unit_price
        FROM sales_purchase_allocation spa
        INNER JOIN sales_details sd
            ON sd.sale_detail_id = spa.sale_detail_id
           AND sd.user_id       = spa.user_id
        INNER JOIN sales s
            ON s.sale_id  = sd.sale_id
           AND s.user_id = sd.user_id
        INNER JOIN purchase_details pd
            ON pd.purchase_detail_id = spa.purchase_detail_id
           AND pd.user_id           = spa.user_id
        INNER JOIN purchases p
            ON p.purchase_id = pd.purchase_id
           AND p.user_id    = pd.user_id
        INNER JOIN items i
            ON i.item_id  = spa.item_id
           AND i.user_id = spa.user_id
        WHERE spa.allocation_id = ?
          AND spa.user_id       = ?
        `,
        [result.insertId, userId]
    );

    return res.status(201).json({
        success: true,
        message: "Allocation created successfully.",
        data: rows[0],
    });
});

// ============================================================
// UPDATE SINGLE ALLOCATION
// PUT /api/sales-purchase-allocations/:id
// ============================================================

exports.updateAllocation = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const allocationId = Number(req.params.id);

    if (!Number.isInteger(allocationId) || allocationId <= 0) {
        throw new AppError("Invalid allocation ID.", 400, "INVALID_ALLOCATION_ID");
    }

    const { allocated_quantity } = req.body || {};
    const qty = Number(allocated_quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
        throw new AppError(
            "allocated_quantity must be greater than zero.",
            400,
            "INVALID_QUANTITY"
        );
    }

    const [existing] = await db.query(
        `SELECT * FROM sales_purchase_allocation
         WHERE allocation_id = ? AND user_id = ?`,
        [allocationId, userId]
    );

    if (existing.length === 0) {
        throw new AppError("Allocation not found.", 404, "ALLOCATION_NOT_FOUND");
    }

    await db.query(
        `UPDATE sales_purchase_allocation
         SET allocated_quantity = ?
         WHERE allocation_id = ? AND user_id = ?`,
        [qty, allocationId, userId]
    );

    return sendOk(res, { allocation_id: allocationId }, "Allocation updated successfully.");
});

// ============================================================
// DELETE SINGLE ALLOCATION
// DELETE /api/sales-purchase-allocations/:id
// ============================================================

exports.deleteAllocation = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const allocationId = Number(req.params.id);

    if (!Number.isInteger(allocationId) || allocationId <= 0) {
        throw new AppError("Invalid allocation ID.", 400, "INVALID_ALLOCATION_ID");
    }

    const [result] = await db.query(
        `DELETE FROM sales_purchase_allocation
         WHERE allocation_id = ? AND user_id = ?`,
        [allocationId, userId]
    );

    if (result.affectedRows === 0) {
        throw new AppError("Allocation not found.", 404, "ALLOCATION_NOT_FOUND");
    }

    return sendOk(res, { allocation_id: allocationId }, "Allocation deleted successfully.");
});
// ============================================================
// CLEAR ALL ALLOCATIONS FOR CURRENT USER
// DELETE /api/sales-purchase-allocations
// ============================================================

exports.clearAllocations = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const [result] = await db.query(
        `DELETE FROM sales_purchase_allocation WHERE user_id = ?`,
        [userId]
    );

    return sendOk(
        res,
        { deleted_rows: result.affectedRows },
        "All allocations cleared."
    );
});

const db = require("../config/database.js");
const AppError = require("../utils/AppError");

// ============================================================
// COMMON HELPERS
// ============================================================

const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

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

function getDateRange(req) {
    const fromDate = validateDate(req.query.from_date, "from_date");
    const toDate = validateDate(req.query.to_date, "to_date");

    if (fromDate && toDate && fromDate > toDate) {
        throw new AppError(
            "from_date cannot be later than to_date.",
            400,
            "INVALID_DATE_RANGE"
        );
    }

    return { fromDate, toDate };
}

function dateFilter(column, fromDate, toDate, params) {
    let sql = "";

    if (fromDate) {
        sql += ` AND ${column} >= ?`;
        params.push(fromDate);
    }

    if (toDate) {
        sql += ` AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`;
        params.push(toDate);
    }

    return sql;
}

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

// Convert an amount from one currency into another using the latest
// exchange rate whose effective_date is on or before the transaction date.
//
// The expression returns NULL if neither direction has an applicable rate.
// Same-currency amounts are returned unchanged.
function convertAmount(
    amountExpression,
    fromCurrencyExpression,
    toCurrencyExpression,
    dateExpression,
    userIdExpression
) {
    return `
        CASE
            WHEN ${fromCurrencyExpression} = ${toCurrencyExpression}
                THEN ${amountExpression}
            ELSE
                ${amountExpression} * COALESCE(
                    (
                        SELECT er.rate
                        FROM exchange_rate er
                        WHERE er.user_id = ${userIdExpression}
                          AND er.from_currency_id = ${fromCurrencyExpression}
                          AND er.to_currency_id = ${toCurrencyExpression}
                          AND er.effective_date <= DATE(${dateExpression})
                          AND er.rate > 0
                        ORDER BY er.effective_date DESC,
                                 er.exchange_rate_id DESC
                        LIMIT 1
                    ),
                    (
                        SELECT 1 / er.rate
                        FROM exchange_rate er
                        WHERE er.user_id = ${userIdExpression}
                          AND er.from_currency_id = ${toCurrencyExpression}
                          AND er.to_currency_id = ${fromCurrencyExpression}
                          AND er.effective_date <= DATE(${dateExpression})
                          AND er.rate > 0
                        ORDER BY er.effective_date DESC,
                                 er.exchange_rate_id DESC
                        LIMIT 1
                    )
                )
        END
    `;
}

function sendReport(res, data, message = "Report retrieved successfully.") {
    return res.status(200).json({
        success: true,
        message,
        count: data.length,
        data,
    });
}

// ============================================================
// 1. SALES REPORT
// GET /api/reports/sales
// ============================================================

exports.getSalesReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromDate, toDate } = getDateRange(req);

    const params = [userId];
    const filter = dateFilter(
        "s.sale_date",
        fromDate,
        toDate,
        params
    );

    const [rows] = await db.query(
        `
        SELECT
            s.sale_id,
            s.invoice_no,
            s.sale_date,
            s.customer_id,
            c.customer_name,
            s.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol AS currency_symbol,
            COUNT(sd.sale_detail_id) AS line_count,
            COALESCE(
                SUM(sd.quantity * sd.unit_price),
                0
            ) AS total_sales
        FROM sales s
        LEFT JOIN customers c
            ON c.customer_id = s.customer_id
           AND c.user_id = s.user_id
        JOIN currencies cur
            ON cur.currency_id = s.currency_id
           AND cur.user_id = s.user_id
        LEFT JOIN sales_details sd
            ON sd.sale_id = s.sale_id
           AND sd.user_id = s.user_id
        WHERE s.user_id = ?
        ${filter}
        GROUP BY
            s.sale_id,
            s.invoice_no,
            s.sale_date,
            s.customer_id,
            c.customer_name,
            s.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol
        ORDER BY s.sale_date DESC, s.sale_id DESC
        `,
        params
    );

    return sendReport(res, rows);
});

// ============================================================
// 2. PURCHASES REPORT
// GET /api/reports/purchases
// ============================================================

exports.getPurchasesReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromDate, toDate } = getDateRange(req);

    const params = [userId];
    const filter = dateFilter(
        "p.purchase_date",
        fromDate,
        toDate,
        params
    );

    const [rows] = await db.query(
        `
        SELECT
            p.purchase_id,
            p.invoice_no,
            p.purchase_date,
            p.vendor_id,
            v.vendor_name,
            p.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol AS currency_symbol,
            COUNT(pd.purchase_detail_id) AS line_count,
            COALESCE(
                SUM(pd.quantity * pd.unit_price),
                0
            ) AS total_purchase
        FROM purchases p
        LEFT JOIN vendors v
            ON v.vendor_id = p.vendor_id
           AND v.user_id = p.user_id
        JOIN currencies cur
            ON cur.currency_id = p.currency_id
           AND cur.user_id = p.user_id
        LEFT JOIN purchase_details pd
            ON pd.purchase_id = p.purchase_id
           AND pd.user_id = p.user_id
        WHERE p.user_id = ?
        ${filter}
        GROUP BY
            p.purchase_id,
            p.invoice_no,
            p.purchase_date,
            p.vendor_id,
            v.vendor_name,
            p.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol
        ORDER BY p.purchase_date DESC, p.purchase_id DESC
        `,
        params
    );

    return sendReport(res, rows);
});

// ============================================================
// 3. CUSTOMER PAYMENTS REPORT
// GET /api/reports/customer-payments
// ============================================================

exports.getCustomerPaymentsReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromDate, toDate } = getDateRange(req);

    const params = [userId];
    const filter = dateFilter(
        "cp.payment_date",
        fromDate,
        toDate,
        params
    );

    const [rows] = await db.query(
        `
        SELECT
            cp.customer_payment_id,
            cp.payment_date,
            cp.customer_id,
            c.customer_name,
            cp.sale_id,
            s.invoice_no,
            cp.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol AS currency_symbol,
            cp.amount
        FROM customer_payment cp
        JOIN customers c
            ON c.customer_id = cp.customer_id
           AND c.user_id = cp.user_id
        JOIN currencies cur
            ON cur.currency_id = cp.currency_id
           AND cur.user_id = cp.user_id
        LEFT JOIN sales s
            ON s.sale_id = cp.sale_id
           AND s.user_id = cp.user_id
        WHERE cp.user_id = ?
        ${filter}
        ORDER BY cp.payment_date DESC, cp.customer_payment_id DESC
        `,
        params
    );

    return sendReport(res, rows);
});

// ============================================================
// 4. VENDOR PAYMENTS REPORT
// GET /api/reports/vendor-payments
// ============================================================

exports.getVendorPaymentsReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromDate, toDate } = getDateRange(req);

    const params = [userId];
    const filter = dateFilter(
        "pp.payment_date",
        fromDate,
        toDate,
        params
    );

    const [rows] = await db.query(
        `
        SELECT
            pp.payment_id,
            pp.payment_date,
            pp.vendor_id,
            v.vendor_name,
            pp.purchase_id,
            p.invoice_no,
            pp.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol AS currency_symbol,
            pp.amount
        FROM purchase_payment pp
        JOIN vendors v
            ON v.vendor_id = pp.vendor_id
           AND v.user_id = pp.user_id
        JOIN currencies cur
            ON cur.currency_id = pp.currency_id
           AND cur.user_id = pp.user_id
        LEFT JOIN purchases p
            ON p.purchase_id = pp.purchase_id
           AND p.user_id = pp.user_id
        WHERE pp.user_id = ?
        ${filter}
        ORDER BY pp.payment_date DESC, pp.payment_id DESC
        `,
        params
    );

    // Do not require the payment currency to equal the purchase currency.
    // A valid payment must not disappear merely because those currencies differ.
    return sendReport(res, rows);
});

// ============================================================
// 5. CUSTOMER BALANCES BY SALE CURRENCY
// GET /api/reports/customer-balances
//
// Payments are converted into the related sale's currency using the
// exchange rate effective on the payment date. Missing rates stay NULL.
// ============================================================

exports.getCustomerBalancesReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const convertedPayment = convertAmount(
        "cp.amount",
        "cp.currency_id",
        "s.currency_id",
        "cp.payment_date",
        "cp.user_id"
    );

    const [rows] = await db.query(
        `
        SELECT
            c.customer_id,
            c.customer_name,
            s.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol AS currency_symbol,
            COALESCE(st.total_sales, 0) AS total_sales,
            COALESCE(pt.total_payments, 0) AS total_payments,
            CASE
                WHEN COALESCE(pt.unconverted_payments, 0) > 0
                    THEN NULL
                ELSE COALESCE(st.total_sales, 0)
                     - COALESCE(pt.total_payments, 0)
            END AS balance,
            CASE
                WHEN COALESCE(pt.unconverted_payments, 0) > 0
                    THEN 'MISSING_EXCHANGE_RATE'
                ELSE 'OK'
            END AS calculation_status
        FROM (
            SELECT
                s.user_id,
                s.customer_id,
                s.currency_id,
                SUM(sd.quantity * sd.unit_price) AS total_sales
            FROM sales s
            JOIN sales_details sd
                ON sd.sale_id = s.sale_id
               AND sd.user_id = s.user_id
            WHERE s.user_id = ?
            GROUP BY s.user_id, s.customer_id, s.currency_id
        ) st
        JOIN sales s
            ON s.user_id = st.user_id
           AND s.customer_id = st.customer_id
           AND s.currency_id = st.currency_id
        JOIN customers c
            ON c.customer_id = st.customer_id
           AND c.user_id = st.user_id
        JOIN currencies cur
            ON cur.currency_id = st.currency_id
           AND cur.user_id = st.user_id
        LEFT JOIN (
            SELECT
                s.user_id,
                cp.customer_id,
                s.currency_id,
                SUM(${convertedPayment}) AS total_payments,
                SUM(
                    CASE
                        WHEN cp.currency_id <> s.currency_id
                         AND ${convertedPayment} IS NULL
                        THEN 1 ELSE 0
                    END
                ) AS unconverted_payments
            FROM customer_payment cp
            JOIN sales s
                ON s.sale_id = cp.sale_id
               AND s.user_id = cp.user_id
            WHERE cp.user_id = ?
            GROUP BY s.user_id, cp.customer_id, s.currency_id
        ) pt
            ON pt.user_id = st.user_id
           AND pt.customer_id = st.customer_id
           AND pt.currency_id = st.currency_id
        GROUP BY
            c.customer_id,
            c.customer_name,
            s.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol,
            st.total_sales,
            pt.total_payments,
            pt.unconverted_payments
        ORDER BY c.customer_name, cur.currency_code
        `,
        [userId, userId]
    );

    return sendReport(res, rows);
});

// ============================================================
// 6. VENDOR BALANCES BY PURCHASE CURRENCY
// GET /api/reports/vendor-balances
//
// Payments are converted into the related purchase's currency using
// the exchange rate effective on the payment date.
// ============================================================

exports.getVendorBalancesReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const convertedPayment = convertAmount(
        "pp.amount",
        "pp.currency_id",
        "p.currency_id",
        "pp.payment_date",
        "pp.user_id"
    );

    const [rows] = await db.query(
        `
        SELECT
            v.vendor_id,
            v.vendor_name,
            pt.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol AS currency_symbol,
            pt.total_purchases,
            COALESCE(pay.total_payments, 0) AS total_payments,
            CASE
                WHEN COALESCE(pay.unconverted_payments, 0) > 0
                    THEN NULL
                ELSE pt.total_purchases
                     - COALESCE(pay.total_payments, 0)
            END AS balance,
            CASE
                WHEN COALESCE(pay.unconverted_payments, 0) > 0
                    THEN 'MISSING_EXCHANGE_RATE'
                ELSE 'OK'
            END AS calculation_status
        FROM (
            SELECT
                p.user_id,
                p.vendor_id,
                p.currency_id,
                SUM(pd.quantity * pd.unit_price) AS total_purchases
            FROM purchases p
            JOIN purchase_details pd
                ON pd.purchase_id = p.purchase_id
               AND pd.user_id = p.user_id
            WHERE p.user_id = ?
            GROUP BY p.user_id, p.vendor_id, p.currency_id
        ) pt
        JOIN vendors v
            ON v.vendor_id = pt.vendor_id
           AND v.user_id = pt.user_id
        JOIN currencies cur
            ON cur.currency_id = pt.currency_id
           AND cur.user_id = pt.user_id
        LEFT JOIN (
            SELECT
                p.user_id,
                pp.vendor_id,
                p.currency_id,
                SUM(${convertedPayment}) AS total_payments,
                SUM(
                    CASE
                        WHEN pp.currency_id <> p.currency_id
                         AND ${convertedPayment} IS NULL
                        THEN 1 ELSE 0
                    END
                ) AS unconverted_payments
            FROM purchase_payment pp
            JOIN purchases p
                ON p.purchase_id = pp.purchase_id
               AND p.user_id = pp.user_id
            WHERE pp.user_id = ?
            GROUP BY p.user_id, pp.vendor_id, p.currency_id
        ) pay
            ON pay.user_id = pt.user_id
           AND pay.vendor_id = pt.vendor_id
           AND pay.currency_id = pt.currency_id
        ORDER BY v.vendor_name, cur.currency_code
        `,
        [userId, userId]
    );

    return sendReport(res, rows);
});

// ============================================================
// 7. INVENTORY REPORT
// GET /api/reports/inventory
//
// Current stock = IN movements - OUT movements.
// This depends on stock_movements being maintained correctly.
// ============================================================

exports.getInventoryReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const [rows] = await db.query(
        `
        SELECT
            i.item_id,
            i.item_name,
            i.barcode,
            i.category_id,
            c.category_name,
            i.unit_id,
            u.unit_name,
            COALESCE(sm.total_in, 0) AS total_in,
            COALESCE(sm.total_out, 0) AS total_out,
            COALESCE(sm.total_in, 0)
                - COALESCE(sm.total_out, 0) AS current_stock
        FROM items i
        LEFT JOIN categories c
            ON c.category_id = i.category_id
           AND c.user_id = i.user_id
        LEFT JOIN units u
            ON u.unit_id = i.unit_id
           AND u.user_id = i.user_id
        LEFT JOIN (
            SELECT
                user_id,
                item_id,
                SUM(
                    CASE WHEN movement_type = 'IN'
                         THEN quantity ELSE 0 END
                ) AS total_in,
                SUM(
                    CASE WHEN movement_type = 'OUT'
                         THEN quantity ELSE 0 END
                ) AS total_out
            FROM stock_movements
            WHERE user_id = ?
            GROUP BY user_id, item_id
        ) sm
            ON sm.user_id = i.user_id
           AND sm.item_id = i.item_id
        WHERE i.user_id = ?
        ORDER BY i.item_name
        `,
        [userId, userId]
    );

    return sendReport(res, rows);
});

// ============================================================
// 8. ITEM SALES REPORT
// GET /api/reports/item-sales
//
// Monetary totals remain separate for each currency.
// Quantities are reported per item, unit, and currency.
// ============================================================

exports.getItemSalesReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromDate, toDate } = getDateRange(req);

    const params = [userId];
    const filter = dateFilter(
        "s.sale_date",
        fromDate,
        toDate,
        params
    );

    const [rows] = await db.query(
        `
        SELECT
            i.item_id,
            i.item_name,
            i.unit_id,
            u.unit_name,
            s.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol AS currency_symbol,
            SUM(sd.quantity) AS quantity_sold,
            SUM(sd.quantity * sd.unit_price) AS total_sales
        FROM sales_details sd
        JOIN sales s
            ON s.sale_id = sd.sale_id
           AND s.user_id = sd.user_id
        JOIN items i
            ON i.item_id = sd.item_id
           AND i.user_id = sd.user_id
        LEFT JOIN units u
            ON u.unit_id = i.unit_id
           AND u.user_id = i.user_id
        JOIN currencies cur
            ON cur.currency_id = s.currency_id
           AND cur.user_id = s.user_id
        WHERE sd.user_id = ?
        ${filter}
        GROUP BY
            i.item_id,
            i.item_name,
            i.unit_id,
            u.unit_name,
            s.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol
        ORDER BY i.item_name, cur.currency_code
        `,
        params
    );

    return sendReport(res, rows);
});

// ============================================================
// 9. ITEM PURCHASES REPORT
// GET /api/reports/item-purchases
// ============================================================

exports.getItemPurchasesReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromDate, toDate } = getDateRange(req);

    const params = [userId];
    const filter = dateFilter(
        "p.purchase_date",
        fromDate,
        toDate,
        params
    );

    const [rows] = await db.query(
        `
        SELECT
            i.item_id,
            i.item_name,
            i.unit_id,
            u.unit_name,
            p.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol AS currency_symbol,
            SUM(pd.quantity) AS quantity_purchased,
            SUM(pd.quantity * pd.unit_price) AS total_purchase
        FROM purchase_details pd
        JOIN purchases p
            ON p.purchase_id = pd.purchase_id
           AND p.user_id = pd.user_id
        JOIN items i
            ON i.item_id = pd.item_id
           AND i.user_id = pd.user_id
        LEFT JOIN units u
            ON u.unit_id = i.unit_id
           AND u.user_id = i.user_id
        JOIN currencies cur
            ON cur.currency_id = p.currency_id
           AND cur.user_id = p.user_id
        WHERE pd.user_id = ?
        ${filter}
        GROUP BY
            i.item_id,
            i.item_name,
            i.unit_id,
            u.unit_name,
            p.currency_id,
            cur.currency_name,
            cur.currency_code,
            cur.symbol
        ORDER BY i.item_name, cur.currency_code
        `,
        params
    );

    return sendReport(res, rows);
});

// ============================================================
// 10. GROSS PROFIT REPORT
// GET /api/reports/profit
//
// Revenue is grouped by sale currency.
// Allocated purchase cost is converted into that sale currency using
// the exchange rate effective on the purchase date.
//
// Profit is NULL if a sale line is not fully allocated or if an
// applicable exchange rate is missing. This avoids claiming a false
// profit when cost data is incomplete.
// ============================================================


exports.getProfitReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fromDate, toDate } = getDateRange(req);

    const revenueDateParams = [];
    const revenueDateFilter = dateFilter(
        "s.sale_date",
        fromDate,
        toDate,
        revenueDateParams
    );

    const costDateParams = [];
    const costDateFilter = dateFilter(
        "s.sale_date",
        fromDate,
        toDate,
        costDateParams
    );

    const convertedCost = convertAmount(
        "(a.allocated_quantity * pd.unit_price)",
        "p.currency_id",
        "s.currency_id",
        "p.purchase_date",
        "a.user_id"
    );

    const [rows] = await db.query(
        `
        SELECT
            rev.item_id,
            rev.item_name,
            rev.unit_id,
            rev.unit_name,
            rev.currency_id,
            rev.currency_name,
            rev.currency_code,
            rev.currency_symbol,
            rev.quantity_sold,
            rev.revenue,
            COALESCE(cost.allocated_quantity, 0) AS allocated_quantity,
            cost.allocated_cost,
            CASE
                WHEN COALESCE(cost.allocated_sale_lines, 0)
                     < rev.sale_lines
                    THEN NULL
                WHEN COALESCE(cost.incomplete_lines, 0) > 0
                    THEN NULL
                WHEN COALESCE(cost.unconverted_cost_lines, 0) > 0
                    THEN NULL
                WHEN cost.allocated_cost IS NULL
                    THEN NULL
                ELSE rev.revenue - cost.allocated_cost
            END AS gross_profit,
            CASE
                WHEN COALESCE(cost.allocated_sale_lines, 0)
                     < rev.sale_lines
                    THEN 'INCOMPLETE_ALLOCATION'
                WHEN COALESCE(cost.incomplete_lines, 0) > 0
                    THEN 'INCOMPLETE_ALLOCATION'
                WHEN COALESCE(cost.unconverted_cost_lines, 0) > 0
                    THEN 'MISSING_EXCHANGE_RATE'
                WHEN cost.allocated_cost IS NULL
                    THEN 'COST_UNAVAILABLE'
                ELSE 'OK'
            END AS calculation_status
        FROM (
            SELECT
                i.item_id,
                i.item_name,
                i.unit_id,
                u.unit_name,
                s.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol AS currency_symbol,
                SUM(sd.quantity) AS quantity_sold,
                SUM(sd.quantity * sd.unit_price) AS revenue,
                COUNT(DISTINCT sd.sale_detail_id) AS sale_lines
            FROM sales_details sd
            JOIN sales s
                ON s.sale_id = sd.sale_id
               AND s.user_id = sd.user_id
            JOIN items i
                ON i.item_id = sd.item_id
               AND i.user_id = sd.user_id
            LEFT JOIN units u
                ON u.unit_id = i.unit_id
               AND u.user_id = i.user_id
            JOIN currencies cur
                ON cur.currency_id = s.currency_id
               AND cur.user_id = s.user_id
            WHERE sd.user_id = ?
            ${revenueDateFilter}
            GROUP BY
                i.item_id,
                i.item_name,
                i.unit_id,
                u.unit_name,
                s.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol
        ) rev
        LEFT JOIN (
            SELECT
                sd.item_id,
                s.currency_id,
                SUM(a.allocated_quantity) AS allocated_quantity,
                SUM(${convertedCost}) AS allocated_cost,
                COUNT(DISTINCT sd.sale_detail_id) AS allocated_sale_lines,
                SUM(
                    CASE
                        WHEN ${convertedCost} IS NULL THEN 1
                        ELSE 0
                    END
                ) AS unconverted_cost_lines,
                SUM(
                    CASE
                        WHEN alloc.line_allocated < sd.quantity
                            THEN 1
                        ELSE 0
                    END
                ) AS incomplete_lines
            FROM sales_details sd
            JOIN sales s
                ON s.sale_id = sd.sale_id
               AND s.user_id = sd.user_id
            JOIN sales_purchase_allocation a
                ON a.sale_detail_id = sd.sale_detail_id
               AND a.user_id = sd.user_id
            JOIN purchase_details pd
                ON pd.purchase_detail_id = a.purchase_detail_id
               AND pd.user_id = a.user_id
            JOIN purchases p
                ON p.purchase_id = pd.purchase_id
               AND p.user_id = pd.user_id
            JOIN (
                SELECT
                    user_id,
                    sale_detail_id,
                    SUM(allocated_quantity) AS line_allocated
                FROM sales_purchase_allocation
                WHERE user_id = ?
                GROUP BY user_id, sale_detail_id
            ) alloc
                ON alloc.user_id = sd.user_id
               AND alloc.sale_detail_id = sd.sale_detail_id
            WHERE sd.user_id = ?
            ${costDateFilter}
            GROUP BY sd.item_id, s.currency_id
        ) cost
            ON cost.item_id = rev.item_id
           AND cost.currency_id = rev.currency_id
        ORDER BY rev.item_name, rev.currency_code
        `,
        [
            userId,
            ...revenueDateParams,
            userId,
            userId,
            ...costDateParams,
        ]
    );

    return sendReport(res, rows);
});


// ============================================================
// 11. DAILY SUMMARY
// GET /api/reports/daily-summary?date=YYYY-MM-DD
//
// If date is omitted, today's date in the database server's time zone
// is used. Totals are returned separately per currency.
// ============================================================

exports.getDailySummaryReport = asyncHandler(async (req, res) => {
    const userId = getUserId(req);

    const requestedDate = validateDate(req.query.date, "date");

    const [dateRows] = requestedDate
        ? [[{ report_date: requestedDate }]]
        : await db.query(
            "SELECT CURRENT_DATE() AS report_date"
        );

    const reportDate = dateRows[0].report_date;

    const [
        [salesRows],
        [purchaseRows],
        [customerPaymentRows],
        [vendorPaymentRows],
    ] = await Promise.all([
        db.query(
            `
            SELECT
                s.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol AS currency_symbol,
                COUNT(DISTINCT s.sale_id) AS invoice_count,
                COALESCE(SUM(sd.quantity * sd.unit_price), 0)
                    AS total_sales
            FROM sales s
            JOIN currencies cur
                ON cur.currency_id = s.currency_id
               AND cur.user_id = s.user_id
            LEFT JOIN sales_details sd
                ON sd.sale_id = s.sale_id
               AND sd.user_id = s.user_id
            WHERE s.user_id = ?
              AND s.sale_date >= ?
              AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY
                s.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol
            ORDER BY cur.currency_code
            `,
            [userId, reportDate, reportDate]
        ),
        db.query(
            `
            SELECT
                p.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol AS currency_symbol,
                COUNT(DISTINCT p.purchase_id) AS invoice_count,
                COALESCE(SUM(pd.quantity * pd.unit_price), 0)
                    AS total_purchase
            FROM purchases p
            JOIN currencies cur
                ON cur.currency_id = p.currency_id
               AND cur.user_id = p.user_id
            LEFT JOIN purchase_details pd
                ON pd.purchase_id = p.purchase_id
               AND pd.user_id = p.user_id
            WHERE p.user_id = ?
              AND p.purchase_date >= ?
              AND p.purchase_date < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY
                p.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol
            ORDER BY cur.currency_code
            `,
            [userId, reportDate, reportDate]
        ),
        db.query(
            `
            SELECT
                cp.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol AS currency_symbol,
                COUNT(*) AS payment_count,
                SUM(cp.amount) AS total_customer_payments
            FROM customer_payment cp
            JOIN currencies cur
                ON cur.currency_id = cp.currency_id
               AND cur.user_id = cp.user_id
            WHERE cp.user_id = ?
              AND cp.payment_date >= ?
              AND cp.payment_date < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY
                cp.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol
            ORDER BY cur.currency_code
            `,
            [userId, reportDate, reportDate]
        ),
        db.query(
            `
            SELECT
                pp.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol AS currency_symbol,
                COUNT(*) AS payment_count,
                SUM(pp.amount) AS total_vendor_payments
            FROM purchase_payment pp
            JOIN currencies cur
                ON cur.currency_id = pp.currency_id
               AND cur.user_id = pp.user_id
            WHERE pp.user_id = ?
              AND pp.payment_date >= ?
              AND pp.payment_date < DATE_ADD(?, INTERVAL 1 DAY)
            GROUP BY
                pp.currency_id,
                cur.currency_name,
                cur.currency_code,
                cur.symbol
            ORDER BY cur.currency_code
            `,
            [userId, reportDate, reportDate]
        ),
    ]);

    return res.status(200).json({
        success: true,
        message: "Daily summary retrieved successfully.",
        data: {
            date: reportDate,
            sales: salesRows,
            purchases: purchaseRows,
            customer_payments: customerPaymentRows,
            vendor_payments: vendorPaymentRows,
        },
    });
});

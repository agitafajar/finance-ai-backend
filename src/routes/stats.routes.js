const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// helper: parse month param "YYYY-MM"
function parseMonth(monthStr) {
  if (!monthStr) return null;
  const [y, m] = monthStr.split("-");
  if (!y || !m) return null;

  const year = Number(y);
  const month = Number(m);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;

  // start date: YYYY-MM-01
  const start = `${year}-${String(month).padStart(2, "0")}-01`;

  // end date: first day of next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return { start, end };
}

/**
 * GET /stats/summary?month=YYYY-MM
 * Return:
 * - total_expense
 * - total_income
 * - transaction_count
 */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const month = req.query.month;

    const range = parseMonth(month);
    if (!range)
      return res.status(400).json({ message: "Invalid month. Use YYYY-MM" });

    const { start, end } = range;

    const summaryRes = await pool.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0)::bigint AS total_expense,
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0)::bigint AS total_income,
        COUNT(*)::int AS transaction_count
      FROM transactions
      WHERE user_id=$1
        AND transaction_date >= $2
        AND transaction_date < $3
      `,
      [userId, start, end]
    );

    return res.json({
      month,
      range: { start, end },
      ...summaryRes.rows[0],
    });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Stats summary failed", error: e.message });
  }
});

/**
 * GET /stats/categories?month=YYYY-MM&type=expense|income
 * Return breakdown per category:
 * [{ category, total, count }]
 */
router.get("/categories", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const month = req.query.month;
    const type = req.query.type || "expense";

    const range = parseMonth(month);
    if (!range)
      return res.status(400).json({ message: "Invalid month. Use YYYY-MM" });
    if (!["expense", "income"].includes(type)) {
      return res
        .status(400)
        .json({ message: "Invalid type. Use expense or income" });
    }

    const { start, end } = range;

    const catRes = await pool.query(
      `
      SELECT
        COALESCE(category, 'Lainnya') AS category,
        COALESCE(SUM(amount),0)::bigint AS total,
        COUNT(*)::int AS count
      FROM transactions
      WHERE user_id=$1
        AND type=$2
        AND transaction_date >= $3
        AND transaction_date < $4
      GROUP BY category
      ORDER BY total DESC
      `,
      [userId, type, start, end]
    );

    return res.json({
      month,
      type,
      range: { start, end },
      categories: catRes.rows,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Stats categories failed", error: e.message });
  }
});

/**
 * GET /stats/daily?month=YYYY-MM&type=expense|income
 * Return daily chart: [{ date, total }]
 */
router.get("/daily", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const month = req.query.month;
    const type = req.query.type || "expense";

    const range = parseMonth(month);
    if (!range)
      return res.status(400).json({ message: "Invalid month. Use YYYY-MM" });
    if (!["expense", "income"].includes(type)) {
      return res
        .status(400)
        .json({ message: "Invalid type. Use expense or income" });
    }

    const { start, end } = range;

    const dailyRes = await pool.query(
      `
      SELECT
        transaction_date::date AS date,
        COALESCE(SUM(amount),0)::bigint AS total
      FROM transactions
      WHERE user_id=$1
        AND type=$2
        AND transaction_date >= $3
        AND transaction_date < $4
      GROUP BY transaction_date::date
      ORDER BY date ASC
      `,
      [userId, type, start, end]
    );

    return res.json({
      month,
      type,
      range: { start, end },
      daily: dailyRes.rows,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Stats daily failed", error: e.message });
  }
});

module.exports = router;

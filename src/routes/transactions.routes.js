const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /transactions
 * query:
 * - page (default 1)
 * - limit (default 20)
 * - source (scan/manual)
 * - type (expense/income)
 * - category
 * - from (YYYY-MM-DD)
 * - to (YYYY-MM-DD)
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = (page - 1) * limit;

    const { source, type, category, from, to } = req.query;

    const where = [`user_id = $1`];
    const values = [userId];
    let idx = 2;

    if (source) {
      where.push(`source = $${idx++}`);
      values.push(source);
    }
    if (type) {
      where.push(`type = $${idx++}`);
      values.push(type);
    }
    if (category) {
      where.push(`category = $${idx++}`);
      values.push(category);
    }
    if (from) {
      where.push(`transaction_date >= $${idx++}`);
      values.push(from);
    }
    if (to) {
      where.push(`transaction_date <= $${idx++}`);
      values.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const dataQuery = `
      SELECT id, user_id, type, category, amount, description, transaction_date, created_at, source
      FROM transactions
      ${whereSql}
      ORDER BY transaction_date DESC, id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    values.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM transactions
      ${whereSql}
    `;

    // count query pakai values tanpa limit+offset
    const countValues = values.slice(0, values.length - 2);

    const [dataRes, countRes] = await Promise.all([
      pool.query(dataQuery, values),
      pool.query(countQuery, countValues),
    ]);

    return res.json({
      page,
      limit,
      total: countRes.rows[0].total,
      transactions: dataRes.rows,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Fetch transactions failed", error: e.message });
  }
});

/**
 * GET /transactions/:id
 */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;

    const txRes = await pool.query(
      `SELECT * FROM transactions WHERE id=$1 AND user_id=$2`,
      [id, userId]
    );

    if (txRes.rowCount === 0) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    return res.json({ transaction: txRes.rows[0] });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Fetch transaction failed", error: e.message });
  }
});

/**
 * PATCH /transactions/:id
 * body: { amount?, category?, description?, transaction_date?, type? }
 */
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;

    const { amount, category, description, transaction_date, type } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (amount !== undefined) {
      fields.push(`amount=$${idx++}`);
      values.push(amount);
    }
    if (category !== undefined) {
      fields.push(`category=$${idx++}`);
      values.push(category);
    }
    if (description !== undefined) {
      fields.push(`description=$${idx++}`);
      values.push(description);
    }
    if (transaction_date !== undefined) {
      fields.push(`transaction_date=$${idx++}`);
      values.push(transaction_date);
    }
    if (type !== undefined) {
      fields.push(`type=$${idx++}`);
      values.push(type);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(id, userId);

    const query = `
      UPDATE transactions
      SET ${fields.join(", ")}
      WHERE id=$${idx++} AND user_id=$${idx++}
      RETURNING *
    `;

    const updateRes = await pool.query(query, values);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    return res.json({ message: "Updated", transaction: updateRes.rows[0] });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Update transaction failed", error: e.message });
  }
});

/**
 * DELETE /transactions/:id
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const id = req.params.id;

    const delRes = await pool.query(
      `DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id`,
      [id, userId]
    );

    if (delRes.rowCount === 0) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    return res.json({ message: "Deleted", id: delRes.rows[0].id });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Delete transaction failed", error: e.message });
  }
});

module.exports = router;

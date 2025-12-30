const express = require("express");
const multer = require("multer");
const fs = require("fs");

const pool = require("../config/db");
const { uploadToS3 } = require("../utils/s3");
const { runOCR } = require("../utils/ocr");
const { parseReceiptOCR } = require("../utils/parser");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ POST /scan/receipt/parse
router.post("/receipt/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File required" });
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Only image allowed" });
    }

    // ✅ upload ke S3
    const { url, key } = await uploadToS3({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    // ✅ simpan temp file (tesseract butuh path)
    const tempPath = `/tmp/${Date.now()}-${req.file.originalname}`;
    fs.writeFileSync(tempPath, req.file.buffer);

    // ✅ OCR
    const text = await runOCR(tempPath);

    // ✅ cleanup
    fs.unlinkSync(tempPath);

    // ✅ parsing
    const parsed = parseReceiptOCR(text);

    // ✅ Jika total null → return 200 tapi saved=false
    if (!parsed.total) {
      return res.status(200).json({
        message: "OCR ok but total not detected",
        url,
        key,
        text,
        parsed,
        saved: false,
      });
    }

    // ✅ insert DB
    const insertRes = await pool.query(
      `
  INSERT INTO transactions (
    user_id,
    type,
    category,
    amount,
    description,
    source,
    raw_text
  )
  VALUES (
    $1,
    'expense',
    $2,
    $3,
    $4,
    'scan',
    $5
  )
  RETURNING *
  `,
      [
        1, // TODO: ganti JWT user_id
        parsed.category || "Lainnya",
        parsed.total,
        parsed.merchant || "Unknown Merchant",
        parsed.raw_text,
      ]
    );

    return res.json({
      message: "Parsed & Saved",
      transaction: insertRes.rows[0],
      parsed,
      url,
      key,
      text,
      saved: true,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Scan parse failed", error: e.message });
  }
});

module.exports = router;

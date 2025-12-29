const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const { uploadToS3 } = require("../utils/s3");
const { runOCR } = require("../utils/ocr");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const pool = require("../config/db");
const { parseReceiptOCR } = require("../utils/parser");

router.post("/receipt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File required" });

    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Only image allowed" });
    }

    // 1) upload ke S3
    const { url, key } = await uploadToS3({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    // 2) simpan temp file (tesseract butuh file path)
    const tempPath = `/tmp/${Date.now()}-${req.file.originalname}`;
    fs.writeFileSync(tempPath, req.file.buffer);

    // 3) OCR
    const text = await runOCR(tempPath);

    // 4) cleanup
    fs.unlinkSync(tempPath);

    return res.json({
      message: "Scanned",
      url,
      key,
      text,
    });

  } catch (e) {
    return res.status(500).json({ message: "Scan failed", error: e.message });
  }
});

router.post("/receipt/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File required" });

    // upload ke S3
    const { url, key } = await uploadToS3({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    // temp untuk OCR
    const tempPath = `/tmp/${Date.now()}-${req.file.originalname}`;
    fs.writeFileSync(tempPath, req.file.buffer);

    const text = await runOCR(tempPath);
    fs.unlinkSync(tempPath);

    // parse
    const parsed = parseReceiptOCR(text);

    if (!parsed.total) {
      return res.status(400).json({
        message: "OCR ok but total not detected",
        url,
        key,
        text,
        parsed
      });
    }

    // insert ke DB
    const insertRes = await pool.query(
      `INSERT INTO transactions(user_id, amount, type, category, description, source, raw_text, created_at)
       VALUES($1,$2,'expense',$3,$4,'scan',$5,NOW())
       RETURNING *`,
      [
        1, // sementara user_id=1 (nanti pakai JWT)
        parsed.total,
        parsed.category,
        parsed.merchant || "Unknown Merchant",
        url,
        parsed.raw_text
      ]
    );

    return res.json({
      message: "Parsed & Saved",
      transaction: insertRes.rows[0],
      parsed,
      url,
      key,
      text
    });

  } catch (e) {
    return res.status(500).json({ message: "Scan parse failed", error: e.message });
  }
});


module.exports = router;

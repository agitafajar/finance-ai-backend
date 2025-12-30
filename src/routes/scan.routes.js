router.post("/receipt/parse", upload.single("file"), async (req, res) => {
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

    // 2) simpan temp file (tesseract butuh path)
    const tempPath = `/tmp/${Date.now()}-${req.file.originalname}`;
    fs.writeFileSync(tempPath, req.file.buffer);

    // 3) preprocess image (biar OCR lebih akurat)
    const { preprocessImage } = require("../utils/preprocess");
    const processedPath = await preprocessImage(tempPath);

    // 4) OCR (wajib di sini)
    const text = await runOCR(processedPath);

    // 5) cleanup file temp
    try { fs.unlinkSync(tempPath); } catch {}
    try { fs.unlinkSync(processedPath); } catch {}

    // 6) parse hasil OCR
    const parsed = parseReceiptOCR(text);

    // kalau total null → jangan save (balikin warning)
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

    // 7) insert DB
    const insertRes = await pool.query(
      `INSERT INTO transactions(user_id, amount, type, category, description, source, raw_text, created_at)
       VALUES($1,$2,'expense',$3,$4,'scan',$5,$6,NOW())
       RETURNING *`,
      [
        1, // TODO: ganti JWT
        parsed.total,
        parsed.category,
        parsed.merchant || "Unknown Merchant",
        url,
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
    return res.status(500).json({ message: "Scan parse failed", error: e.message });
  }
});

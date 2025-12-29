const express = require("express");
const multer = require("multer");
const { uploadToS3 } = require("../utils/s3");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/receipt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File required" });

    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Only image allowed" });
    }

    const { url, key } = await uploadToS3({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    return res.json({
      message: "Uploaded",
      key,
      url,
    });
  } catch (e) {
    return res.status(500).json({ message: "Upload failed", error: e.message });
  }
});

module.exports = router;

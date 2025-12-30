async function runGeminiOCR(imagePathOrBuffer, opts = {}) {
  throw new Error("Gemini OCR belum aktif. Set OCR_PROVIDER=tesseract dulu.");
}

module.exports = { runGeminiOCR };

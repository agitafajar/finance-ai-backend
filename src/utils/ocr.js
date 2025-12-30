const { runTesseractOCR } = require("./ocr.tesseract");
const { runGeminiOCR } = require("./ocr.gemini");

const OCR_PROVIDER = (process.env.OCR_PROVIDER || "tesseract").toLowerCase();

async function runOCR(imagePathOrBuffer, opts = {}) {
  if (OCR_PROVIDER === "gemini") {
    return runGeminiOCR(imagePathOrBuffer, opts);
  }

  return runTesseractOCR(imagePathOrBuffer, opts);
}

module.exports = { runOCR };

const { runTesseractOCR } = require("./ocr.tesseract");

async function runOCR(imagePathOrBuffer, opts = {}) {
  return runTesseractOCR(imagePathOrBuffer, opts);
}

module.exports = { runOCR };

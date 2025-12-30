const sharp = require("sharp");
const fs = require("fs");

async function preprocessImage(inputPath) {
  const outputPath = inputPath.replace(/(\.\w+)$/, "_preprocessed.png");

  await sharp(inputPath)
    .resize({ width: 1200, withoutEnlargement: true }) // biar OCR kebaca jelas
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(180) // bikin hitam putih tajam
    .toFile(outputPath);

  return outputPath;
}

module.exports = { preprocessImage };

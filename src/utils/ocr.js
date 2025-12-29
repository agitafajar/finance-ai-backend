const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

function runOCR(filePath) {
  return new Promise((resolve, reject) => {
    const outputPath = `/tmp/ocr-${Date.now()}`;

    // -l ind = bahasa indonesia
    const cmd = `tesseract "${filePath}" "${outputPath}" -l ind`;

    exec(cmd, (err) => {
      if (err) return reject(err);

      const textFile = `${outputPath}.txt`;
      const text = fs.readFileSync(textFile, "utf8");

      fs.unlinkSync(textFile);
      resolve(text.trim());
    });
  });
}

module.exports = { runOCR };

const { exec } = require("child_process");

function execCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout);
    });
  });
}

async function runTesseractOCR(imagePath, opts = {}) {
  const lang = opts.lang || process.env.OCR_LANG || "ind+eng";
  const psm = opts.psm || process.env.OCR_PSM || "6";

  const cmd = `tesseract "${imagePath}" stdout -l ${lang} --psm ${psm}`;
  const raw = await execCmd(cmd);

  return raw.trim();
}

module.exports = { runTesseractOCR };

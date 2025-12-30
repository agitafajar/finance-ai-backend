const dayjs = require("dayjs");

// ============================
// helpers
// ============================
function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

// normalize angka: "50.000", "50,000", "50.000,00" -> 50000
function normalizeNumber(numStr) {
  if (!numStr) return null;
  let s = numStr.trim();

  // buang Rp, spasi, dll
  s = s.replace(/rp/gi, "").replace(/\s/g, "");

  // jika ada koma dan titik
  // asumsi Indonesia: titik ribuan, koma desimal
  // contoh: 10.000,50 -> 10000.50
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // kalau cuma ada koma -> treat as ribuan atau desimal?
    // kalau ada 2 digit belakang -> decimal
    if (s.includes(",") && /,\d{2}$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "").replace(/\./g, "");
    }
  }

  const n = Number(s);
  return isNaN(n) ? null : n;
}

// ============================
// extract totals
// ============================
function extractTotalCandidates(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const patterns = [
    /(grand\s*total|total\s*belanja|total|jumlah|amount|tagihan)\s*[:\-]?\s*rp?\s*([\d.,]+)/i,
    /(subtotal)\s*[:\-]?\s*rp?\s*([\d.,]+)/i,
    /(bayar|cash|tunai|paid)\s*[:\-]?\s*rp?\s*([\d.,]+)/i,
  ];

  let candidates = [];

  for (let line of lines) {
    for (let p of patterns) {
      const m = line.match(p);
      if (m) {
        const value = normalizeNumber(m[2]);
        if (value) {
          candidates.push({
            label: m[1].toLowerCase(),
            value,
            line,
          });
        }
      }
    }
  }

  // fallback extra untuk kasus "Subtotal Rp. 200.000.000"
  const fallback2 =
    text.match(/(subtotal|bayar|total)\s*rp\.?\s*([0-9][0-9.,]*)/gi) || [];
  for (const f of fallback2) {
    const mm = f.match(/rp\.?\s*([0-9][0-9.,]*)/i);
    if (mm) {
      const value = normalizeNumber(mm[1]);
      if (value) candidates.push({ label: "fallback_kw", value, line: f });
    }
  }

  // urutkan terbesar dulu
  candidates.sort((a, b) => b.value - a.value);

  return candidates;
}

function pickBestTotal(candidates) {
  if (!candidates || candidates.length === 0) return null;

  // prioritas keyword "total / grand total"
  const priority = [
    "grand total",
    "total belanja",
    "total",
    "jumlah",
    "amount",
    "tagihan",
  ];
  for (let key of priority) {
    const found = candidates.find((c) => c.label.includes(key));
    if (found) return found.value;
  }

  // kalau tidak ada, ambil max saja
  return candidates[0].value;
}

// ============================
// extract date
// ============================
function extractDateCandidates(text) {
  const candidates = [];

  const patterns = [
    // 29/12/2025 or 29-12-2025
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
    // 2025-12-29
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,
    // 29 Dec 2025 / 29 Des 2025
    /\b(\d{1,2})\s?(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\s?(\d{4})\b/gi,
  ];

  for (let p of patterns) {
    let match;
    while ((match = p.exec(text)) !== null) {
      let dt = null;

      if (match[0].includes("/") || match[0].includes("-")) {
        // dd/mm/yyyy
        if (match[3].length === 4 && match[1].length <= 2) {
          const [_, d, m, y] = match;
          dt = dayjs(`${y}-${m}-${d}`).toDate();
        }
        // yyyy-mm-dd
        else if (match[1].length === 4) {
          const [_, y, m, d] = match;
          dt = dayjs(`${y}-${m}-${d}`).toDate();
        }
      }

      if (!dt && match[2]) {
        const [_, d, mon, y] = match;
        dt = dayjs(`${d} ${mon} ${y}`, "DD MMM YYYY").toDate();
      }

      if (dt && dayjs(dt).isValid()) {
        candidates.push({
          value: dt,
          raw: match[0],
        });
      }
    }
  }

  return candidates;
}

function pickBestDate(candidates) {
  if (!candidates || candidates.length === 0) return null;
  // pilih yang paling awal muncul biasanya adalah tanggal transaksi
  return candidates[0].value;
}

// ============================
// extract merchant
// ============================
function extractMerchant(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  // Ambil 5 baris paling atas
  const top = lines.slice(0, 5);

  // Filter yang bukan alamat panjang (kalau terlalu panjang dan banyak angka)
  const candidate = top
    .filter((l) => l.length > 2)
    .filter(
      (l) =>
        !/(npwp|invoice|receipt|struk|no\.?\s*struk|cashier|telp|phone)/i.test(
          l
        )
    )
    .sort((a, b) => b.length - a.length)[0];

  return candidate || top[0];
}

// ============================
// category inference
// ============================
function inferCategory(text) {
  const lower = text.toLowerCase();

  if (/(grab|gojek|uber|ojek|taksi|tol|parkir)/.test(lower))
    return "Transportasi";
  if (/(kopi|coffee|cafe|resto|warung|bakso|ayam|makan|minum)/.test(lower))
    return "Makanan & Minuman";
  if (/(tokopedia|shopee|lazada|blibli|bukalapak)/.test(lower))
    return "Belanja";
  if (/(pln|listrik|air|pdam|pulsa|paket data|internet)/.test(lower))
    return "Tagihan";
  if (/(apotek|rs|klinik|obat)/.test(lower)) return "Kesehatan";

  return "Lainnya";
}

// ============================
// confidence scoring (simple heuristik)
// ============================
function computeConfidence({ total, date, merchant }) {
  let score = 0;

  if (merchant) score += 0.25;
  if (date) score += 0.25;
  if (total) score += 0.5;

  return Number(score.toFixed(2)); // 0 - 1
}

// ============================
// MAIN FUNCTION
// ============================
function parseReceiptOCRv2(rawText) {
  const text = cleanText(rawText);

  const merchant = extractMerchant(text);

  const totalCandidates = extractTotalCandidates(text);
  const total = pickBestTotal(totalCandidates);

  const dateCandidates = extractDateCandidates(text);
  const date = pickBestDate(dateCandidates);

  const category = inferCategory(text);
  const confidence = computeConfidence({ total, date, merchant });

  const warnings = [];
  if (!merchant) warnings.push("merchant_not_detected");
  if (!date) warnings.push("date_not_detected");
  if (!total) warnings.push("total_not_detected");

  return {
    merchant,
    total,
    date,
    category,
    confidence,
    warnings,
    candidates: {
      total: totalCandidates.slice(0, 5),
      date: dateCandidates.slice(0, 5),
    },
    raw_text: text,
  };
}

module.exports = { parseReceiptOCRv2 };

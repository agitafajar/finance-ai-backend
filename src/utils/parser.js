const dayjs = require("dayjs");

// helper: normalize text
function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

// ambil angka rupiah dari string
function extractRupiahNumbers(text) {
  const matches = text.match(/Rp[\s]*([\d.,]+)/gi) || [];
  return matches
    .map((m) => m.replace(/Rp/i, "").trim())
    .map((num) => num.replace(/\./g, "").replace(/,/g, "."))
    .map((n) => Number(n))
    .filter((n) => !isNaN(n) && n > 0);
}

// detect tanggal umum (format struk Indonesia)
function extractDate(text) {
  // contoh: 29/12/2025 atau 29-12-2025 atau 29 Dec 2025
  const patterns = [
    /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/,
    /\b(\d{2})\s?(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s?(\d{4})\b/i,
  ];

  for (let p of patterns) {
    const match = text.match(p);
    if (match) {
      if (match[2].length === 2) {
        // dd/mm/yyyy
        const [_, d, m, y] = match;
        return dayjs(`${y}-${m}-${d}`).toDate();
      } else {
        // dd Mon yyyy
        const [_, d, mon, y] = match;
        return dayjs(`${d} ${mon} ${y}`, "DD MMM YYYY").toDate();
      }
    }
  }
  return null;
}

// ambil merchant biasanya ada di baris atas
function extractMerchant(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // biasanya merchant di 1-3 baris atas
  const top = lines.slice(0, 3);

  // pilih baris yang paling panjang & bukan "struk" dsb
  const candidate = top
    .filter(l => l.length > 3)
    .filter(l => !l.toLowerCase().includes("invoice"))
    .filter(l => !l.toLowerCase().includes("receipt"))
    .filter(l => !l.toLowerCase().includes("npwp"))
    .sort((a, b) => b.length - a.length)[0];

  return candidate || top[0];
}

// cari total, ambil angka rupiah terbesar (heuristik)
function extractTotal(text) {
  const nums = extractRupiahNumbers(text);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

// kategori berdasarkan keyword merchant/text
function inferCategory(text) {
  const lower = text.toLowerCase();

  if (lower.includes("grab") || lower.includes("gojek") || lower.includes("uber"))
    return "Transportasi";

  if (lower.includes("starbucks") || lower.includes("coffee") || lower.includes("cafe"))
    return "Makanan & Minuman";

  if (lower.includes("tokopedia") || lower.includes("shopee") || lower.includes("lazada"))
    return "Belanja";

  if (lower.includes("spotify") || lower.includes("netflix") || lower.includes("subscription"))
    return "Langganan";

  return "Lainnya";
}

// MAIN FUNCTION
function parseReceiptOCR(rawText) {
  const text = cleanText(rawText);

  const merchant = extractMerchant(text);
  const total = extractTotal(text);
  const date = extractDate(text);
  const category = inferCategory(text);

  return {
    merchant,
    total,
    date,
    category,
    raw_text: text,
  };
}

module.exports = { parseReceiptOCR };

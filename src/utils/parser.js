const dayjs = require("dayjs");

// =============================
// TEXT CLEANER
// =============================
function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

// =============================
// AMBIL SEMUA ANGKA RUPIAH
// Support format:
// Rp 12.500
// 12.500
// 12,500
// 12.500,00
// =============================
function extractAllMoneyCandidates(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const candidates = [];

  for (let line of lines) {
    // cari angka nominal
    const matches = line.match(/(?:rp[\s]*?)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{3,})(?!\s?(kg|pcs|box|ltr|ml|gr|g|x))/gi);

    if (!matches) continue;

    for (let raw of matches) {
      let normalized = raw
        .replace(/rp/gi, "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(/,/g, "."); // ubah 12,500 → 12.500

      const num = Number(normalized);

      if (!isNaN(num) && num > 0) {
        candidates.push({ line, num });
      }
    }
  }

  return candidates;
}

// =============================
// DETECT TOTAL DENGAN HEURISTIC
// Paling dinamis:
// 1) Kalau ada keyword total → ambil nominal di baris itu
// 2) Kalau ada bayar/jumlah/grand total → prioritas
// 3) fallback → ambil nominal terbesar tapi bukan dari item list
// =============================
function extractTotal(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const totalKeywords = [
    "total",
    "grand total",
    "jumlah",
    "jumlah bayar",
    "total bayar",
    "total belanja",
    "tagihan",
    "bayar"
  ];

  // 1) keyword based
  for (let line of lines) {
    const lower = line.toLowerCase();

    if (totalKeywords.some(k => lower.includes(k))) {
      const money = extractAllMoneyCandidates(line);
      if (money.length > 0) {
        // pilih terbesar pada baris itu
        return Math.max(...money.map(m => m.num));
      }
    }
  }

  // 2) fallback: ambil nominal terbesar dari semua baris,
  // tapi skip line item yang ada pattern: "x" atau "qty"
  const moneyCandidates = extractAllMoneyCandidates(text);

  const filtered = moneyCandidates.filter(c =>
    !c.line.toLowerCase().includes("x") &&
    !c.line.toLowerCase().includes("qty") &&
    !c.line.toLowerCase().includes("pcs") &&
    !c.line.toLowerCase().includes("kg")
  );

  if (filtered.length > 0) {
    return Math.max(...filtered.map(c => c.num));
  }

  if (moneyCandidates.length > 0) {
    return Math.max(...moneyCandidates.map(c => c.num));
  }

  return null;
}

// =============================
// DETECT TANGGAL DINAMIS
// support:
// dd/mm/yyyy
// dd-mm-yyyy
// yyyy-mm-dd
// dd.mm.yyyy
// 29 Dec 2025
// =============================
function extractDate(text) {
  const patterns = [
    /\b(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})\b/, // dd/mm/yyyy
    /\b(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})\b/, // yyyy-mm-dd
    /\b(\d{2})\s?(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s?(\d{4})\b/i,
  ];

  for (let p of patterns) {
    const match = text.match(p);
    if (match) {
      if (match[1].length === 4) {
        const [_, y, m, d] = match;
        return dayjs(`${y}-${m}-${d}`).toDate();
      }

      if (match[2].length === 2) {
        const [_, d, m, y] = match;
        return dayjs(`${y}-${m}-${d}`).toDate();
      } else {
        const [_, d, mon, y] = match;
        return dayjs(`${d} ${mon} ${y}`, "DD MMM YYYY").toDate();
      }
    }
  }

  return null;
}

// =============================
// DETECT MERCHANT DINAMIS
// aturan:
// - merchant biasanya line awal
// - tapi yang bukan alamat (mengandung jalan, rt rw, kec, kota)
// - pilih line yang uppercase dominan / kata pendek
// =============================
function extractMerchant(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) return null;

  const ignoreKeywords = [
    "jl", "jalan", "rt", "rw", "kec", "kel", "kota", "kab", "no.", "npwp"
  ];

  const top = lines.slice(0, 8);

  // ambil line yang:
  // - bukan alamat
  // - panjang 3-40
  const candidates = top.filter(l => {
    const lower = l.toLowerCase();
    if (ignoreKeywords.some(k => lower.includes(k))) return false;
    if (lower.includes("struk") || lower.includes("invoice") || lower.includes("receipt")) return false;
    return l.length >= 3 && l.length <= 50;
  });

  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.length - a.length)[0];
  }

  return top[0];
}

// =============================
// INFER CATEGORY (masih rule-based)
// tapi ini mudah diganti AI kedepannya
// =============================
function inferCategory(text) {
  const lower = text.toLowerCase();

  if (lower.includes("grab") || lower.includes("gojek") || lower.includes("uber"))
    return "Transportasi";

  if (lower.includes("starbucks") || lower.includes("coffee") || lower.includes("cafe"))
    return "Makanan & Minuman";

  if (lower.includes("tokopedia") || lower.includes("shopee") || lower.includes("lazada"))
    return "Belanja";

  if (lower.includes("pulsa") || lower.includes("pln") || lower.includes("telkom"))
    return "Tagihan";

  if (lower.includes("indomaret") || lower.includes("alfamart") || lower.includes("supermarket"))
    return "Kebutuhan Harian";

  return "Lainnya";
}

// =============================
// MAIN
// =============================
function parseReceiptOCR(rawText) {
  const text = cleanText(rawText);

  return {
    merchant: extractMerchant(text),
    total: extractTotal(text),
    date: extractDate(text),
    category: inferCategory(text),
    raw_text: text,
  };
}

module.exports = { parseReceiptOCR };

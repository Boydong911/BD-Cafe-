/*
 * Scan kontaminasi karakter di seluruh source code.
 *
 * Latar belakang: beberapa kali ada karakter dari bahasa lain (Han,
 * Cyrillic, Hiragana, huruf Turki) yang bocor ke dalam komentar atau
 * string tanpa disadari -- dan grep dengan regex range ternyata tidak
 * bisa diandalkan untuk mendeteksinya, karena beberapa karakter ASCII
 * biasa ikut dianggap match.
 *
 * Jadi pemeriksaannya dilakukan di sini, dengan Node yang membaca file
 * sebagai UTF-8 dan membandingkan per karakter.
 *
 * Dua lapis laporan:
 *   1. BENTANG SKRIP NON-LATIN  -- hampir pasti salah. Wajib dibersihkan.
 *   2. HURUF LATIN TAMBAHAN     -- perlu dilihat manual. Sebagian besar
 *      memang sah untuk teks Indonesia.
 *
 * Jalankan: node scan-karakter.cjs
 */

/* Bagian nama yang dipindai. File log .md sengaja tidak ikut: isinya
   penuh diagram kotak dan emoji yang memang disengaja. */
const SKIP_DIR = new Set(["node_modules", ".next", ".git"]);
const SKIP_FILE = new Set(["Rangkuman-2026-10-16.md", "BD-Coffee-Roadmap.md"]);
const EXT = new Set([".ts", ".tsx", ".sql", ".css"]);

/* Bagian U+FFFD nol dan Privasi yang wajib lolos. */
function inBlock(code, lo, hi) {
  return code >= lo && code <= hi;
}

/*
 * Lapis 1: blok script yang tidak mungkin muncul di teks Indonesia.
 * Semua karakternya wajib dibersihkan dari kode.
 */
const NON_LATIN = [
  ["Han (China/Jepang)", 0x4e00, 0x9fff],
  ["Han ekstensi A", 0x3400, 0x4dbf],
  ["Hiragana/Katakana", 0x3040, 0x30ff],
  ["Hangul (Korea)", 0xac00, 0xd7af],
  ["Hangul Jamo", 0x1100, 0x11ff],
  ["Hangul kompatibilitas", 0x3130, 0x318f],
  ["Cyrillic", 0x0400, 0x04ff],
  ["Cyrillic tambahan", 0x0500, 0x052f],
  ["Greek", 0x0370, 0x03ff],
  ["Arabic", 0x0600, 0x06ff],
  ["Devanagari", 0x0900, 0x097f],
  ["Thai", 0x0e00, 0x0e7f],
  ["Hebrew", 0x0590, 0x05ff],
  ["Fullwidth (CJK)", 0xff01, 0xff60],
];

/*
 * Lapis 2: huruf Latin tambahan. Sebagian besar sah untuk teks Indonesia
 * (mis. é, ö), jadi hanya dilaporkan, tidak otomatis dianggap salah.
 */
const LATIN_EXT = [
  ["Latin-1", 0x00c0, 0x00ff],
  ["Latin Extended-A", 0x0100, 0x017f],
  ["Latin Extended-B", 0x0180, 0x024f],
];

/* Alfabet Latin-1 yang lazim diHuruf Indonesia, jadi tidak perlu报告. */
const LATIN_COMMON = new Set("àáâäçèéêëìíîïòóôöùúûüýÿñÀÁÂÄÇÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÑ");

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const hard = [];
const soft = [];

function scan(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, i) => {
    for (const ch of line) {
      const code = ch.codePointAt(0);
      if (code < 128) continue; // ASCII, selalu aman

      const rel = path.relative(ROOT, file);
      const entry = {
        where: `${rel}:${i + 1}`,
        char: ch,
        code: "U+" + code.toString(16).toUpperCase().padStart(4, "0"),
        text: line.trim().slice(0, 95),
      };

      const block = NON_LATIN.find(([, lo, hi]) => inBlock(code, lo, hi));
      if (block) {
        hard.push({ ...entry, block: block[0] });
        continue;
      }

      if (LATIN_EXT.some(([, lo, hi]) => inBlock(code, lo, hi))) {
        if (LATIN_COMMON.has(ch)) continue;
        soft.push(entry);
      }
    }
  });
}

(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (EXT.has(path.extname(entry.name)) && !SKIP_FILE.has(entry.name)) scan(full);
  }
})(ROOT);

console.log("=== 1. BENTANG SKRIP NON-LATIN (wajib dibersihkan) ===");
if (hard.length === 0) {
  console.log("  bersih\n");
} else {
  for (const h of hard) {
    console.log(`  ${h.where}  ${h.code}  '${h.char}'  [${h.block}]`);
    console.log(`      ${h.text}`);
  }
  console.log();
}

console.log("=== 2. HURUF LATIN TAMBAHAN (perlu dilihat) ===");
if (soft.length === 0) {
  console.log("  bersih\n");
} else {
  for (const s of soft) {
    console.log(`  ${s.where}  ${s.code}  '${s.char}'`);
    console.log(`      ${s.text}`);
  }
  console.log();
}

console.log(`RINGKASAN: ${hard.length} blok non-Latin, ${soft.length} huruf Latin tambahan.`);
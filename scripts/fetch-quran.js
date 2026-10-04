#!/usr/bin/env node
/**
 * scripts/fetch-quran.js
 * ----------------------------------------------------------------------------
 * Builds data/quran.json (6,236 ayahs) from quranpedia.net — the only approved
 * Quran source for the "Aaed" project.
 *
 * What it downloads (about 5 HTTP requests in total, no crawling):
 *   1. The Quran text  -> official versioned dump  https://quranpedia.net/dumps/mushafs-{id}.json.gz
 *                         (falls back to the API    https://api.quranpedia.net/v1/mushafs/{id})
 *   2. Four translations (en / fr / ur / id) -> https://api.quranpedia.net/translation-books/{bookId}.json
 *
 * Quranpedia's usage policy asks integrators NOT to bulk-scrape the per-ayah API
 * and to use the official dumps instead. This script follows that: one dump file
 * plus one static JSON file per translation book.
 *
 * Output (one record per ayah, shaped like the `quran` table in aaed_schema.sql,
 * WITHOUT the embedding — that is added by generate-embeddings.js):
 *   {
 *     surah_number, surah_name, ayah_number, text_arabic,
 *     tafseer: null,                       // filled later from dorar.net/tafseer
 *     translations: { en, fr, ur, id },
 *     source: "quranpedia.net",
 *     source_url: "https://quranpedia.net/surah/{mushaf}/{surah}?ayah_id={id}",
 *     tafseer_source_url: null
 *   }
 * and data/quran.meta.json (versions, checksums, attribution).
 *
 * Usage (from the project root, Node 18+):
 *   node scripts/fetch-quran.js
 *   node scripts/fetch-quran.js --mushaf=1
 *   node scripts/fetch-quran.js --translations=en:1947,fr:13611,ur:13625,id:1962
 *   node scripts/fetch-quran.js --api          # skip the dump, use the API endpoint
 *   node scripts/fetch-quran.js --out=data/quran.json
 *
 * Env: CONTACT=you@example.com  (added to the User-Agent, as the API policy asks)
 *
 * Attribution: if you ever publish this data as a downloadable dataset, credit
 * "Quranpedia.net" with a link and the dump version (see quran.meta.json).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------
const DEFAULT_MUSHAF_ID = 2; // "مصحف حفص نسخة نصية" — plain Unicode text, best for search/embeddings
const DEFAULT_TRANSLATIONS = {
  en: 1947, //  الترجمة الإنجليزية - صحيح انترناشونال
  fr: 13611, // Muhammad Hamidullah - French
  ur: 13625, // محمد جوناگڑھی - Urdu
  id: 1962, //  الترجمة الإندونيسية - وزارة الشؤون الإسلامية
};
const EXPECTED_AYAHS = 6236;
const EXPECTED_SURAHS = 114;

const DUMP_BASE = 'https://quranpedia.net/dumps';
const API_BASE = 'https://api.quranpedia.net/v1';
const BOOKS_BASE = 'https://api.quranpedia.net/translation-books';
const SITE_BASE = 'https://quranpedia.net';

const CONTACT = process.env.CONTACT ? ` ${process.env.CONTACT}` : '';
const USER_AGENT = `aaed-platform-quran-import/1.0 (+https://github.com/abraralseddiq20-rgb/aaed-platform${CONTACT ? ';' + CONTACT : ''})`;

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

class HttpError extends Error {
  constructor(status, url, retryable, retryAfterSec) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
    this.retryable = retryable;
    this.retryAfterSec = retryAfterSec;
  }
}

/** GET a URL as a Buffer, with timeout and polite retry/backoff (429 / 5xx / network errors). */
async function getBuffer(url, { retries = 4, timeoutMs = 90_000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/gzip, */*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      const retryable = res.status === 429 || res.status >= 500;
      throw new HttpError(res.status, url, retryable, Number(res.headers.get('retry-after')) || 0);
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof HttpError ? err.retryable : true; // network/timeout => retry
      if (!retryable || attempt === retries) break;
      const wait = err instanceof HttpError && err.status === 429
        ? (err.retryAfterSec || 30) * 1000
        : 2000 * 2 ** attempt;
      console.warn(`  ! ${err.message} — retry ${attempt + 1}/${retries} in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/** Gunzip when the buffer starts with the gzip magic bytes, otherwise return it unchanged. */
function maybeGunzip(buf) {
  return buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf;
}

function parseJson(buf, what) {
  try {
    return JSON.parse(maybeGunzip(buf).toString('utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new Error(`Could not parse ${what} as JSON: ${err.message}`);
  }
}

// --------------------------------------------------------------------------
// Text cleaning
// --------------------------------------------------------------------------
/** Arabic ayah text: keep all diacritics, drop BOM / invisible bidi marks, collapse whitespace. */
function cleanArabic(s) {
  return String(s ?? '')
    .replace(/[\uFEFF\u200B\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const DIGITS = '\\d\\u0660-\\u0669\\u06F0-\\u06F9'; // Latin + Arabic-Indic + Persian digits

/**
 * Quranpedia translation text arrives as HTML: "(1) text[2]<br/>____<br/>[2]- footnote…".
 * We keep only the translation itself: drop the footnote block, tags, the leading "(n)"
 * verse number and inline numeric footnote markers like "[2]".
 * Bracketed explanatory words such as "[All] praise" are part of the translation and are kept.
 */
function cleanTranslation(html) {
  let t = String(html ?? '');
  const cut = t.indexOf('____'); // footnotes separator
  if (cut !== -1) t = t.slice(0, cut);
  t = t.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
  t = t.replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m]);
  t = t.replace(new RegExp(`^\\s*\\(\\s*[${DIGITS}]+\\s*\\)\\s*`), '');
  t = t.replace(new RegExp(`\\[\\s*[${DIGITS}]+\\s*\\]`, 'g'), '');
  return t.replace(/\s+/g, ' ').trim();
}

// --------------------------------------------------------------------------
// Loading
// --------------------------------------------------------------------------
async function loadMushaf(mushafId, useApi) {
  const sources = useApi ? ['api'] : ['dump', 'api'];
  const errors = [];
  for (const kind of sources) {
    const url = kind === 'dump' ? `${DUMP_BASE}/mushafs-${mushafId}.json.gz` : `${API_BASE}/mushafs/${mushafId}`;
    try {
      console.log(`Downloading mushaf ${mushafId} (${kind}): ${url}`);
      const buf = await getBuffer(url);
      const json = parseJson(buf, `mushaf ${mushafId} (${kind})`);
      if (!Array.isArray(json.surahs)) throw new Error('unexpected shape: "surahs" array is missing');
      return { json, url, sha256: sha256(buf), kind };
    } catch (err) {
      errors.push(`${kind}: ${err.message}`);
      console.warn(`  ! ${kind} failed: ${err.message}`);
    }
  }
  throw new Error(`Could not load mushaf ${mushafId}.\n  ${errors.join('\n  ')}`);
}

/** Flatten mushaf JSON (surahs[].ayahs[]) into a sorted list of ayahs. */
function flattenMushaf(json) {
  const out = [];
  const seen = new Set();
  json.surahs.forEach((s, i) => {
    const fallbackSurah = i + 1;
    for (const a of s.ayahs ?? []) {
      const parsed = Number(a.surah);
      const surahNumber = Number.isInteger(parsed) && parsed >= 1 && parsed <= 114 ? parsed : fallbackSurah;
      const ayahNumber = Number(a.number);
      const key = `${surahNumber}:${ayahNumber}`;
      if (!Number.isInteger(ayahNumber) || ayahNumber < 1) throw new Error(`Bad ayah number at surah ${surahNumber}`);
      if (seen.has(key)) throw new Error(`Duplicate ayah ${key} in mushaf data`);
      seen.add(key);
      out.push({
        id: a.id,
        surah_number: surahNumber,
        surah_name: cleanArabic(s.name),
        ayah_number: ayahNumber,
        text_arabic: cleanArabic(a.text),
      });
    }
  });
  out.sort((x, y) => x.surah_number - y.surah_number || x.ayah_number - y.ayah_number);
  return out;
}

async function loadTranslation(lang, bookId) {
  const url = `${BOOKS_BASE}/${bookId}.json`;
  console.log(`Downloading translation [${lang}] book ${bookId}: ${url}`);
  const buf = await getBuffer(url);
  const json = parseJson(buf, `translation book ${bookId}`);
  if (!Array.isArray(json.ayahs)) throw new Error(`translation book ${bookId}: "ayahs" array is missing`);
  if (json.locale_code && json.locale_code !== lang) {
    console.warn(`  ! book ${bookId} has locale "${json.locale_code}" but you mapped it to "${lang}" — check the book id`);
  }
  const map = new Map();
  for (const a of json.ayahs) {
    map.set(`${Number(a.surah_number)}:${Number(a.ayah_number)}`, cleanTranslation(a.translated_text));
  }
  return { lang, bookId, name: json.name ?? null, locale: json.locale_code ?? null, url, sha256: sha256(buf), map };
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { mushaf: DEFAULT_MUSHAF_ID, out: 'data/quran.json', translations: { ...DEFAULT_TRANSLATIONS }, useApi: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\*?\n?/, ''));
      process.exit(0);
    } else if (arg.startsWith('--mushaf=')) {
      opts.mushaf = Number(arg.slice('--mushaf='.length));
    } else if (arg.startsWith('--out=')) {
      opts.out = arg.slice('--out='.length);
    } else if (arg.startsWith('--translations=')) {
      opts.translations = Object.fromEntries(
        arg.slice('--translations='.length).split(',').filter(Boolean).map((pair) => {
          const [lang, id] = pair.split(':');
          return [String(lang).trim(), Number(id)];
        }),
      );
    } else if (arg === '--api') {
      opts.useApi = true;
    } else {
      throw new Error(`Unknown argument: ${arg} (try --help)`);
    }
  }
  if (!Number.isInteger(opts.mushaf) || opts.mushaf < 1) throw new Error('--mushaf must be a positive integer');
  for (const [lang, id] of Object.entries(opts.translations)) {
    if (!lang || !Number.isInteger(id) || id < 1) throw new Error(`Bad --translations entry "${lang}:${id}" (expected lang:bookId)`);
  }
  return opts;
}

function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outFile = path.resolve(process.cwd(), opts.out);
  const metaFile = outFile.replace(/\.json$/i, '') + '.meta.json';

  // 1) Quran text
  const mushaf = await loadMushaf(opts.mushaf, opts.useApi);
  const ayahs = flattenMushaf(mushaf.json);
  const surahCount = new Set(ayahs.map((a) => a.surah_number)).size;
  console.log(`Mushaf "${mushaf.json.name ?? opts.mushaf}": ${ayahs.length} ayahs in ${surahCount} surahs`);

  if (ayahs.length !== EXPECTED_AYAHS || surahCount !== EXPECTED_SURAHS) {
    throw new Error(
      `Unexpected size: ${ayahs.length} ayahs / ${surahCount} surahs (expected ${EXPECTED_AYAHS} / ${EXPECTED_SURAHS}). ` +
        'A Hafs mushaf is expected — pass --mushaf=2 (or 1). Nothing was written.',
    );
  }
  const emptyText = ayahs.filter((a) => !a.text_arabic);
  if (emptyText.length) throw new Error(`${emptyText.length} ayahs have empty Arabic text (first: ${emptyText[0].surah_number}:${emptyText[0].ayah_number}). Nothing was written.`);

  // 2) Translations (sequential + short pause: polite to the server)
  const translations = [];
  for (const [lang, bookId] of Object.entries(opts.translations)) {
    translations.push(await loadTranslation(lang, bookId));
    await sleep(500);
  }
  for (const t of translations) {
    let missing = 0;
    for (const a of ayahs) if (!t.map.get(`${a.surah_number}:${a.ayah_number}`)) missing++;
    console.log(`  [${t.lang}] "${t.name}": ${t.map.size} entries, ${missing} missing/empty`);
  }

  // 3) Build records
  const rows = ayahs.map((a) => {
    const tr = {};
    for (const t of translations) {
      const text = t.map.get(`${a.surah_number}:${a.ayah_number}`);
      if (text) tr[t.lang] = text;
    }
    return {
      surah_number: a.surah_number,
      surah_name: a.surah_name,
      ayah_number: a.ayah_number,
      text_arabic: a.text_arabic,
      tafseer: null,
      translations: tr,
      source: 'quranpedia.net',
      source_url: `${SITE_BASE}/surah/${opts.mushaf}/${a.surah_number}?ayah_id=${a.id}`,
      tafseer_source_url: null,
    };
  });

  // 4) Write (atomic) — one record per line keeps git diffs and streaming readers friendly
  writeFileAtomic(outFile, '[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n');
  const meta = {
    generated_at: new Date().toISOString(),
    attribution: 'Quran text and translations: Quranpedia.net (https://quranpedia.net)',
    mushaf: { id: opts.mushaf, name: mushaf.json.name ?? null, loaded_from: mushaf.kind, url: mushaf.url, sha256: mushaf.sha256 },
    translations: Object.fromEntries(
      translations.map((t) => [t.lang, { book_id: t.bookId, name: t.name, locale: t.locale, url: t.url, sha256: t.sha256 }]),
    ),
    counts: { surahs: surahCount, ayahs: rows.length },
    notes: 'tafseer is null on purpose: it comes from dorar.net/tafseer (separate script).',
  };
  writeFileAtomic(metaFile, JSON.stringify(meta, null, 2) + '\n');

  const sample = rows.find((r) => r.surah_number === 2 && r.ayah_number === 255);
  console.log(`\nDone. Wrote ${rows.length} ayahs -> ${path.relative(process.cwd(), outFile)}`);
  console.log(`Meta -> ${path.relative(process.cwd(), metaFile)}`);
  if (sample) console.log(`Sample 2:255 -> ${sample.text_arabic.slice(0, 60)}… | en: ${(sample.translations.en ?? '').slice(0, 60)}…`);
}

module.exports = { cleanArabic, cleanTranslation, flattenMushaf, maybeGunzip, parseArgs };

if (require.main === module) {
  main().catch((err) => {
    console.error(`\nFAILED: ${err.message}`);
    process.exitCode = 1;
  });
}
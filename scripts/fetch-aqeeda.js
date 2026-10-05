#!/usr/bin/env node
'use strict';
// =====================================================================
// scripts/fetch-aqeeda.js
// جلب أحاديث عن العقيدة من dorar_api.json
// المصدر: dorar.net (API)  |  الناتج: data/aqeeda.json
//
// الاستخدام:
//   node scripts/fetch-aqeeda.js --probe
//   node scripts/fetch-aqeeda.js              # جلب كامل
//   node scripts/fetch-aqeeda.js --limit 20   # تجربة
// =====================================================================

const fs = require('fs');
const path = require('path');

const API_URL = 'https://dorar.net/dorar_api.json';
const CONTACT = process.env.AAED_CONTACT || '';
const USER_AGENT = CONTACT ? `Aaed-Platform/1.0 (${CONTACT})` : 'Aaed-Platform/1.0';

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 2000;
const DELAY_MS = 2000; // API أسرع، مش محتاج 7s
const SAVE_EVERY = 20;

const DEFAULT_TARGET = 100;
const DEFAULT_PER_KEYWORD = 15; // الـ API بيرجّع 15 حديث لكل keyword

// كلمات مفتاحية للعقيدة
const KEYWORDS = [
  'التوحيد',
  'الإيمان',
  'أركان الإيمان',
  'أسماء الله',
  'صفات الله',
  'القدر',
  'الملائكة',
  'الكتب السماوية',
  'الرسل والأنبياء',
  'البعث والنشور',
  'الجنة',
  'النار',
  'الشفاعة',
  'الميزان',
  'الصراط',
  'عقيدة أهل السنة',
  'التوحيد عند الصحابة',
  'الولاء والبراء',
  'السنة والبدعة',
  'اليوم الآخر',
];

const SOURCE = 'dorar.net/aqeeda';

// ─── أدوات ───
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJsonWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json,text/plain,*/*',
        },
        signal: ctrl.signal,
      });
      if (res.ok) return await res.json();
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.fatal = res.status >= 400 && res.status < 500 && res.status !== 429;
      throw err;
    } catch (e) {
      lastErr = e;
      if (e.fatal || attempt === MAX_RETRIES) break;
      const wait = BACKOFF_BASE_MS * 2 ** (attempt - 1);
      console.warn(`  ⚠ فشل (${e.name === 'AbortError' ? 'timeout' : e.message}) — محاولة ${attempt}/${MAX_RETRIES}، انتظار ${wait / 1000}s`);
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function stripHtml(s) {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[\u200b\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHadithHtml(html) {
  const out = [];
  if (typeof html !== 'string') return out;

  const blockRe = /<div class="hadith"[^>]*>([\s\S]*?)<\/div>\s*<div class="hadith-info">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    let text = stripHtml(m[1]).replace(/^\d+\s*-\s*/, '').replace(/(\s*\.\s*)+$/, '').trim();

    const marked = m[2].replace(/<span[^>]*info-subtitle[^>]*>\s*([^<]*?)\s*<\/span>/g, (_, label) => `@@${label.replace(/:\s*$/, '').trim()}@@`);
    const plain = marked.replace(/<[^>]*>/g, ' ');
    const fields = {};
    const fieldRe = /@@([^@]+)@@([^@]*)/g;
    let f;
    while ((f = fieldRe.exec(plain)) !== null) {
      fields[f[1].trim()] = stripHtml(f[2]);
    }

    let narrator = (fields['الراوي'] || '').replace(/[\[\]]/g, '').trim();
    if (narrator === '-' || narrator === '') narrator = null;

    const numRaw = (fields['الصفحة أو الرقم'] || '').trim();
    const number = /^\d+$/.test(numRaw) ? parseInt(numRaw, 10) : null;

    out.push({
      text,
      narrator,
      muhaddith: fields['المحدث'] || null,
      book: (fields['المصدر'] || '').trim(),
      number,
      grade: fields['خلاصة حكم المحدث'] || null,
    });
  }
  return out;
}

function buildUrl(keyword, page) {
  const p = new URLSearchParams();
  p.append('skey', keyword);
  if (page > 1) p.append('page', String(page));
  return `${API_URL}?${p.toString()}`;
}

function buildRecord(raw, topic) {
  const query = raw.text.split(/\s+/).slice(0, 12).join(' ');
  return {
    topic,
    content: raw.text,
    breadcrumb: `${topic} › ${raw.book || 'مصدر غير محدد'}`,
    footnotes: raw.grade ? `الحكم: ${raw.grade}` : '',
    translations: { en: null, fr: null, ur: null, id: null },
    source: SOURCE,
    source_url: `https://dorar.net/hadith/search?q=${encodeURIComponent(query)}`,
  };
}

function validateRecord(r) {
  const errs = [];
  if (!r.topic) errs.push('topic فارغ');
  if (typeof r.content !== 'string' || r.content.length < 30) errs.push('content قصير');
  else if (!/[\u0600-\u06FF]/.test(r.content)) errs.push('content بلا عربية');
  if (!r.source_url || !r.source_url.startsWith('https://dorar.net/')) errs.push('source_url غير صالح');
  return errs;
}

function dedupKey(r) {
  return r.content.replace(/\s+/g, ' ').slice(0, 80);
}

function loadJsonArray(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) throw new Error('الملف ليس مصفوفة');
    return data;
  } catch (e) {
    throw new Error(`تعذّر قراءة ${file}: ${e.message}. استخدم --no-resume`);
  }
}

function saveAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function parseArgs(argv) {
  const args = {
    limit: Infinity,
    output: path.join(__dirname, '..', 'data', 'aqeeda.json'),
    resume: true,
    probe: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--output') args.output = path.resolve(argv[++i]);
    else if (a === '--no-resume') args.resume = false;
    else if (a === '--probe') args.probe = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`خيار غير معروف: ${a}`);
  }
  return args;
}

async function probe() {
  console.log('— فحص dorar.net/dorar_api.json —\n');
  for (const kw of KEYWORDS.slice(0, 2)) {
    const url = buildUrl(kw, 1);
    console.log(`▶ «${kw}»`);
    try {
      const json = await fetchJsonWithRetry(url);
      const html = json && json.ahadith && json.ahadith.result;
      const parsed = parseHadithHtml(html);
      console.log(`  ✓ ${parsed.length} نتيجة`);
      if (parsed[0]) {
        console.log(`    - ${parsed[0].text.slice(0, 100)}`);
        console.log(`    - المصدر: ${parsed[0].book} | الحكم: ${parsed[0].grade}`);
      }
    } catch (e) {
      console.log(`  ✗ فشل: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  console.log('\n✅ الفحص انتهى — السكربت شغال');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('الاستخدام: node scripts/fetch-aqeeda.js [--probe] [--limit N] [--output PATH] [--no-resume]');
    return;
  }
  if (args.probe) return probe();

  let items = [];
  if (args.resume) {
    items = loadJsonArray(args.output);
    if (items.length) console.log(`↻ استئناف: ${items.length} موجود`);
  }

  const seen = new Set(items.map(dedupKey));
  let newCount = 0;
  let sinceSave = 0;
  let stopping = false;

  const save = () => { saveAtomic(args.output, items); sinceSave = 0; };

  process.on('SIGINT', () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log('\n⏹ إيقاف… حفظ');
    save();
    process.exit(0);
  });

  console.log(`الهدف: ${args.limit === Infinity ? 'الكل' : args.limit} من ${KEYWORDS.length} keyword\n`);

  outer:
  for (const kw of KEYWORDS) {
    if (newCount >= args.limit) break;
    console.log(`\n▶ «${kw}»`);

    for (let page = 1; page <= 3; page++) {
      if (newCount >= args.limit) break outer;

      let json;
      try {
        json = await fetchJsonWithRetry(buildUrl(kw, page));
      } catch (e) {
        console.warn(`  ✗ فشل: ${e.message}`);
        break;
      }

      const parsed = parseHadithHtml(json && json.ahadith && json.ahadith.result);
      if (parsed.length === 0) break;

      let added = 0;
      for (const raw of parsed) {
        if (newCount >= args.limit) break;
        const rec = buildRecord(raw, 'العقيدة');
        const errs = validateRecord(rec);
        if (errs.length) continue;
        const key = dedupKey(rec);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(rec);
        added++;
        newCount++;
        sinceSave++;
        if (sinceSave >= SAVE_EVERY) {
          save();
          console.log(`  💾 حفظ دوري (${items.length})`);
        }
      }
      console.log(`  صفحة ${page}: +${added} [الإجمالي: ${items.length}]`);
      if (parsed.length < 10) break;
      await sleep(DELAY_MS);
    }
  }

  save();
  console.log(`\n================ الملخص ================`);
  console.log(`المجموع: ${items.length} (جديد: ${newCount})`);
  console.log(`الملف: ${args.output}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('✗ خطأ:', e.message);
    process.exit(1);
  });
}
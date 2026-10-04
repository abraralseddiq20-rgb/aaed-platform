#!/usr/bin/env node
'use strict';
// =====================================================================
// scripts/fetch-hadith.js
// جلب 500 حديث من صحيح البخاري من الدرر السنية
// المصدر الوحيد: dorar.net/hadith (عبر dorar_api.json)
// الناتج: data/hadith.json
//
// ⚠️ ملاحظة: صحيح مسلم غير مُدرج حالياً لأن معرّفه (s[]) في dorar.net
// لم يُكتشف بعد. عند اكتشافه، أضيفيه إلى مصفوفة BOOKS أدناه.
//
// TODO (الإصدار القادم):
//   - اكتشاف معرّف صحيح مسلم من dorar.net
//   - إضافة 250 حديث إضافي من صحيح مسلم
//   - إكمال السكرابينغ لباقي المصادر (الترمذي، النسائي، أبو داود، ابن ماجه)
//
// ملاحظة تقنية: نستخدم curl بدل fetch لأن dorar.net يحجب Node.js fetch
//
// الاستخدام:
//   node scripts/fetch-hadith.js --probe          # فحص سريع للواجهة
//   node scripts/fetch-hadith.js                  # جلب كامل مع استئناف
//   node scripts/fetch-hadith.js --limit 20       # جلب 20 حديثاً (للتجربة)
//   node scripts/fetch-hadith.js --no-resume      # بدء من الصفر
// =====================================================================

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------
// الإعدادات
// ---------------------------------------------------------------------
const API_URL = 'https://dorar.net/dorar_api.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 2000;
const DELAY_MS = 2000;
const SAVE_EVERY = 50;
const MAX_PAGES_PER_KEYWORD = 3;
const DEFAULT_PER_TOPIC = 50;  // 50 لكل موضوع × 10 مواضيع = 500 حديث

const BOOKS = [
  { name: 'صحيح البخاري', id: 6216 },
];

const TOPICS = [
  { key: 'العقيدة', keywords: ['الإيمان', 'التوحيد', 'القدر', 'الملائكة', 'الجنة', 'النار', 'البعث', 'الشفاعة', 'الميزان', 'الصراط'] },
  { key: 'الطهارة', keywords: ['الوضوء', 'الغسل', 'التيمم', 'الاستنجاء', 'الحيض', 'السواك', 'الجنابة', 'الماء', 'المسح على الخفين'] },
  { key: 'الصلاة', keywords: ['الصلاة', 'الأذان', 'الركوع', 'السجود', 'الجمعة', 'التشهد', 'القنوت', 'الإقامة', 'الوتر', 'الجماعة'] },
  { key: 'الزكاة', keywords: ['الزكاة', 'الصدقة', 'زكاة الفطر', 'المسكين', 'الإنفاق', 'العشر', 'الركاز', 'السائل'] },
  { key: 'الصيام', keywords: ['الصيام', 'رمضان', 'الإفطار', 'السحور', 'الاعتكاف', 'ليلة القدر', 'عاشوراء', 'الهلال'] },
  { key: 'الحج', keywords: ['الحج', 'العمرة', 'الطواف', 'عرفة', 'التلبية', 'الإحرام', 'السعي', 'الهدي', 'منى', 'مزدلفة'] },
  { key: 'الأخلاق', keywords: ['الصدق', 'الحياء', 'الكذب', 'الغيبة', 'حسن الخلق', 'الرحمة', 'الأمانة', 'الجار', 'الوالدين', 'الغضب', 'التواضع', 'الكبر'] },
  { key: 'الدعاء', keywords: ['الدعاء', 'الاستغفار', 'الذكر', 'التسبيح', 'التعوذ', 'اللهم', 'الحمد', 'التهليل', 'التكبير'] },
  { key: 'السيرة', keywords: ['الهجرة', 'غزوة', 'بدء الوحي', 'فتح مكة', 'الحديبية', 'المبعث', 'الإسراء', 'بدر', 'أحد', 'الخندق'] },
  { key: 'التفسير', keywords: ['نزلت', 'قوله تعالى', 'سبب النزول', 'سورة', 'الفاتحة', 'آية الكرسي', 'القرآن', 'قرأ'] },
];

// ---------------------------------------------------------------------
// سطر الأوامر
// ---------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    limit: Infinity,
    output: path.join(__dirname, '..', 'data', 'hadith.json'),
    resume: true,
    probe: false,
    perTopic: DEFAULT_PER_TOPIC,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--output') args.output = path.resolve(argv[++i]);
    else if (a === '--per-topic') args.perTopic = parseInt(argv[++i], 10);
    else if (a === '--no-resume') args.resume = false;
    else if (a === '--probe') args.probe = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`خيار غير معروف: ${a}`);
  }
  if (!(args.limit > 0)) throw new Error('--limit يجب أن يكون رقماً موجباً');
  if (!(args.perTopic > 0)) throw new Error('--per-topic يجب أن يكون رقماً موجباً');
  return args;
}

function printHelp() {
  console.log(`الاستخدام: node scripts/fetch-hadith.js [--probe] [--limit N] [--output PATH] [--no-resume] [--per-topic N]`);
}

// ---------------------------------------------------------------------
// أدوات عامة
// ---------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJsonWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { stdout } = await execFileAsync('curl.exe', [
        '-s',
        '-H', `User-Agent: ${UA}`,
        '-H', 'Accept: application/json, text/plain, */*',
        '-H', 'Accept-Language: ar,en;q=0.9',
        '-H', 'Referer: https://dorar.net/',
        '-H', 'Origin: https://dorar.net',
        '--max-time', String(Math.floor(TIMEOUT_MS / 1000)),
        url,
      ], {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      });

      if (!stdout || !stdout.trim()) {
        throw new Error('empty response');
      }

      return JSON.parse(stdout);
    } catch (e) {
      lastErr = e;
      if (attempt === MAX_RETRIES) break;
      const wait = BACKOFF_BASE_MS * 2 ** (attempt - 1);
      console.warn(`  ⚠ فشل (${e.message}) — محاولة ${attempt}/${MAX_RETRIES}، انتظار ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

function buildUrl(keyword, bookId, page) {
  const p = new URLSearchParams();
  p.append('skey', keyword);
  if (bookId) p.append('s[]', String(bookId));
  if (page > 1) p.append('page', String(page));
  return `${API_URL}?${p.toString()}`;
}

// ---------------------------------------------------------------------
// تحليل HTML
// ---------------------------------------------------------------------
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

function buildRecord(raw, topic) {
  const query = raw.text.split(/\s+/).slice(0, 12).join(' ');
  return {
    book: raw.book,
    number: raw.number,
    chapter: null,
    narrator: raw.narrator,
    text: raw.text,
    grade: raw.grade,
    translations: { en: null, fr: null, ur: null, id: null },
    source: 'dorar.net/hadith',
    source_url: `https://dorar.net/hadith/search?q=${encodeURIComponent(query)}`,
    topic,
  };
}

function validateRecord(r) {
  const errs = [];
  if (!BOOKS.some((b) => b.name === r.book)) errs.push('book غير معتمد');
  if (typeof r.text !== 'string' || r.text.length < 20) errs.push('text قصير جداً');
  else if (!/[\u0600-\u06FF]/.test(r.text)) errs.push('text بلا حروف عربية');
  if (!r.source_url || !r.source_url.startsWith('https://dorar.net/')) errs.push('source_url غير صالح');
  return errs;
}

function dedupKey(r) {
  if (r.number != null) return `${r.book}#${r.number}`;
  return `${r.book}~${r.text.replace(/\s+/g, ' ').slice(0, 80)}`;
}

function loadExisting(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) throw new Error('الملف ليس مصفوفة');
    return data;
  } catch (e) {
    throw new Error(`تعذّر قراءة ${file}: ${e.message}. استخدم --no-resume للبدء من جديد.`);
  }
}

function saveAtomic(file, items) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------------
// وضع الفحص
// ---------------------------------------------------------------------
async function probe() {
  console.log('— فحص واجهة الدرر السنية —');
  for (const book of BOOKS) {
    console.log(`\nالكتاب: ${book.name} (s[]=${book.id})`);
    const firstTexts = [];
    for (const page of [1, 2]) {
      try {
        const json = await fetchJsonWithRetry(buildUrl('الصلاة', book.id, page));
        const items = parseHadithHtml(json && json.ahadith && json.ahadith.result);
        firstTexts.push(items[0] ? items[0].text : null);
        const dist = {};
        items.forEach((it) => { dist[it.book || '?'] = (dist[it.book || '?'] || 0) + 1; });
        console.log(`  صفحة ${page}: ${items.length} نتيجة —`, JSON.stringify(dist));
      } catch (e) {
        console.log(`  صفحة ${page}: ✗ ${e.message}`);
      }
      await sleep(DELAY_MS);
    }
    console.log(`  الترقيم يعمل؟ ${firstTexts[0] && firstTexts[1] && firstTexts[0] !== firstTexts[1] ? 'نعم' : 'غير مؤكد'}`);
  }
  console.log('\nانتهى الفحص.');
}

// ---------------------------------------------------------------------
// البرنامج الرئيسي
// ---------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args.probe) return probe();

  let items = [];
  if (args.resume) {
    items = loadExisting(args.output);
    if (items.length) console.log(`↻ استئناف: ${items.length} حديثاً موجوداً`);
  } else if (fs.existsSync(args.output)) {
    fs.copyFileSync(args.output, `${args.output}.bak`);
    console.log(`نُسخ الملف القديم إلى ${args.output}.bak`);
  }

  const seen = new Set(items.map(dedupKey));
  const counts = {};
  items.forEach((r) => { const k = `${r.book}|${r.topic}`; counts[k] = (counts[k] || 0) + 1; });

  let newCount = 0;
  let sinceSave = 0;
  let firstRequest = true;
  let stopping = false;

  const save = () => { saveAtomic(args.output, items); sinceSave = 0; };

  process.on('SIGINT', () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log('\n⏹ إيقاف… حفظ');
    save();
    process.exit(0);
  });

  const target = args.perTopic;
  const limitReached = () => newCount >= args.limit;

  outer:
  for (const book of BOOKS) {
    let bookMatches = 0;
    let bookQueries = 0;

    for (const topic of TOPICS) {
      const ck = `${book.name}|${topic.key}`;
      if ((counts[ck] || 0) >= target) continue;
      console.log(`\n▶ ${book.name} — ${topic.key} (${counts[ck] || 0}/${target})`);

      for (const kw of topic.keywords) {
        if ((counts[ck] || 0) >= target) break;

        for (let page = 1; page <= MAX_PAGES_PER_KEYWORD; page++) {
          if ((counts[ck] || 0) >= target || limitReached()) break;

          if (!firstRequest) await sleep(DELAY_MS);
          firstRequest = false;

          let json;
          try {
            json = await fetchJsonWithRetry(buildUrl(kw, book.id, page));
          } catch (e) {
            console.warn(`  ✗ تعذّر «${kw}» ص${page}: ${e.message} — تخطّي`);
            break;
          }
          bookQueries++;

          const parsed = parseHadithHtml(json && json.ahadith && json.ahadith.result);
          if (parsed.length === 0) break;

          let added = 0;
          for (const raw of parsed) {
            if (raw.book !== book.name) continue;
            bookMatches++;
            const rec = buildRecord(raw, topic.key);
            const errs = validateRecord(rec);
            if (errs.length) { console.warn(`  ✗ سجل مرفوض (${errs.join('، ')})`); continue; }
            const key = dedupKey(rec);
            if (seen.has(key)) continue;
            seen.add(key);
            items.push(rec);
            counts[ck] = (counts[ck] || 0) + 1;
            added++; newCount++; sinceSave++;
            if (sinceSave >= SAVE_EVERY) { save(); console.log(`  💾 حفظ دوري (${items.length})`); }
            if ((counts[ck] || 0) >= target || limitReached()) break;
          }
          console.log(`  «${kw}» ص${page}: ${parsed.length} نتيجة، أُضيف ${added} [${counts[ck] || 0}/${target}]`);

          if (bookQueries >= 3 && bookMatches === 0) {
            console.warn(`  ⚠ ${bookQueries} طلبات بلا نتيجة. غالباً معرّف s[] غير صحيح.`);
          }
        }
        if (limitReached()) break outer;
      }
    }
  }

  save();

  console.log('\n================ الملخص ================');
  console.log(`المجموع: ${items.length} حديثاً (جديد: ${newCount})`);
  for (const b of BOOKS) {
    const n = items.filter((r) => r.book === b.name).length;
    console.log(`${b.name}: ${n}`);
  }
  const noNum = items.filter((r) => r.number == null).length;
  if (noNum) console.log(`\nتنبيه: ${noNum} حديثاً بلا رقم.`);
  console.log(`\nالملف: ${args.output}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('✗ خطأ:', e.message);
    process.exit(1);
  });
}

module.exports = { parseHadithHtml, buildRecord, validateRecord, dedupKey };
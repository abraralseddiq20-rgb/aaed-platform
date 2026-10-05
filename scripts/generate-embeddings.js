const fs = require('fs');

const MODEL = 'gemini-embedding-001';
const DIMS = 768;
const BATCH_SIZE = 20;
const PAUSE_MS = 13000;
const MINUTE_WAIT_MS = 40000;
const MAX_MINUTE_RETRIES = 10;

function arg(name, def) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : def;
}

const INPUT = arg('input', 'data/hadith.json');
const OUTPUT = arg('output', 'data/hadith.embeddings.json');
const TEXT_FIELD = arg('text-field', 'text');
const KEYS = arg('keys', 'book,number').split(',');
const NO_RESUME = process.argv.includes('--no-resume');

function loadKey() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const m = env.match(/^GEMINI_API_KEY=(.+)$/m);
  if (!m) throw new Error('GEMINI_API_KEY غير موجود في .env.local');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalize(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

async function generateBatch(texts, apiKey) {
  const requests = texts.map((text) => ({
    model: `models/${MODEL}`,
    content: { parts: [{ text: String(text || '').trim() || '.' }] },
    outputDimensionality: DIMS,
  }));

  let minuteRetries = 0;
  let serverRetries = 0;

  while (true) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ requests }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.embeddings.map((e) => normalize(e.values));
    }

    const body = await res.text();

    if (res.status === 429) {
      if (/PerDay|per day/i.test(body)) {
        console.error('\nHTTP 429:', body.slice(0, 500));
        const err = new Error('DAILY_QUOTA');
        err.daily = true;
        throw err;
      }
      minuteRetries++;
      if (minuteRetries > MAX_MINUTE_RETRIES) {
        console.error('\nHTTP 429 متكرر:', body.slice(0, 500));
        throw new Error('429 متكرر');
      }
      console.log(`⏳ حد الدقيقة، انتظار ${MINUTE_WAIT_MS / 1000} ثانية (محاولة ${minuteRetries})...`);
      await sleep(MINUTE_WAIT_MS);
      continue;
    }

    if (res.status >= 500 && serverRetries < 3) {
      serverRetries++;
      console.log(`⚠️ خطأ خادم ${res.status}، إعادة المحاولة...`);
      await sleep(3000 * serverRetries);
      continue;
    }

    console.error(`\nHTTP ${res.status}:`, body.slice(0, 500));
    throw new Error(`HTTP ${res.status}`);
  }
}

(async () => {
  console.log('🚀 بدء توليد Embeddings...');
  console.log(`الموديل: ${MODEL} (${DIMS} بُعدًا) | الحقل: ${TEXT_FIELD} | المفاتيح: ${KEYS.join(',')}`);
  const apiKey = loadKey();
  console.log('✅ GEMINI_API_KEY مُحمَّل');

  const items = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  console.log(`📖 الإجمالي: ${items.length}`);

  let results = [];
  if (!NO_RESUME && fs.existsSync(OUTPUT)) {
    results = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    console.log(`↩️ استئناف من العنصر رقم ${results.length}`);
  }

  let sinceSave = 0;
  const save = () => fs.writeFileSync(OUTPUT, JSON.stringify(results), { encoding: 'utf8' });

  for (let i = results.length; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    try {
      const vectors = await generateBatch(slice.map((h) => h[TEXT_FIELD]), apiKey);
      slice.forEach((h, k) => {
        const row = {};
        KEYS.forEach((key) => { row[key] = h[key]; });
        row.embedding = vectors[k];
        results.push(row);
      });
      sinceSave += slice.length;
      if (sinceSave >= 100 || i + BATCH_SIZE >= items.length) {
        save();
        sinceSave = 0;
      }
      console.log(`✅ ${results.length} / ${items.length}`);
    } catch (err) {
      save();
      if (err.daily) {
        console.error('\n⏸️ انتهت الحصة اليومية. شغّلي السكربت لاحقًا (بدون --no-resume) لتكملي.');
      } else {
        console.error(`\n❌ خطأ عند العنصر ${i}: ${err.message}`);
      }
      process.exit(1);
    }
    if (i + BATCH_SIZE < items.length) await sleep(PAUSE_MS);
  }

  console.log(`\n🎉 تم! الملف: ${OUTPUT}`);
})();
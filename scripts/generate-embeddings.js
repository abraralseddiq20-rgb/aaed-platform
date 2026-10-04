const fs = require('fs');

const MODEL = 'gemini-embedding-2';
const DIMS = 768;
const BATCH_SIZE = 20;
const PAUSE_MS = 1500;

function arg(name, def) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : def;
}

const INPUT = arg('input', 'data/hadith.json');
const OUTPUT = arg('output', 'data/hadith.embeddings.json');
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

  for (let attempt = 1; attempt <= 3; attempt++) {
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
    console.error(`\nHTTP ${res.status}:`, body.slice(0, 500));

    if (res.status === 429) {
      const err = new Error('QUOTA');
      err.quota = true;
      throw err;
    }
    if (res.status >= 500 && attempt < 3) {
      await sleep(3000 * attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

(async () => {
  console.log('🚀 بدء توليد Embeddings...');
  const apiKey = loadKey();
  console.log('✅ GEMINI_API_KEY مُحمَّل');

  const hadiths = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  console.log(`📖 إجمالي الأحاديث: ${hadiths.length}`);

  let results = [];
  if (!NO_RESUME && fs.existsSync(OUTPUT)) {
    results = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    console.log(`↩️ استئناف من الحديث رقم ${results.length}`);
  }

  for (let i = results.length; i < hadiths.length; i += BATCH_SIZE) {
    const slice = hadiths.slice(i, i + BATCH_SIZE);
    try {
      const vectors = await generateBatch(slice.map((h) => h.text), apiKey);
      slice.forEach((h, k) => {
        results.push({ book: h.book, number: h.number, embedding: vectors[k] });
      });
      fs.writeFileSync(OUTPUT, JSON.stringify(results), { encoding: 'utf8' });
      console.log(`✅ ${results.length} / ${hadiths.length}`);
    } catch (err) {
      if (err.quota) {
        console.error('\n⏸️ انتهت الحصة اليومية. شغّلي السكربت لاحقًا بدون --no-resume لتكملي.');
      } else {
        console.error(`\n❌ خطأ عند الحديث ${i}: ${err.message}`);
      }
      process.exit(1);
    }
    await sleep(PAUSE_MS);
  }

  console.log(`\n🎉 تم! الملف: ${OUTPUT}`);
})();
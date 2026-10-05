/**
 * 🚀 رفع embeddings القرآن على Supabase
 * 
 * يدمج data/quran.json + data/quran.001.embeddings.json على (surah_number, ayah_number)
 * ويستخدم upsert لتفادي التكرار.
 * 
 * التشغيل:
 *   node scripts/upload-quran.js
 */

const fs = require('fs');
const path = require('path');

// ─── تحميل المتغيرات من .env.local ───
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ مفقود: NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY في .env.local');
  process.exit(1);
}

// ─── إعدادات ───
const BATCH_SIZE = 50;           // صفوف لكل دفعة
const DELAY_BETWEEN_BATCHES = 500; // ms بين كل دفعة
const TABLE = 'quran';

// ─── قراءة الملفات ───
function loadJSON(filepath) {
  console.log(`📖 جارٍ قراءة: ${filepath}`);
  const raw = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(raw);
}

// ─── دمج البيانات ───
function mergeData(quranData, embeddingsData) {
  console.log('🔗 جارٍ دمج البيانات...');
  
  // خريطة الـ embeddings حسب (surah_number, ayah_number)
  const embeddingMap = new Map();
  for (const item of embeddingsData) {
    const key = `${item.surah_number}_${item.ayah_number}`;
    embeddingMap.set(key, item.embedding);
  }

  const merged = [];
  let missing = 0;

  for (const verse of quranData) {
    const key = `${verse.surah_number}_${verse.ayah_number}`;
    const embedding = embeddingMap.get(key);

    if (!embedding) {
      missing++;
      continue;
    }

    merged.push({
      surah_number: verse.surah_number,
      surah_name: verse.surah_name,
      ayah_number: verse.ayah_number,
      text_arabic: verse.text_arabic,
      tafseer: verse.tafseer || null,
      translations: verse.translations || {},
      embedding: embedding,
      source: verse.source || 'quran',
      source_url: verse.source_url || null,
    });
  }

  console.log(`✅ تم دمج ${merged.length} صف`);
  if (missing > 0) {
    console.warn(`⚠️  ${missing} صف بدون embedding (اتخطّى)`);
  }
  return merged;
}

// ─── رفع دفعة واحدة ───
async function uploadBatch(rows, batchNum, totalBatches) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal', // ← upsert على القيد UNIQUE
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  console.log(`  ✅ دفعة ${batchNum}/${totalBatches} — ${rows.length} صف`);
}

// ─── الدالة الرئيسية ───
async function main() {
  console.log('🚀 بدء رفع القرآن على Supabase\n');

  const quranPath = path.join(__dirname, '..', 'data', 'quran.json');
  const embeddingsPath = path.join(__dirname, '..', 'data', 'quran.001.embeddings.json');

  if (!fs.existsSync(quranPath)) {
    console.error(`❌ مش موجود: ${quranPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(embeddingsPath)) {
    console.error(`❌ مش موجود: ${embeddingsPath}`);
    process.exit(1);
  }

  const quranData = loadJSON(quranPath);
  const embeddingsData = loadJSON(embeddingsPath);

  console.log(`  - quran.json: ${quranData.length} صف`);
  console.log(`  - quran.001.embeddings.json: ${embeddingsData.length} صف\n`);

  const merged = mergeData(quranData, embeddingsData);

  // تقسيم لدفعات
  const batches = [];
  for (let i = 0; i < merged.length; i += BATCH_SIZE) {
    batches.push(merged.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n📤 جارٍ رفع ${batches.length} دفعة (${BATCH_SIZE} صف/دفعة)...\n`);

  const startTime = Date.now();
  let uploaded = 0;

  for (let i = 0; i < batches.length; i++) {
    try {
      await uploadBatch(batches[i], i + 1, batches.length);
      uploaded += batches[i].length;
    } catch (err) {
      console.error(`\n❌ فشل في الدفعة ${i + 1}:`);
      console.error(`   ${err.message}`);
      console.error(`\n⏸️  تم رفع ${uploaded} صف قبل الفشل. يمكن إعادة التشغيل لاستئناف الرفع.`);
      process.exit(1);
    }

    // انتظار صغير بين الدفعات
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 تم! رُفع ${uploaded} صف في ${elapsed} ثانية`);
  console.log('📊 تحقق من Supabase: SELECT count(*) FROM quran;');
}

main().catch(err => {
  console.error('❌ خطأ غير متوقع:', err);
  process.exit(1);
});
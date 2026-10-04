#!/usr/bin/env node
/**
 * scripts/upload-to-supabase.js
 * ─────────────────────────────────────────────────────────────
 * يرفع بيانات القرآن + Embeddings إلى Supabase.
 *
 * Inputs:
 *   - data/quran.json              (6,236 آية + ترجمات)
 *   - data/quran.embeddings.json   (Embeddings لكل آية)
 *
 * Output:
 *   - جدول quran في Supabase
 *
 * Usage:
 *   node scripts/upload-to-supabase.js
 *   node scripts/upload-to-supabase.js --dry-run
 *   node scripts/upload-to-supabase.js --limit=100
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

// ─── إعدادات ─────────────────────────────────────────────────
const CHUNK_SIZE = 50;
const DELAY_BETWEEN_CHUNKS = 500;

// ─── قراءة المفاتيح ──────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local غير موجود');
  const content = fs.readFileSync(envPath, 'utf8');

  const urlMatch = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
  const keyMatch = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)|SUPABASE_SERVICE_ROLE_KEY=(.+)/);

  if (!urlMatch) throw new Error('NEXT_PUBLIC_SUPABASE_URL غير موجود');

  // نبحث عن service_role أولاً (للأمان الأفضل)
  const serviceMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  const anonMatch = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
  const key = serviceMatch ? serviceMatch[1].trim() : anonMatch ? anonMatch[1].trim() : null;

  if (!key) throw new Error('مفتاح Supabase غير موجود');

  return {
    url: urlMatch[1].trim(),
    key,
    usingServiceRole: !!serviceMatch,
  };
}

// ─── CLI ─────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    quranFile: 'data/quran.json',
    embeddingsFile: 'data/quran.embeddings.json',
    dryRun: false,
    limit: null,
    table: 'quran',
  };
  for (const arg of argv) {
    if (arg.startsWith('--quran=')) opts.quranFile = arg.slice(8);
    else if (arg.startsWith('--embeddings=')) opts.embeddingsFile = arg.slice(13);
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.slice(8));
    else if (arg.startsWith('--table=')) opts.table = arg.slice(8);
  }
  return opts;
}

// ─── Chunk array ─────────────────────────────────────────────
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('🚀 بدء رفع البيانات إلى Supabase...\n');

  const { url, key, usingServiceRole } = loadEnv();
  console.log(`✅ Supabase URL: ${url}`);
  console.log(`✅ المفتاح: ${usingServiceRole ? 'service_role (كامل)' : 'anon (محدود)'}\n`);

  if (!usingServiceRole) {
    console.warn('⚠️ تحذير: RLS مفعّل — قد لا ينجح الرفع بـ anon key.');
    console.warn('   أضيفي SUPABASE_SERVICE_ROLE_KEY إلى .env.local للأداء الأمثل.\n');
  }

  // قراءة الملفات
  const quranPath = path.resolve(process.cwd(), opts.quranFile);
  const embeddingsPath = path.resolve(process.cwd(), opts.embeddingsFile);

  if (!fs.existsSync(quranPath)) throw new Error(`${opts.quranFile} غير موجود`);
  if (!fs.existsSync(embeddingsPath)) throw new Error(`${opts.embeddingsFile} غير موجود`);

  const quranData = JSON.parse(fs.readFileSync(quranPath, 'utf8'));
  const embeddingsData = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));

  console.log(`📖 القرآن: ${quranData.length} آية`);
  console.log(`🔢 Embeddings: ${embeddingsData.length} آية\n`);

  // دمج البيانات
  const embeddingsMap = new Map();
  for (const e of embeddingsData) {
    embeddingsMap.set(`${e.surah_number}:${e.ayah_number}`, e.embedding);
  }

  let merged = [];
  let missingEmbeddings = 0;

  for (const ayah of quranData) {
    const key = `${ayah.surah_number}:${ayah.ayah_number}`;
    const embedding = embeddingsMap.get(key);

    if (!embedding) {
      missingEmbeddings++;
      continue; // نتخطى الآيات التي ليس لها embedding
    }

    merged.push({
      surah_number: ayah.surah_number,
      surah_name: ayah.surah_name,
      ayah_number: ayah.ayah_number,
      text_arabic: ayah.text_arabic,
      tafseer: ayah.tafseer,
      translations: ayah.translations || {},
      source: ayah.source,
      source_url: ayah.source_url,
      embedding: embedding,
    });
  }

  console.log(`✅ جاهز للرفع: ${merged.length} آية`);
  if (missingEmbeddings > 0) {
    console.log(`⚠️ بدون embedding: ${missingEmbeddings} آية (تم تخطيها)\n`);
  }

  // حد أقصى
  if (opts.limit && opts.limit > 0) {
    merged = merged.slice(0, opts.limit);
    console.log(`⚠️ حد أقصى: ${opts.limit} آية\n`);
  }

  if (opts.dryRun) {
    console.log('🧪 Dry Run — لن يتم الرفع فعلياً');
    console.log(`📊 عدد السجلات: ${merged.length}`);
    console.log(`📊 أول سجل:`, JSON.stringify({
      ...merged[0],
      embedding: `<${merged[0].embedding.length} أرقام>`,
    }, null, 2));
    return;
  }

  // الاتصال بـ Supabase
  const supabase = createClient(url, key);

  // رفع على دفعات
  const chunks = chunk(merged, CHUNK_SIZE);
  console.log(`📦 ${chunks.length} دفعة (${CHUNK_SIZE} آية/دفعة)\n`);

  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < chunks.length; i++) {
    const batch = chunks[i];
    try {
      const { error } = await supabase.from(opts.table).insert(batch);

      if (error) {
        console.error(`  ❌ دفعة ${i + 1}: ${error.message}`);
        errors++;
      } else {
        uploaded += batch.length;
        process.stdout.write(
          `\r📤 ${uploaded}/${merged.length} (${Math.round((uploaded / merged.length) * 100)}%)`
        );
      }
    } catch (err) {
      console.error(`  ❌ دفعة ${i + 1}: ${err.message}`);
      errors++;
    }

    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CHUNKS));
    }
  }

  console.log('\n\n✅ اكتمل الرفع!');
  console.log(`📊 رُفعت: ${uploaded} آية`);
  if (errors > 0) console.log(`⚠️ أخطاء: ${errors} دفعة`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n❌ FAILED: ${err.message}`);
    process.exitCode = 1;
  });
}
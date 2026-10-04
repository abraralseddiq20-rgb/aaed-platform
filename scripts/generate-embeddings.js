#!/usr/bin/env node
/**
 * scripts/generate-embeddings.js
 * ─────────────────────────────────────────────────────────────
 * يقرأ data/quran.json ويولّد Embeddings لكل آية عبر Gemini API.
 * ✅ يقصّر الأبعاد إلى 768
 * ✅ يجرّب عدة موديلات
 * ✅ يتعامل مع Rate Limit بذكاء
 * ✅ يستأنف من حيث توقف
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ─── إعدادات ─────────────────────────────────────────────────
const BATCH_SIZE = 10;               // ⚠️ تقليل — لتجنب Rate Limit
const MAX_RETRIES = 6;
const DELAY_BETWEEN_BATCHES = 5000;  // 5 ثوانٍ بين الدفعات
const DELAY_ON_RATE_LIMIT = 60000;   // 60 ثانية عند Rate Limit
const OUTPUT_DIMENSIONS = 768;

const EMBEDDING_MODELS = [
  'gemini-embedding-001',
  'gemini-embedding-2',
  'gemini-embedding-exp',
];

// ─── قراءة المفتاح ───────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local غير موجود');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/GEMINI_API_KEY=(.+)/);
  if (!match) throw new Error('GEMINI_API_KEY غير موجود');
  return match[1].trim();
}

// ─── CLI ─────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    input: 'data/quran.json',
    output: 'data/quran.embeddings.json',
    batchSize: BATCH_SIZE,
    resume: true, // ⚠️ استئناف تلقائي
    limit: null,  // حد أقصى للآيات
  };
  for (const arg of argv) {
    if (arg.startsWith('--input=')) opts.input = arg.slice(8);
    else if (arg.startsWith('--output=')) opts.output = arg.slice(9);
    else if (arg.startsWith('--batch=')) opts.batchSize = Number(arg.slice(8));
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.slice(8));
    else if (arg === '--no-resume') opts.resume = false;
  }
  return opts;
}

// ─── اكتشاف الموديل ──────────────────────────────────────────
async function detectWorkingModel(apiKey) {
  console.log('🔍 البحث عن موديل Embedding...\n');

  for (const model of EMBEDDING_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text: 'اختبار' }] },
            outputDimensionality: OUTPUT_DIMENSIONS,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.embedding?.values) {
          console.log(`✅ الموديل: ${model} (أبعاد: ${data.embedding.values.length})\n`);
          return model;
        }
      }

      console.log(`  ❌ ${model} — غير متاح (${response.status})`);
    } catch (err) {
      console.log(`  ❌ ${model} — فشل`);
    }
  }

  throw new Error('لا يوجد موديل متاح');
}

// ─── توليد دفعة ──────────────────────────────────────────────
async function generateBatch(texts, apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`;

  const requests = texts.map((text) => ({
    model: `models/${model}`,
    content: { parts: [{ text }] },
    outputDimensionality: OUTPUT_DIMENSIONS,
  }));

  let rateLimitCount = 0;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({ requests }),
      });

      const data = await response.json();

      if (response.ok && data.embeddings) {
        return data.embeddings.map((e) => e.values);
      }

      if (response.status === 429) {
        rateLimitCount++;
        const wait = DELAY_ON_RATE_LIMIT * rateLimitCount;
        console.warn(`  ⚠️ Rate limit (${rateLimitCount}) — انتظار ${wait / 1000}s`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (response.status >= 500) {
        await new Promise((r) => setTimeout(r, attempt * 5000));
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.warn(`  ⚠️ محاولة ${attempt}: ${err.message}`);
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }

  throw new Error('فشل بعد كل المحاولات');
}

// ─── Progress ────────────────────────────────────────────────
function showProgress(done, total, startTime, model) {
  const percent = Math.round((done / total) * 100);
  const elapsed = (Date.now() - startTime) / 1000;
  const elapsedStr = elapsed > 60 
    ? `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s` 
    : `${Math.floor(elapsed)}s`;
  const rate = (done / (elapsed || 1)).toFixed(2);
  const remaining = done > 0 ? Math.round((total - done) / (rate || 1)) : 0;
  const remainingStr = remaining > 60 
    ? `${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s` 
    : `${remaining}s`;

  process.stdout.write(
    `\r📊 ${done}/${total} (${percent}%) | ⏱️ ${elapsedStr} | 🔥 ${rate}/s | ⏳ ${remainingStr}    `
  );
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('🚀 بدء توليد Embeddings...\n');
  console.log('⚙️ الإعدادات:');
  console.log(`   • BATCH_SIZE = ${opts.batchSize}`);
  console.log(`   • DELAY_BETWEEN_BATCHES = ${DELAY_BETWEEN_BATCHES / 1000}s`);
  console.log(`   • DELAY_ON_RATE_LIMIT = ${DELAY_ON_RATE_LIMIT / 1000}s`);
  console.log(`   • OUTPUT_DIMENSIONS = ${OUTPUT_DIMENSIONS}\n`);

  const apiKey = loadEnv();
  console.log('✅ GEMINI_API_KEY مُحمَّل\n');

  const workingModel = await detectWorkingModel(apiKey);

  const inputPath = path.resolve(process.cwd(), opts.input);
  const outputPath = path.resolve(process.cwd(), opts.output);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`الملف ${opts.input} غير موجود`);
  }

  let quranData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // إذا حُدّد --limit
  if (opts.limit && opts.limit > 0) {
    quranData = quranData.slice(0, opts.limit);
    console.log(`⚠️ حد أقصى: ${opts.limit} آية\n`);
  }

  console.log(`📖 إجمالي الآيات: ${quranData.length}\n`);

  let output = [];
  if (opts.resume && fs.existsSync(outputPath)) {
    try {
      output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (Array.isArray(output) && output.length > 0) {
        console.log(`♻️ استئناف من آية ${output.length}\n`);
      } else {
        output = [];
      }
    } catch (e) {
      console.log('⚠️ لا يمكن قراءة الملف السابق — نبدأ من جديد\n');
      output = [];
    }
  }

  const startTime = Date.now();
  const total = quranData.length;

  for (let i = output.length; i < total; i += opts.batchSize) {
    const batch = quranData.slice(i, i + opts.batchSize);
    const texts = batch.map((a) => a.text_arabic);

    try {
      const embeddings = await generateBatch(texts, apiKey, workingModel);

      for (let j = 0; j < batch.length; j++) {
        output.push({
          surah_number: batch[j].surah_number,
          ayah_number: batch[j].ayah_number,
          embedding: embeddings[j],
        });
      }

      // حفظ كل 50 آية
      if (output.length % 50 === 0 || i + opts.batchSize >= total) {
        fs.writeFileSync(outputPath, JSON.stringify(output), 'utf8');
      }

      showProgress(output.length, total, startTime, workingModel);
    } catch (err) {
      console.error(`\n\n❌ خطأ عند الآية ${i}: ${err.message}`);
      console.error(`💾 حُفظ ${output.length} آية — يمكنكِ الاستئناف`);
      fs.writeFileSync(outputPath, JSON.stringify(output), 'utf8');
      process.exit(1);
    }

    if (i + opts.batchSize < total) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log('\n\n✅ اكتمل التوليد!');
  console.log(`📊 المجموع: ${output.length} آية`);
  console.log(`⏱️ الوقت: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} دقيقة`);
  console.log(`💾 حُفظ في: ${opts.output}`);
  console.log(`🔧 الموديل: ${workingModel}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n❌ FAILED: ${err.message}`);
    process.exitCode = 1;
  });
}
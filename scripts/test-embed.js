const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const key = env.match(/GEMINI_API_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, '');
console.log('بداية المفتاح:', key.slice(0, 4));

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const text = 'آية الإيمان حب الأنصار';

async function call(label, model, method, body) {
  const res = await fetch(`${BASE}/${model}:${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const out = await res.text();
  console.log(`\n=== ${label} → HTTP ${res.status}`);
  console.log(out.slice(0, 400));
}

(async () => {
  const content = { parts: [{ text }] };

  await call('1) embedContent بدون أبعاد', 'gemini-embedding-2', 'embedContent',
    { model: 'models/gemini-embedding-2', content });

  await call('2) embedContent مع أبعاد', 'gemini-embedding-2', 'embedContent',
    { model: 'models/gemini-embedding-2', content, outputDimensionality: 768 });

  await call('3) batch مع أبعاد', 'gemini-embedding-2', 'batchEmbedContents',
    { requests: [{ model: 'models/gemini-embedding-2', content, outputDimensionality: 768 }] });

  await call('4) batch بدون أبعاد', 'gemini-embedding-2', 'batchEmbedContents',
    { requests: [{ model: 'models/gemini-embedding-2', content }] });

  await call('5) batch موديل 001 مع أبعاد', 'gemini-embedding-001', 'batchEmbedContents',
    { requests: [{ model: 'models/gemini-embedding-001', content, outputDimensionality: 768 }] });
})();
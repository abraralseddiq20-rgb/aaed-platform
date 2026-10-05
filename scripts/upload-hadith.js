const fs = require('fs');

function loadEnv() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

(async () => {
  const { url, key } = loadEnv();
  if (!url || !key) throw new Error('ناقص NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY في .env.local');

  const hadiths = JSON.parse(fs.readFileSync('data/hadith.json', 'utf8'));
  const embs = JSON.parse(fs.readFileSync('data/hadith.embeddings.json', 'utf8'));

  const embMap = new Map(embs.map((e) => [`${e.book}|${e.number}`, e.embedding]));

  const rows = new Map();
  for (const h of hadiths) {
    const k = `${h.book}|${h.number}`;
    const embedding = embMap.get(k);
    if (!embedding) continue;
    rows.set(k, {
      book: h.book,
      number: h.number,
      text: h.text,
      grade: h.grade,
      translations: h.translations || {},
      source: h.source,
      source_url: h.source_url,
      embedding: JSON.stringify(embedding),
    });
  }

  const list = [...rows.values()];
  console.log(`سيُرفع ${list.length} حديث`);

  const SIZE = 50;
  for (let i = 0; i < list.length; i += SIZE) {
    const chunk = list.slice(i, i + SIZE);
    const res = await fetch(`${url}/rest/v1/hadith?on_conflict=book,number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error(`\n❌ فشل عند الصف ${i}: HTTP ${res.status}`);
      console.error(await res.text());
      process.exit(1);
    }
    console.log(`✅ ${Math.min(i + SIZE, list.length)} / ${list.length}`);
  }
  console.log('\n🎉 تم الرفع');
})();
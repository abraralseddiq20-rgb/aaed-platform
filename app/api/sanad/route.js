// app/api/sanad/route.js
// "سند" — نقطة النهاية الخاصة بالإجابة على الأسئلة الشرعية (RAG)

const { createClient } = require('@supabase/supabase-js');
const { fetchFromDorar } = require('../../../lib/dorar');

// ─── الإعدادات ─────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const EMBED_MODEL = 'gemini-embedding-2';
const EMBED_DIMS = 768;
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

const MATCH_COUNT = 5;
const MIN_SIMILARITY = 0.35;
const MAX_QUESTION_LENGTH = 1500;
const REQUEST_TIMEOUT_MS = 25000;

const KNOWLEDGE_TABLES = [
  'quran', 'hadith', 'aqeeda', 'feqhi',
  'seerah', 'terminology', 'dawah', 'live_cache',
];

// نصوص الترجمة
const MESSAGES = {
  server_not_ready: {
    ar: 'الخدمة غير مهيأة حالياً.',
    en: 'Service is not ready yet.',
    fr: 'Le service n\'est pas prêt.',
    ur: 'سروس ابھی تیار نہیں ہے۔',
    id: 'Layanan belum siap.',
  },
  error_generic: {
    ar: 'حدث خطأ أثناء معالجة سؤالك. حاول مرة أخرى بعد قليل.',
    en: 'An error occurred while processing your question. Please try again.',
    fr: 'Une erreur s\'est produite. Veuillez réessayer.',
    ur: 'آپ کے سوال پر کارروائی کے دوران ایک خرابی پیش آئی۔ دوبارہ کوشش کریں۔',
    id: 'Terjadi kesalahan saat memproses pertanyaan Anda. Coba lagi.',
  },
  question_required: {
    ar: 'السؤال مطلوب.',
    en: 'Question is required.',
    fr: 'La question est requise.',
    ur: 'سوال درکار ہے۔',
    id: 'Pertanyaan diperlukan.',
  },
  question_too_long: {
    ar: 'السؤال طويل جداً.',
    en: 'Question is too long.',
    fr: 'La question est trop longue.',
    ur: 'سوال بہت لمبا ہے۔',
    id: 'Pertanyaan terlalu panjang.',
  },
};

function getMessage(key, lang) {
  const msg = MESSAGES[key];
  if (!msg) return key;
  return msg[lang] || msg.en;
}

// ─── أدوات مساعدة ─────────────────────────────────────────
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

async function fetchWithRetry(url, options, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

async function geminiGenerate({ systemInstruction, userText, temperature = 0.3, maxOutputTokens = 2048 }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { temperature, maxOutputTokens },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetchWithRetry(`${GEMINI_BASE}/${CHAT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini chat failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const candidate = data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  const text = parts ? parts.map((p) => p.text || '').join('').trim() : '';

  if (!text) {
    const reason = (candidate && candidate.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason) || 'EMPTY';
    throw new Error(`Gemini returned empty response (${reason})`);
  }
  return text;
}

function normalizeVector(vec) {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

async function embedQuery(text) {
  const res = await fetchWithRetry(`${GEMINI_BASE}/${EMBED_MODEL}:embedContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: EMBED_DIMS,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Embedding failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const values = data.embedding && data.embedding.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error('Unexpected embedding shape');
  }
  return normalizeVector(values);
}

async function translateText(text, targetLangCode) {
  const langNames = {
    ar: 'Arabic', en: 'English', fr: 'French', ur: 'Urdu', id: 'Indonesian',
  };
  const targetName = langNames[targetLangCode] || targetLangCode;
  return geminiGenerate({
    systemInstruction:
      'You are a precise translator of Islamic content. Translate the user text faithfully. ' +
      'Keep Quran verses and hadith texts in their original Arabic, followed by their translation in parentheses. ' +
      'Keep source numbers like [1], [2] unchanged. Output only the translation, no preface.',
    userText: `Translate into ${targetName}:\n\n${text}`,
    temperature: 0.1,
    maxOutputTokens: 3000,
  });
}

function normalizeRow(row, defaultTable) {
  if (!row) return null;
  const text =
    row.content || row.text || row.ayah_text || row.arabic_text || row.hadith_text ||
    row.body || row.answer || row.matn || '';
  if (!text || typeof text !== 'string') return null;

  const table = row.table_name || row.source_table || row.table || defaultTable || null;
  const source =
    row.source || row.reference || row.citation || row.title ||
    (row.surah_name && row.ayah_number ? `سورة ${row.surah_name} - آية ${row.ayah_number}` : null) ||
    (row.source_table || 'مصدر غير محدد');

  return {
    id: row.id != null ? row.id : null,
    table,
    text: text.trim(),
    source: String(source),
    url: row.url || row.link || row.source_url || null,
    similarity: typeof row.similarity === 'number' ? row.similarity : null,
  };
}

async function searchKnowledge(embedding, queryText) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('search_knowledge', {
    query_embedding: embedding,
    query_text: queryText,
    match_count: MATCH_COUNT,
    tables: KNOWLEDGE_TABLES,
  });

  if (error) throw new Error(`search_knowledge failed: ${error.message}`);

  return (data || [])
    .map((r) => normalizeRow(r))
    .filter(Boolean)
    .filter((r) => r.similarity === null || r.similarity >= MIN_SIMILARITY)
    .slice(0, MATCH_COUNT);
}

async function searchDorarFallback(queryText) {
  try {
    const r = await fetchFromDorar('tafseer', queryText);
    if (!r || !r.text) return [];

    const item = normalizeRow({
      text: r.text,
      source: r.source || 'الدرر السنية',
      source_url: r.source_url || null,
      similarity: null,
    }, 'live_cache');

    return item ? [item] : [];
  } catch (err) {
    console.error('[sanad] dorar fallback failed:', err.message);
    return [];
  }
}

function buildContext(results) {
  return results
    .map((r, i) => {
      const label = r.table ? `[${r.table}] ` : '';
      return `[${i + 1}] ${label}${r.source}\n${r.text}`;
    })
    .join('\n\n---\n\n');
}

function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

const SYSTEM_PROMPT = `أنت "سند"، مساعد إسلامي في منصة "عائد". تجيب بالعربية الفصحى الواضحة وبأدب.

قواعد الأمان (Safety Layer):
- لا تُصدر فتاوى في مسائل الدماء والطلاق والتكفير والأمور القضائية؛ وجّه السائل إلى عالم أو دار إفتاء موثوقة.
- إن بدا من السؤال أن السائل في أزمة نفسية أو يفكر بإيذاء نفسه، فاستجب برحمة، وشجّعه على التواصل مع شخص موثوق أو جهة مختصة.
- ارفض أي طلب فيه تحريض على العنف أو الكراهية أو الإضرار بالآخرين.
- لا تتكلم بلسان الله أو رسوله، ولا تنسب لهما شيئاً لم يرد في المصادر.
- إن كان السؤال خارج نطاق الدين فاعتذر بلطف وبيّن اختصاصك.

قواعد الإجابة:
- اعتمد على "المصادر المرفقة" أولاً، وأشِر إليها بأرقامها مثل [1] و[2].
- لا تختلق آية أو حديثاً أو قولاً لعالم. إن لم تكفِ المصادر فقل ذلك صراحةً.
- عند ذكر آية أو حديث انقله كما ورد في المصادر دون تغيير.
- في مسائل الخلاف الفقهي اعرض الأقوال بإنصاف دون تعصب.
- اختم بما يناسب من تنبيه أن الجواب للتعلّم وليس فتوى شخصية.`;

// ═════════════════════════════════════════════════════════
// POST handler
// ═════════════════════════════════════════════════════════
export async function POST(request) {
  try {
    // 0) التحقق من متغيرات البيئة
    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
      console.error('[sanad] missing environment variables');
      return jsonResponse({ error: getMessage('server_not_ready', 'ar') }, 500);
    }

    // 1) استقبال السؤال + اللغة
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: getMessage('question_required', 'ar') }, 400);
    }

    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const lang = typeof body.lang === 'string' && body.lang.trim()
      ? body.lang.trim().toLowerCase().slice(0, 5)
      : 'ar';

    if (!question) {
      return jsonResponse({ error: getMessage('question_required', lang) }, 400);
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return jsonResponse({ error: getMessage('question_too_long', lang) }, 400);
    }

    const isArabic = lang === 'ar' || lang.startsWith('ar-');

    // 2) ترجمة السؤال للعربية (لو لغة أخرى)
    let searchQuery = question;
    if (!isArabic) {
      try {
        searchQuery = await geminiGenerate({
          systemInstruction: 'Translate the user question into clear Modern Standard Arabic. Output only the translation.',
          userText: question,
          temperature: 0,
          maxOutputTokens: 300,
        });
      } catch (err) {
        console.warn('[sanad] question translation failed:', err.message);
        searchQuery = question;
      }
    }

    // 3) RAG search
    let results = [];
    let usedFallback = false;
    try {
      const embedding = await embedQuery(searchQuery);
      results = await searchKnowledge(embedding, searchQuery);
      console.log(`[sanad] RAG found ${results.length} results`);
    } catch (err) {
      console.error('[sanad] RAG search failed:', err.message);
    }

    // 4) Fallback: Dorar
    if (results.length === 0) {
      results = await searchDorarFallback(searchQuery);
      usedFallback = results.length > 0;
      console.log(`[sanad] Dorar fallback: ${results.length} results`);
    }

    // 5) بناء الـ prompt
    const hasSources = results.length > 0;
    const userPrompt = hasSources
      ? `المصادر المرفقة:\n\n${buildContext(results)}\n\n=====\n\nسؤال المستخدم:\n${searchQuery}\n\nأجب اعتماداً على المصادر أعلاه، وأشِر إلى أرقامها.`
      : `لم يُعثر على مصادر مطابقة في قاعدة المعرفة.\n\nسؤال المستخدم:\n${searchQuery}\n\nإن كان السؤال عاماً يمكنك الإجابة بإيجاز عن المعلوم المتفق عليه فقط، وبيّن بوضوح أن الجواب بلا مصادر مرفقة.`;

    // 6) Gemini
    const answerAr = await geminiGenerate({
      systemInstruction: SYSTEM_PROMPT,
      userText: userPrompt,
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    // 7) ترجمة الجواب (لو لغة غير عربية)
    let answer = answerAr;
    let translated = false;
    if (!isArabic) {
      try {
        answer = await translateText(answerAr, lang);
        translated = true;
      } catch (err) {
        console.error('[sanad] answer translation failed:', err.message);
        answer = answerAr;
      }
    }

    // 8) إرجاع النتيجة
    return jsonResponse({
      answer,
      answer_ar: translated ? answerAr : undefined,
      lang: translated ? lang : 'ar',
      sources: results.map((r, i) => ({
        n: i + 1,
        table: r.table,
        source: r.source,
        url: r.url,
        similarity: r.similarity,
        excerpt: r.text.length > 240 ? r.text.slice(0, 240) + '…' : r.text,
      })),
      used_fallback: usedFallback,
    });
  } catch (err) {
    console.error('[sanad] unexpected error:', err);
    const lang = 'ar';
    return jsonResponse({ error: getMessage('error_generic', lang) }, 500);
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
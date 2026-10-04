/**
 * lib/dorar.js
 * ------------------------------------------------------------
 * سكرابينغ لحظي من dorar.net لمشروع "عائد" مع تخزين مؤقت في Supabase.
 *
 * الاعتمادات (Dependencies):
 *   npm i @supabase/supabase-js cheerio robots-parser
 *
 * متغيرات البيئة المطلوبة:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (يُستخدم على الخادم فقط — لا تضعه في كود المتصفح)
 *
 * مطلوب في Supabase (مرة واحدة) لضمان عمل upsert:
 *   create unique index if not exists live_cache_query_hash_key
 *     on live_cache (query_hash);
 *
 * يتطلب Node.js 18+ (يوفّر fetch مدمجاً).
 * ------------------------------------------------------------
 */

'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');

/* ============================================================
 * الإعدادات
 * ============================================================ */

const BASE_URL = 'https://dorar.net';
const USER_AGENT = 'AaidBot/1.0 (+https://aaid.example; Islamic AI assistant)'; // عدّل الرابط لموقعك
const REQUEST_DELAY_MS = 2000; // التأخير الإلزامي بين الطلبات (ثانيتان)
const REQUEST_TIMEOUT_MS = 15000; // مهلة الطلب الواحد
const ROBOTS_TTL_MS = 60 * 60 * 1000; // نحدّث robots.txt كل ساعة
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // صلاحية الكاش: 7 أيام
const MAX_TEXT_LENGTH = 6000; // أقصى طول للنص المُرجَع
const MAX_RETRIES = 1; // عدد إعادة المحاولة عند الفشل المؤقت

/**
 * مسار البحث لكل نوع.
 * ⚠️ تأكد من هذه المسارات ومحددات CSS أدناه مقابل HTML الفعلي للموقع،
 * فقد تتغير بنية dorar.net في أي وقت.
 */
const SOURCES = {
  tafseer: { path: '/tafseer/search?q=', name: 'الدرر السنية - التفسير' },
  hadith: { path: '/hadith/search?q=', name: 'الدرر السنية - الموسوعة الحديثية' },
  aqeeda: { path: '/aqeeda/search?q=', name: 'الدرر السنية - الموسوعة العقدية' },
  feqhia: { path: '/feqhia/search?q=', name: 'الدرر السنية - الموسوعة الفقهية' },
  history: { path: '/history/search?q=', name: 'الدرر السنية - الموسوعة التاريخية' },
};

/** محددات CSS لاستخراج النتائج (بالترتيب، أول محدد يعطي نتيجة يُعتمد) */
const CONTENT_SELECTORS = [
  '.hadith-info',
  '.search-results .result',
  '.search-result',
  '.card-body',
  'article',
  'main',
  '.content',
];

/* ============================================================
 * عميل Supabase (يُنشأ كسولاً عند أول استخدام)
 * ============================================================ */

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new DorarError(
      'CONFIG_ERROR',
      'متغيرات SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY غير مضبوطة'
    );
  }
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

/* ============================================================
 * خطأ مخصص لتسهيل التعامل مع الأخطاء في الطبقات العليا
 * ============================================================ */

class DorarError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'DorarError';
    this.code = code; // INVALID_INPUT | ROBOTS_BLOCKED | HTTP_ERROR | TIMEOUT | NO_RESULTS | CONFIG_ERROR | NETWORK_ERROR
    if (cause) this.cause = cause;
  }
}

/* ============================================================
 * أدوات مساعدة
 * ============================================================ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** تطبيع نص البحث: إزالة التشكيل والمسافات الزائدة */
function normalizeQuery(query) {
  return String(query)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // التشكيل والتطويل
    .replace(/\s+/g, ' ')
    .trim();
}

/** بصمة الاستعلام (النوع + النص المطبّع) */
function hashQuery(type, query) {
  return crypto
    .createHash('sha256')
    .update(`${type}:${normalizeQuery(query)}`)
    .digest('hex');
}

/** تنظيف النص المستخرج */
function cleanText(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/* ============================================================
 * محدِّد المعدّل: ثانيتان على الأقل بين أي طلبين إلى الموقع
 * (يعمل عبر سلسلة وعود حتى مع الطلبات المتزامنة)
 * ============================================================ */

let _queue = Promise.resolve();
let _lastRequestAt = 0;

function waitForTurn() {
  const turn = _queue.then(async () => {
    const elapsed = Date.now() - _lastRequestAt;
    if (elapsed < REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS - elapsed);
    _lastRequestAt = Date.now();
  });
  _queue = turn.catch(() => {});
  return turn;
}

/* ============================================================
 * robots.txt
 * ============================================================ */

let _robots = null;
let _robotsFetchedAt = 0;

/** جلب robots.txt وتخزينه مؤقتاً في الذاكرة */
async function loadRobots() {
  if (_robots && Date.now() - _robotsFetchedAt < ROBOTS_TTL_MS) return _robots;

  const robotsUrl = `${BASE_URL}/robots.txt`;
  let body = '';

  try {
    await waitForTurn(); // طلب robots.txt يخضع للتأخير أيضاً
    const res = await fetchWithTimeout(robotsUrl);
    if (res.ok) {
      body = await res.text();
    } else if (res.status >= 400 && res.status < 500) {
      body = ''; // لا يوجد robots.txt => كل شيء مسموح (حسب المعيار)
    } else {
      // خطأ خادم: نتحفظ ونمنع الطلب
      throw new DorarError('HTTP_ERROR', `تعذر جلب robots.txt (HTTP ${res.status})`);
    }
  } catch (err) {
    if (err instanceof DorarError) throw err;
    throw new DorarError('NETWORK_ERROR', 'تعذر جلب robots.txt', err);
  }

  _robots = robotsParser(robotsUrl, body);
  _robotsFetchedAt = Date.now();
  return _robots;
}

/** هل يُسمح لنا بجلب هذا الرابط؟ */
async function isAllowedByRobots(url) {
  const robots = await loadRobots();
  const allowed = robots.isAllowed(url, USER_AGENT);
  return allowed !== false; // undefined تعني غير مذكور => مسموح
}

/* ============================================================
 * طلب HTTP مع مهلة
 * ============================================================ */

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new DorarError('TIMEOUT', 'انتهت مهلة الطلب إلى dorar.net', err);
    }
    throw new DorarError('NETWORK_ERROR', 'فشل الاتصال بـ dorar.net', err);
  } finally {
    clearTimeout(timer);
  }
}

/** جلب صفحة HTML مع احترام التأخير وإعادة المحاولة عند الأخطاء المؤقتة */
async function fetchHtml(url) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await waitForTurn();
      const res = await fetchWithTimeout(url);

      if (res.ok) return await res.text();

      // 429 أو 5xx: خطأ مؤقت — نعيد المحاولة
      if (res.status === 429 || res.status >= 500) {
        lastError = new DorarError('HTTP_ERROR', `خطأ HTTP ${res.status} من dorar.net`);
        continue;
      }

      // أخطاء 4xx الأخرى: لا فائدة من الإعادة
      throw new DorarError('HTTP_ERROR', `خطأ HTTP ${res.status} من dorar.net`);
    } catch (err) {
      lastError = err;
      const retryable = err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR' || err.code === 'HTTP_ERROR';
      if (!retryable || attempt === MAX_RETRIES) break;
    }
  }

  throw lastError;
}

/* ============================================================
 * استخراج النص من HTML
 * ============================================================ */

function extractText(html) {
  const $ = cheerio.load(html);

  // إزالة العناصر غير المفيدة
  $('script, style, noscript, nav, header, footer, form, iframe, .ads, .advert').remove();

  for (const selector of CONTENT_SELECTORS) {
    const nodes = $(selector);
    if (nodes.length === 0) continue;

    const parts = [];
    nodes.each((_, el) => {
      const t = cleanText($(el).text());
      if (t.length > 20) parts.push(t);
    });

    if (parts.length > 0) {
      return cleanText(parts.join('\n\n')).slice(0, MAX_TEXT_LENGTH);
    }
  }

  return '';
}

/* ============================================================
 * الكاش (جدول live_cache)
 * ============================================================ */

/** قراءة نتيجة صالحة من الكاش، أو null */
async function readCache(queryHash) {
  try {
    const { data, error } = await getSupabase()
      .from('live_cache')
      .select('result, expires_at')
      .eq('query_hash', queryHash)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? data.result : null;
  } catch (err) {
    // فشل الكاش لا يجب أن يوقف الخدمة؛ نتابع بالسكرابينغ
    console.error('[dorar] تعذرت قراءة الكاش:', err.message || err);
    return null;
  }
}

/** كتابة النتيجة في الكاش (upsert على query_hash) */
async function writeCache(queryHash, type, query, result) {
  try {
    const now = new Date();
    const { error } = await getSupabase()
      .from('live_cache')
      .upsert(
        {
          query_hash: queryHash,
          query_text: `${type}:${normalizeQuery(query)}`,
          result,
          source_url: result.source_url,
          fetched_at: result.fetched_at,
          expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
        },
        { onConflict: 'query_hash' }
      );
    if (error) throw error;
  } catch (err) {
    // فشل التخزين لا يمنع إرجاع النتيجة للمستخدم
    console.error('[dorar] تعذرت كتابة الكاش:', err.message || err);
  }
}

/* ============================================================
 * الدالة الرئيسية
 * ============================================================ */

/**
 * جلب نتيجة من dorar.net (من الكاش إن وُجدت، وإلا سكرابينغ ثم تخزين).
 *
 * @param {'tafseer'|'hadith'|'aqeeda'|'feqhia'|'history'} type
 * @param {string} query نص البحث
 * @returns {Promise<{text: string, source: string, source_url: string, fetched_at: string}>}
 * @throws {DorarError}
 */
async function fetchFromDorar(type, query) {
  // 1) التحقق من المدخلات
  const source = SOURCES[type];
  if (!source) {
    throw new DorarError(
      'INVALID_INPUT',
      `النوع غير مدعوم: "${type}". الأنواع المتاحة: ${Object.keys(SOURCES).join(', ')}`
    );
  }
  if (typeof query !== 'string' || normalizeQuery(query).length < 2) {
    throw new DorarError('INVALID_INPUT', 'نص البحث فارغ أو قصير جداً');
  }

  // 2) التحقق من الكاش أولاً
  const queryHash = hashQuery(type, query);
  const cached = await readCache(queryHash);
  if (cached) return cached;

  // 3) بناء الرابط والتحقق من robots.txt
  const url = `${BASE_URL}${source.path}${encodeURIComponent(normalizeQuery(query))}`;

  if (!(await isAllowedByRobots(url))) {
    throw new DorarError('ROBOTS_BLOCKED', 'robots.txt لا يسمح بجلب هذه الصفحة');
  }

  // 4) جلب الصفحة واستخراج النص
  const html = await fetchHtml(url);
  const text = extractText(html);

  if (!text) {
    throw new DorarError('NO_RESULTS', 'لم يتم العثور على نتائج لهذا البحث');
  }

  // 5) تجهيز النتيجة وتخزينها
  const result = {
    text,
    source: source.name,
    source_url: url,
    fetched_at: new Date().toISOString(),
  };

  await writeCache(queryHash, type, query, result);
  return result;
}

module.exports = { fetchFromDorar, DorarError };
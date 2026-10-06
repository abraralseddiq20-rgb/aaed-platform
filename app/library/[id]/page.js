// app/library/[id]/page.js
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { getLibraryItem } from '@/lib/supabase-client';
import { LANGS } from '@/lib/library-data';

export default function LibraryItemPage() {
  const { id } = useParams();
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [translating, setTranslating] = useState(false);

  const isRTL = lang === 'ar' || lang === 'ur';

  useEffect(() => {
    setLoading(true);
    getLibraryItem(id)
      .then(setItem)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // تبديل اللغة
  async function switchLang(targetLang) {
    setLang(targetLang);
    if (targetLang === 'ar' || !item) {
      setTranslation(null);
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: item.content || item.description_ar || '',
          from: 'ar',
          to: targetLang,
        }),
      });
      const data = await res.json();
      setTranslation(data.translation);
    } catch (e) {
      console.error(e);
      setTranslation(null);
    } finally {
      setTranslating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500" dir={isRTL ? 'rtl' : 'ltr'}>
        {t.library?.loading || 'Loading...'}
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <p className="text-red-500 mb-4">{t.library?.error || 'Item not found'}</p>
        <Link href="/library" className="text-emerald-600 hover:underline">
          ← {t.library?.back || 'Back to library'}
        </Link>
      </div>
    );
  }

  const displayTitle = translation
    ? translation.split('\n')[0]?.slice(0, 100)
    : (lang === 'ar' ? item.title_ar : (item.title_en || item.title_ar));
  const displayDesc = lang === 'ar' ? item.description_ar : (item.description_en || item.description_ar);
  const hasContent = item.content && item.content.trim().length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* شريط اللغات */}
      <div className="flex justify-end gap-1 mb-4">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => switchLang(l.code)}
            disabled={translating}
            className={`px-3 py-1 rounded-full text-xs font-bold transition
              ${lang === l.code
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
              ${translating ? 'opacity-50 cursor-wait' : ''}
            `}
          >
            {l.code.toUpperCase()}
          </button>
        ))}
      </div>

      {/* زر الرجوع */}
      <Link
        href="/library"
        className="inline-block text-sm text-emerald-600 hover:underline mb-4"
      >
        ← {t.library?.back || 'Back'}
      </Link>

      {/* Header */}
      <header className="mb-6 pb-6 border-b">
        <h1 className="text-2xl font-bold mb-3">{item.title_ar}</h1>
        <p className="text-gray-600 mb-3">{displayDesc}</p>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>📚 {t.library?.source || 'Source'}: {item.source}</span>
          <span>⏱ {item.reading_minutes} {t.library?.minutes || 'min'}</span>
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline"
            >
              ↗ {t.library?.original_link || 'Original link'}
            </a>
          )}
        </div>

        {item.status === 'draft' && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
            ⚠️ {t.library?.draft_notice || 'Draft under review'}
          </div>
        )}
      </header>

      {/* المحتوى */}
      <article className="prose max-w-none">
        {translating ? (
          <div className="text-center py-12 text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mb-3"></div>
            <p className="text-sm">{t.library?.loading || 'Translating...'}</p>
          </div>
        ) : !hasContent ? (
          <div className="bg-gray-50 border rounded-lg p-8 text-center text-gray-500">
            <p className="mb-3 text-lg">📄</p>
            <p className="font-bold mb-2">{t.library?.coming_soon || 'Content coming soon'}</p>
            <p className="text-sm mb-4">
              {t.library?.content_coming_soon || 'المحتوى الكامل هيُضاف قريبًا. يمكنك قراءته الآن من المصدر الأصلي:'}
            </p>
            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
              >
                ↗ {t.library?.read_more || 'Read more at'} {item.source}
              </a>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap leading-relaxed text-gray-800">
            {translation || item.content}
          </div>
        )}
      </article>

      {/* زر اسأل سند */}
      <div className="mt-8 pt-6 border-t">
        <Link
          href={`/sanad?q=${encodeURIComponent(item.title_ar)}`}
          className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition font-bold"
        >
          💬 {t.library?.ask_sanad || 'اسأل سند'}
        </Link>
      </div>

      {/* الشفافية */}
      <footer className="mt-8 pt-6 border-t text-xs text-gray-500">
        {t.library?.notice || 'هذا النظام مدعوم بالذكاء الاصطناعي ولا يغني عن المختص'}
      </footer>
    </div>
  );
}
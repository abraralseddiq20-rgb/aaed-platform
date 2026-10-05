// app/library/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { getLibraryContent, searchLibrary } from '@/lib/supabase-client';
import { LEVELS, CATEGORIES, CONTENT_TYPES, LANGS } from '@/lib/library-data';

export default function LibraryPage() {
  const { lang, setLang, t } = useLanguage();
  const [activeLevel, setActiveLevel] = useState('seeker');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('lesson');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const isRTL = lang === 'ar' || lang === 'ur';
  const COMING_SOON_LEVELS = ['learner', 'scholar'];

  // Debounce للبحث
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setIsSearching(false);
      return;
    }
    if (searchQuery.trim().length < 2) {
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchLibrary(searchQuery)
        .then(setItems)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // الفلترة العادية
  useEffect(() => {
    if (isSearching || searchQuery.trim().length > 0) return;
    setLoading(true);
    setError(null);
    getLibraryContent({
      level: activeLevel,
      category: activeCategory,
      content_type: activeType,
    })
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeLevel, activeCategory, activeType, isSearching, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* شريط اللغات */}
      <div className="flex justify-end gap-1 mb-4">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition
              ${lang === l.code
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
            `}
          >
            {l.code.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t.library?.title || 'Library'}
        </h1>
        <p className="text-gray-600">{t.library?.subtitle || ''}</p>
      </header>

      {/* شفافية */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-900">
        {t.library?.notice || ''}
      </div>

      {/* البحث */}
      <section className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.library?.search_placeholder || 'Search library...'}
            className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-emerald-600 focus:outline-none text-sm"
          />
          <span className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400 text-lg pointer-events-none">
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 -translate-y-1/2 left-4 text-gray-400 hover:text-gray-700 text-lg"
            >
              ✕
            </button>
          )}
        </div>
        {isSearching && (
          <p className="text-xs text-emerald-700 mt-2">
            {t.library?.search_results || 'Search results'}
          </p>
        )}
      </section>

      {/* المستويات — تختفي أثناء البحث */}
      {!isSearching && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {LEVELS.map((level) => {
            const isComingSoon = COMING_SOON_LEVELS.includes(level.id);
            return (
              <button
                key={level.id}
                onClick={() => setActiveLevel(level.id)}
                className={`p-3 rounded-xl border-2 text-right transition
                  ${activeLevel === level.id ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'}
                  hover:border-emerald-400
                `}
              >
                <div className="font-bold">
                  {t.library?.levels?.[level.id] || level.id}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t.library?.levels_desc?.[level.id] || ''}
                </div>
                {isComingSoon && (
                  <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    {t.library?.coming_soon || 'Coming soon'}
                  </span>
                )}
              </button>
            );
          })}
        </section>
      )}

      {/* نوع المحتوى — يختفي أثناء البحث */}
      {!isSearching && (
        <section className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.id}
              onClick={() => setActiveType(ct.id)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition
                ${activeType === ct.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}
              `}
            >
              {t.library?.content_types?.[ct.id] || ct.id}
            </button>
          ))}
        </section>
      )}

      {/* التصنيفات — تختفي أثناء البحث */}
      {!isSearching && (
        <section className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition
              ${activeCategory === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}
            `}
          >
            {t.library?.categories?.all || 'All'}
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition
                ${activeCategory === cat.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}
              `}
            >
              {t.library?.categories?.[cat.id] || cat.id}
            </button>
          ))}
        </section>
      )}

      {/* العناصر */}
      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            {t.library?.loading || 'Loading...'}
          </div>
        ) : error ? (
          <div className="col-span-full text-center py-12 text-red-500">
            {t.library?.error || 'Error'}: {error}
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            {isSearching
              ? (t.library?.search_no_results || 'No results')
              : (t.library?.empty || 'No content')}
          </div>
        ) : (
          items.map((item) => {
            const isComingSoon = !item.is_available;
            const CardWrapper = isComingSoon ? 'div' : Link;
            const wrapperProps = isComingSoon
              ? { className: 'block p-4 border-2 border-dashed rounded-xl bg-gray-50 opacity-70 cursor-not-allowed' }
              : { href: `/library/${item.id}`, className: 'block p-4 border rounded-xl hover:shadow-md transition bg-white' };

            return (
              <CardWrapper key={item.id} {...wrapperProps}>
                <h3 className="font-bold mb-2 line-clamp-2">
                  {lang === 'ar' ? item.title_ar : (item.title_en || item.title_ar)}
                </h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {lang === 'ar' ? item.description_ar : (item.description_en || item.description_ar)}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>📚 {item.source}</span>
                  <span>⏱ {item.reading_minutes} {t.library?.minutes || 'min'}</span>
                </div>
                {isComingSoon && (
                  <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    {t.library?.coming_soon || 'Coming soon'}
                  </span>
                )}
              </CardWrapper>
            );
          })
        )}
      </section>
    </div>
  );
}
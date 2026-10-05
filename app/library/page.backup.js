// app/library/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getLibraryContent } from '@/lib/supabase-client';
import { LEVELS, CATEGORIES, CONTENT_TYPES } from '@/lib/library-data';

export default function LibraryPage() {
  const [activeLevel, setActiveLevel] = useState('seeker');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('lesson');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
  }, [activeLevel, activeCategory, activeType]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" dir="rtl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">المكتبة</h1>
        <p className="text-gray-600">
          محتوى موثّق من مصادر معتمدة
        </p>
      </header>

      {/* شفافية */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-900">
        هذا النظام مدعوم بالذكاء الاصطناعي ولا يغني عن المختص.
      </div>

      {/* المستويات */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            disabled={!level.is_available}
            onClick={() => level.is_available && setActiveLevel(level.id)}
            className={`p-3 rounded-xl border-2 text-right transition
              ${activeLevel === level.id ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'}
              ${!level.is_available ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-400'}
            `}
          >
            <div className="font-bold">{level.name_ar}</div>
            <div className="text-xs text-gray-500 mt-1">
              {level.description_ar}
            </div>
            {!level.is_available && (
              <span className="inline-block mt-2 text-xs bg-gray-200 px-2 py-0.5 rounded">
                قريبًا
              </span>
            )}
          </button>
        ))}
      </section>

      {/* نوع المحتوى */}
      <section className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {CONTENT_TYPES.map((t) => (
          <button
            key={t.id}
            disabled={!t.is_available}
            onClick={() => t.is_available && setActiveType(t.id)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition
              ${activeType === t.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}
              ${!t.is_available ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {t.name_ar}
            {!t.is_available && ' 🔒'}
          </button>
        ))}
      </section>

      {/* التصنيفات */}
      <section className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition
            ${activeCategory === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}
          `}
        >
          الكل
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition
              ${activeCategory === cat.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}
            `}
          >
            {cat.name_ar}
          </button>
        ))}
      </section>

      {/* العناصر */}
      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : error ? (
          <div className="col-span-full text-center py-12 text-red-500">
            حدث خطأ: {error}
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            لا يوجد محتوى في هذا التصنيف بعد
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/library/${item.id}`}
              className="block p-4 border rounded-xl hover:shadow-md transition bg-white"
            >
              <h3 className="font-bold mb-2 line-clamp-2">
                {item.title_ar}
              </h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {item.description_ar}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>📚 {item.source}</span>
                <span>⏱ {item.reading_minutes} د</span>
              </div>
              {item.status === 'draft' && (
                <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                  مسودة قيد المراجعة
                </span>
              )}
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
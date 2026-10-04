// app/guide/page.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { getGuides } from '@/lib/supabase-client';

export default function GuidePage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);

  const isRTL = lang === 'ar' || lang === 'ur';

  useEffect(() => {
    async function load() {
      try {
        const filters = {};
        if (specialtyFilter !== 'all') filters.specialty = specialtyFilter;
        const data = await getGuides(filters);
        console.log('[guide-list] Loaded:', data);
        setMentors(data || []);
      } catch (err) {
        console.error('[guide-list] Error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [specialtyFilter]);

  const getLanguageLabel = (code) => {
    const labels = {
      ar: { ar: 'العربية', en: 'Arabic', fr: 'Arabe', ur: 'عربی', id: 'Arab' },
      en: { ar: 'الإنجليزية', en: 'English', fr: 'Anglais', ur: 'انگریزی', id: 'Inggris' },
      fr: { ar: 'الفرنسية', en: 'French', fr: 'Français', ur: 'فرانسیسی', id: 'Prancis' },
      ur: { ar: 'الأردية', en: 'Urdu', fr: 'Ourdou', ur: 'اردو', id: 'Urdu' },
      id: { ar: 'الإندونيسية', en: 'Indonesian', fr: 'Indonésien', ur: 'انڈونیشیائی', id: 'Indonesia' },
    };
    return labels[code]?.[lang] || code;
  };

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <Link href="/" className="text-2xl">→</Link>
        <div className="text-xl font-bold">
          {t.guide.title} <span className="text-amber-400">| Guide</span>
        </div>
        <div className="flex gap-1">
          {['ar', 'en', 'fr', 'ur', 'id'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded text-xs font-bold transition ${
                lang === l ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-white/80 text-center mb-6 text-sm">{t.guide.subtitle}</p>

        <div className="max-w-2xl mx-auto mb-6">
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="w-full p-3 rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:border-amber-400"
          >
            <option value="all" className="text-slate-800">{t.guide.specialties.all}</option>
            <option value="family" className="text-slate-800">{t.guide.specialties.family}</option>
            <option value="psychology" className="text-slate-800">{t.guide.specialties.psychology}</option>
            <option value="fiqh" className="text-slate-800">{t.guide.specialties.fiqh}</option>
            <option value="seerah" className="text-slate-800">{t.guide.specialties.seerah}</option>
          </select>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl p-6 text-center text-slate-500">
              {t.guide.loading}
            </div>
          ) : mentors.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-slate-600">
              {t.guide.no_results}
            </div>
          ) : (
            mentors.map((mentor) => (
              <div key={mentor.id} className="bg-white rounded-2xl p-5 shadow-lg">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {mentor.avatar_initial || mentor.name?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-slate-800">{mentor.name}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                      {mentor.country && <span>📍 {mentor.country}</span>}
                      <span>⭐ {mentor.rating || 5}/5</span>
                      <span>💬 {mentor.sessions_count || 0} {t.guide.sessions}</span>
                    </div>
                  </div>
                </div>

                {mentor.bio && (
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">{mentor.bio}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {(mentor.languages || []).map((code, i) => (
                    <span key={i} className="bg-slate-100 text-teal-700 px-3 py-1 rounded-full text-xs font-medium">
                      {getLanguageLabel(code)}
                    </span>
                  ))}
                  {mentor.specialty && (
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                      {t.guide.specialties[mentor.specialty] || mentor.specialty}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    console.log('[guide-list] Selected:', mentor.id);
                    setSelectedMentor(mentor);
                  }}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition"
                >
                  {t.guide.start_chat}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="max-w-2xl mx-auto mt-6 bg-white/10 backdrop-blur rounded-2xl p-5 text-white text-sm">
          <div className="font-bold mb-2">💡 {t.guide.how_it_works}</div>
          <ul className="list-disc pr-5 space-y-1 opacity-90">
            {(t.guide.points || []).map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      </div>

      {selectedMentor && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMentor(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-teal-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                {selectedMentor.avatar_initial || selectedMentor.name?.[0] || '?'}
              </div>
              <div className="font-bold text-xl text-slate-800 mb-1">{selectedMentor.name}</div>
              <div className="text-sm text-slate-500">
                {selectedMentor.country} · ⭐ {selectedMentor.rating || 5}/5
              </div>
              <div className="text-xs text-slate-400 mt-2 font-mono">
                ID: {selectedMentor.id}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-5 text-center">
              <div className="text-sm text-slate-500 mb-2">{t.guide.modal.will_contact}</div>
              <div className="font-bold text-teal-700">{t.guide.modal.soon}</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedMentor(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-3 rounded-xl font-bold transition"
              >
                {t.guide.modal.cancel}
              </button>
              <button
                onClick={() => {
                  const url = `/guide/${selectedMentor.id}`;
                  console.log('[guide-list] Navigate to:', url);
                  router.push(url);
                }}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition"
              >
                {t.guide.modal.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
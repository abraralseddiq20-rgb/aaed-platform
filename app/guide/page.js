// app/guide/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';

export default function GuidePage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState('all');

  const mentors = [
    {
      id: 1,
      name: { ar: 'أحمد محمود', en: 'Ahmed Mahmoud', fr: 'Ahmed Mahmoud', ur: 'احمد محمود', id: 'Ahmed Mahmoud' },
      avatar: 'أ',
      country: { ar: 'السودان', en: 'Sudan', fr: 'Soudan', ur: 'سوڈان', id: 'Sudan' },
      rating: 4.9,
      languages: ['ar', 'en'],
      specialty: 'family',
      sessions: 25,
      bio: {
        ar: 'متخصص في الأسئلة الأسرية والاجتماعية للمسلمين الجدد.',
        en: 'Specialized in family and social questions for new Muslims.',
        fr: 'Spécialisé dans les questions familiales et sociales.',
        ur: 'نئے مسلمانوں کے خاندانی اور سماجی سوالات میں ماہر۔',
        id: 'Spesialis dalam pertanyaan keluarga dan sosial untuk mualaf.'
      },
    },
    {
      id: 2,
      name: { ar: 'فاطمة علي', en: 'Fatima Ali', fr: 'Fatima Ali', ur: 'فاطمہ علی', id: 'Fatima Ali' },
      avatar: 'ف',
      country: { ar: 'مصر', en: 'Egypt', fr: 'Égypte', ur: 'مصر', id: 'Mesir' },
      rating: 4.8,
      languages: ['ar'],
      specialty: 'psychology',
      sessions: 18,
      bio: {
        ar: 'مرشدة نفسية متخصصة في دعم المسلمين الجدد والراجعين.',
        en: 'Psychological counselor specialized in supporting new Muslims.',
        fr: 'Conseillère psychologique spécialisée dans le soutien aux nouveaux musulmans.',
        ur: 'نئے مسلمانوں کی مدد میں ماہر نفسیاتی مشیر۔',
        id: 'Konselor psikologis yang berspesialisasi dalam mendukung mualaf.'
      },
    },
    {
      id: 3,
      name: { ar: 'محمد الحسن', en: 'Mohammed Al-Hassan', fr: 'Mohammed Al-Hassan', ur: 'محمد الحسن', id: 'Mohammed Al-Hassan' },
      avatar: 'م',
      country: { ar: 'السعودية', en: 'Saudi Arabia', fr: 'Arabie Saoudite', ur: 'سعودی عرب', id: 'Arab Saudi' },
      rating: 5.0,
      languages: ['ar', 'en', 'ur'],
      specialty: 'fiqh',
      sessions: 42,
      bio: {
        ar: 'طالب علم متخصص في الفقه والعقيدة. يجيب من المصادر المعتمدة.',
        en: 'Student of knowledge specialized in Fiqh and Aqeedah.',
        fr: 'Étudiant en sciences islamiques spécialisé en Fiqh et Aqeedah.',
        ur: 'فقہ اور عقیدہ میں ماہر طالب علم۔',
        id: 'Pelajar ilmu yang berspesialisasi dalam Fiqh dan Aqeedah.'
      },
    },
  ];

  const isRTL = lang === 'ar' || lang === 'ur';

  const filteredMentors = specialtyFilter === 'all'
    ? mentors
    : mentors.filter((m) => m.specialty === specialtyFilter);

  const getSpecialtyLabel = (key) => {
    return t.guide.specialties[key] || key;
  };

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
        <p className="text-white/80 text-center mb-6 text-sm">
          {t.guide.subtitle}
        </p>

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
          {filteredMentors.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-slate-600">
              {t.guide.no_results}
            </div>
          ) : (
            filteredMentors.map((mentor) => (
              <div key={mentor.id} className="bg-white rounded-2xl p-5 shadow-lg">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {mentor.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-slate-800">
                      {mentor.name[lang] || mentor.name.ar}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                      <span>📍 {mentor.country[lang] || mentor.country.ar}</span>
                      <span>⭐ {mentor.rating}/5</span>
                      <span>💬 {mentor.sessions} {t.guide.sessions}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                  {mentor.bio[lang] || mentor.bio.ar}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {mentor.languages.map((code, i) => (
                    <span key={i} className="bg-slate-100 text-teal-700 px-3 py-1 rounded-full text-xs font-medium">
                      {getLanguageLabel(code)}
                    </span>
                  ))}
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                    {getSpecialtyLabel(mentor.specialty)}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedMentor(mentor)}
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
            {t.guide.points.map((point, i) => (
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
                {selectedMentor.avatar}
              </div>
              <div className="font-bold text-xl text-slate-800 mb-1">
                {selectedMentor.name[lang] || selectedMentor.name.ar}
              </div>
              <div className="text-sm text-slate-500">
                {selectedMentor.country[lang] || selectedMentor.country.ar} · ⭐ {selectedMentor.rating}/5
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
                onClick={() => router.push(`/guide/${selectedMentor.id}`)}
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
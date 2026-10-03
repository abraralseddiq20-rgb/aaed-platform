'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GuidePage() {
  const router = useRouter();
  const [selectedMentor, setSelectedMentor] = useState(null);

  const mentors = [
    {
      id: 1,
      name: 'أحمد محمود',
      avatar: 'أ',
      country: 'السودان',
      rating: 4.9,
      languages: ['العربية', 'الإنجليزية'],
      specialty: 'الأسئلة الأسرية',
      sessions: 25,
      bio: 'متخصص في الإجابة عن الأسئلة الأسرية والاجتماعية للمسلمين الجدد.',
    },
    {
      id: 2,
      name: 'فاطمة علي',
      avatar: 'ف',
      country: 'مصر',
      rating: 4.8,
      languages: ['العربية'],
      specialty: 'الدعم النفسي',
      sessions: 18,
      bio: 'مرشدة نفسية متخصصة في دعم المسلمين الجدد والراجعين.',
    },
    {
      id: 3,
      name: 'محمد الحسن',
      avatar: 'م',
      country: 'السعودية',
      rating: 5.0,
      languages: ['العربية', 'الإنجليزية', 'الأردية'],
      specialty: 'الفقه والعقيدة',
      sessions: 42,
      bio: 'طالب علم متخصص في الفقه والعقيدة. يجيب من المصادر المعتمدة.',
    },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <a href="/" className="text-2xl">→</a>
        <div className="text-xl font-bold">
          المرشد <span className="text-amber-400">| Guide</span>
        </div>
        <div className="text-2xl">🔍</div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-white/80 text-center mb-6 text-sm">
          اختر مرشدك المفضل — سيتواصل معك في أقرب وقت
        </p>

        <div className="max-w-2xl mx-auto space-y-4">
          {mentors.map((mentor) => (
            <div 
              key={mentor.id}
              className="bg-white rounded-2xl p-5 shadow-lg"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {mentor.avatar}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-lg text-slate-800">
                    {mentor.name}
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                    <span>📍 {mentor.country}</span>
                    <span>⭐ {mentor.rating}/5</span>
                    <span>💬 {mentor.sessions} جلسة</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                {mentor.bio}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {mentor.languages.map((lang, i) => (
                  <span 
                    key={i}
                    className="bg-slate-100 text-teal-700 px-3 py-1 rounded-full text-xs font-medium"
                  >
                    {lang}
                  </span>
                ))}
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                  {mentor.specialty}
                </span>
              </div>

              <button 
                onClick={() => setSelectedMentor(mentor)}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition"
              >
                ابدأ المحادثة
              </button>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto mt-6 bg-white/10 backdrop-blur rounded-2xl p-5 text-white text-sm">
          <div className="font-bold mb-2">💡 كيف يعمل المرشد؟</div>
          <ul className="list-disc pr-5 space-y-1 opacity-90">
            <li>تحجز جلسة مع المرشد المناسب</li>
            <li>يتواصل معك في أقرب وقت</li>
            <li>المحادثة سرية تماماً</li>
            <li>المرشدون متطوعون مدرّبون</li>
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
                {selectedMentor.name}
              </div>
              <div className="text-sm text-slate-500">
                {selectedMentor.country} · ⭐ {selectedMentor.rating}/5
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-5 text-center">
              <div className="text-sm text-slate-500 mb-2">سيتواصل معك</div>
              <div className="font-bold text-teal-700">في أقرب وقت</div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedMentor(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-3 rounded-xl font-bold transition"
              >
                إلغاء
              </button>
              <button 
                onClick={() => router.push(`/guide/${selectedMentor.id}`)}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition"
              >
                تأكيد الحجز
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
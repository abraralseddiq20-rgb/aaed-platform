// app/page.js
'use client';

import { useLanguage } from './layout';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';

export default function Home() {
  const { lang, setLang, t } = useLanguage();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // جلب المستخدم الحالي
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    // الاستماع لتغييرات المصادقة
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const isRTL = lang === 'ar' || lang === 'ur';

  return (
    <main
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6"
    >
      <div className="text-center text-white max-w-3xl w-full">
        
        {/* الشريط العلوي: اللغات + Auth */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
          <div className="flex gap-2">
            {['ar', 'en', 'fr', 'ur', 'id'].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  lang === l
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm font-bold transition"
                >
                  {t.home.profile}
                </Link>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  className="bg-red-500/80 hover:bg-red-500 px-4 py-2 rounded-full text-sm font-bold transition"
                >
                  {t.home.logout}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm font-bold transition"
                >
                  {t.home.login}
                </Link>
                <Link
                  href="/signup"
                  className="bg-amber-400 hover:bg-amber-500 text-slate-900 px-4 py-2 rounded-full text-sm font-bold transition"
                >
                  {t.home.signup}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* العنوان الرئيسي */}
        <h1 className="text-5xl md:text-6xl font-bold mb-4">
          {t.home.title} <span className="text-amber-400">|</span>{' '}
          <span className="text-amber-400">Aaed</span>
        </h1>

        <p className="text-2xl md:text-3xl opacity-95 tracking-wide mb-8">
          {t.home.slogan}
        </p>

        <p className="text-base md:text-lg mb-10 opacity-80 max-w-xl mx-auto">
          {t.home.description}
        </p>

        {/* البوابات الأربع */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          
          <Link
            href="/sanad"
            className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition block text-center"
          >
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="12" rx="2"/>
                <path d="M9 8V5a3 3 0 0 1 6 0v3"/>
                <circle cx="9" cy="14" r="1" fill="white"/>
                <circle cx="15" cy="14" r="1" fill="white"/>
              </svg>
            </div>
            <div className="font-bold text-sm">{t.home.sanad}</div>
          </Link>

          <Link
            href="/guide"
            className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition block text-center"
          >
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
              </svg>
            </div>
            <div className="font-bold text-sm">{t.home.guide}</div>
          </Link>

          <Link
            href="/community"
            className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition block text-center"
          >
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3"/>
                <circle cx="17" cy="9" r="2.5"/>
                <path d="M3 20c0-3 3-5 6-5s6 2 6 5"/>
                <path d="M15 20c0-2 1.5-3.5 4-3.5"/>
              </svg>
            </div>
            <div className="font-bold text-sm">{t.home.community}</div>
          </Link>

          <Link
            href="/library"
            className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition block text-center"
          >
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4"/>
                <path d="M4 4v18"/>
                <path d="M8 8h8"/>
                <path d="M8 12h8"/>
                <path d="M8 16h5"/>
              </svg>
            </div>
            <div className="font-bold text-sm">{t.home.library}</div>
          </Link>

        </div>

      </div>
    </main>
  );
}
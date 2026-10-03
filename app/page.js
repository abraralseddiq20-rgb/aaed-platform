'use client';
import { useState, useEffect } from 'react';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import ur from '@/locales/ur.json';
import id from '@/locales/id.json';

const translations = { ar, en, fr, ur, id };

export default function Home() {
  const [lang, setLang] = useState('ar');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem('aaed-lang');
    if (savedLang) setLang(savedLang);
  }, []);

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('aaed-lang', newLang);
  };

  const t = translations[lang].home;
  const isRTL = lang === 'ar' || lang === 'ur';

  if (!mounted) return null;

  return (
    <main 
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6"
    >
      <div className="text-center text-white max-w-3xl w-full">
        
        <div className="flex justify-center gap-2 mb-8">
          {['ar', 'en', 'fr', 'ur', 'id'].map((l) => (
            <button
              key={l}
              onClick={() => changeLang(l)}
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

        <h1 className="text-5xl md:text-6xl font-bold mb-4">
          {t.title} <span className="text-amber-400">|</span> <span className="text-amber-400">Aaed</span>
        </h1>

        <p className="text-2xl md:text-3xl opacity-95 tracking-wide mb-8">
          {t.slogan}
        </p>

        <p className="text-base md:text-lg mb-10 opacity-80 max-w-xl mx-auto">
          {t.description}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          
          <a 
            href="/sanad" 
            className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition block text-center cursor-pointer"
          >
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="12" rx="2"/>
                <path d="M9 8V5a3 3 0 0 1 6 0v3"/>
                <circle cx="9" cy="14" r="1" fill="white"/>
                <circle cx="15" cy="14" r="1" fill="white"/>
              </svg>
            </div>
            <div className="font-bold text-sm">{t.sanad}</div>
          </a>

          <a 
            href="/guide"
            className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition block text-center cursor-pointer"
          >
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
              </svg>
            </div>
            <div className="font-bold text-sm">{t.guide}</div>
          </a>

          <div 
            className="bg-white/10 backdrop-blur p-4 rounded-xl opacity-60 cursor-not-allowed text-center"
            title="قريباً"
          >
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3"/>
                <circle cx="17" cy="9" r="2.5"/>
                <path d="M3 20c0-3 3-5 6-5s6 2 6 5"/>
                <path d="M15 20c0-2 1.5-3.5 4-3.5"/>
              </svg>
            </div>
            <div className="font-bold text-sm">{t.community}</div>
          </div>

          <div 
            className="bg-white/10 backdrop-blur p-4 rounded-xl opacity-60 cursor-not-allowed text-center"
            title="قريباً"
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
            <div className="font-bold text-sm">{t.library}</div>
          </div>

        </div>

      </div>
    </main>
  );
}
// app/layout.js
'use client';

import { Tajawal } from 'next/font/google';
import { createContext, useContext, useState, useEffect } from 'react';
import './globals.css';

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-tajawal',
});

// ─── Language Context ─────────────────────────────────────
const LanguageContext = createContext({
  lang: 'ar',
  setLang: () => {},
  t: {},
});

export function useLanguage() {
  return useContext(LanguageContext);
}

// ─── ترجمة عامة ───────────────────────────────────────────
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import ur from '@/locales/ur.json';
import id from '@/locales/id.json';

const translations = { ar, en, fr, ur, id };

export default function RootLayout({ children }) {
  const [lang, setLangState] = useState('ar');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('aaed-lang');
    if (saved && translations[saved]) {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang) => {
    if (!translations[newLang]) return;
    setLangState(newLang);
    localStorage.setItem('aaed-lang', newLang);
  };

  const t = translations[lang] || translations.ar;
  const isRTL = lang === 'ar' || lang === 'ur';

  return (
    <html lang={lang} dir={isRTL ? 'rtl' : 'ltr'} className={tajawal.variable}>
      <body className={tajawal.className}>
        <LanguageContext.Provider value={{ lang, setLang, t }}>
          {mounted ? children : null}
        </LanguageContext.Provider>
      </body>
    </html>
  );
}
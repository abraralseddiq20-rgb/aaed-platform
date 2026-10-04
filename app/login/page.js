// app/login/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/supabase-client';
import { useLanguage } from '@/app/layout';

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRTL = lang === 'ar' || lang === 'ur';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8">
          <Link href="/" className="text-white text-3xl font-bold inline-block mb-2">
            {t.home.title} <span className="text-amber-400">| Aaed</span>
          </Link>
          <p className="text-white/80 text-sm">{t.auth.login_subtitle}</p>
        </div>

        <div className="flex justify-center gap-2 mb-4">
          {['ar', 'en', 'fr', 'ur', 'id'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-full text-xs font-bold transition ${
                lang === l ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl">
          <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">
            {t.auth.login_title}
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t.auth.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t.auth.email_placeholder}
              className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800"
              dir="ltr"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t.auth.password}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800"
              dir="ltr"
            />
            <div className="text-right mt-2">
              <Link href="/forgot-password" className="text-xs text-teal-600 hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
          >
            {loading ? t.auth.login_loading : t.auth.login_button}
          </button>

          <div className="text-center mt-4">
            <span className="text-sm text-slate-600">{t.auth.no_account} </span>
            <Link href="/signup" className="text-teal-600 hover:underline font-medium text-sm">
              {t.auth.create_account}
            </Link>
          </div>

          <div className="text-center mt-4 pt-4 border-t border-slate-200">
            <Link href="/" className="text-slate-500 hover:text-slate-700 text-sm">
              {t.auth.back_home}
            </Link>
          </div>
        </form>

      </div>
    </main>
  );
}
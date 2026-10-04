// app/forgot-password/page.js
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { useLanguage } from '@/app/layout';

export default function ForgotPasswordPage() {
  const { lang, setLang, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const isRTL = lang === 'ar' || lang === 'ur';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'فشل إرسال الرابط');
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

        {!sent ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl">
            <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">
              استعادة كلمة المرور
            </h1>
            <p className="text-sm text-slate-500 text-center mb-6">
              أدخل بريدك الإلكتروني وسنرسل لك رابط لإعادة التعيين
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="mb-6">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
            >
              {loading ? '...' : 'إرسال رابط الاستعادة'}
            </button>

            <div className="text-center mt-4">
              <Link href="/login" className="text-teal-600 hover:underline text-sm">
                ← الرجوع لتسجيل الدخول
              </Link>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center">
            <div className="text-5xl mb-4">✉️</div>
            <h1 className="text-xl font-bold text-slate-800 mb-3">
              تم إرسال الرابط!
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              تفقد بريدك الإلكتروني <strong>{email}</strong> — ستجد رسالة فيها رابط لإعادة تعيين كلمة المرور.
            </p>
            <p className="text-xs text-slate-400 mb-4">
              لم تجد الرسالة؟ تفقد مجلد "الرسائل غير المرغوب فيها" (Spam).
            </p>
            <Link href="/login" className="text-teal-600 hover:underline font-medium text-sm">
              ← الرجوع لتسجيل الدخول
            </Link>
          </div>
        )}

      </div>
    </main>
  );
}
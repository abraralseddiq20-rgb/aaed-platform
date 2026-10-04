// app/reset-password/page.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { useLanguage } from '@/app/layout';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const isRTL = lang === 'ar' || lang === 'ur';

  useEffect(() => {
    // Supabase يعالج التوكن تلقائياً من الرابط
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // لا جلسة — الرابط منتهي أو غلط
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'فشل تحديث كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">تم تحديث كلمة المرور!</h1>
          <p className="text-slate-600 mb-4">سيتم تحويلك لصفحة الدخول...</p>
          <Link href="/login" className="text-teal-600 hover:underline font-medium">
            تسجيل الدخول الآن ←
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8">
          <Link href="/" className="text-white text-3xl font-bold inline-block mb-2">
            {t.home.title} <span className="text-amber-400">| Aaed</span>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl">
          <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">
            كلمة مرور جديدة
          </h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            أدخل كلمة المرور الجديدة
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="6 أحرف على الأقل"
              className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800"
              dir="ltr"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              تأكيد كلمة المرور
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              placeholder="أعد كتابتها"
              className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
          >
            {loading ? '...' : 'تحديث كلمة المرور'}
          </button>

          <div className="text-center mt-4">
            <Link href="/login" className="text-teal-600 hover:underline text-sm">
              ← الرجوع لتسجيل الدخول
            </Link>
          </div>
        </form>

      </div>
    </main>
  );
}
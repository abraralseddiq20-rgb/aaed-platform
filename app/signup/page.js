// app/signup/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/supabase-client';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      setLoading(false);
      return;
    }

    try {
      await signUp(email, password, name);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'فشل إنشاء الحساب. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">تم إنشاء حسابك!</h1>
          <p className="text-slate-600 mb-4">سيتم تحويلك لصفحة الدخول...</p>
          <Link href="/login" className="text-teal-600 hover:underline font-medium">
            تسجيل الدخول الآن ←
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8">
          <a href="/" className="text-white text-3xl font-bold inline-block mb-2">
            عائد <span className="text-amber-400">| Aaed</span>
          </a>
          <p className="text-white/80 text-sm">انضم إلى رحلة العودة</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl">
          <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">
            حساب جديد
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              الاسم
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="اسمك الكامل"
              className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800"
              dir="ltr"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              كلمة المرور
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>

          <div className="text-center mt-4">
            <span className="text-sm text-slate-600">لديك حساب؟ </span>
            <Link href="/login" className="text-teal-600 hover:underline font-medium text-sm">
              سجّل دخولك
            </Link>
          </div>

          <div className="text-center mt-4 pt-4 border-t border-slate-200">
            <Link href="/" className="text-slate-500 hover:text-slate-700 text-sm">
              ← الرجوع للرئيسية
            </Link>
          </div>
        </form>

      </div>
    </main>
  );
}
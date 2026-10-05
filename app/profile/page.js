// app/profile/page.js
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { supabase, getProfile, updateProfile } from '@/lib/supabase-client';

export default function ProfilePage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', country: '', bio: '' });

  const isRTL = lang === 'ar' || lang === 'ur';

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

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled && loading) router.push('/login');
    }, 8000);

    async function load() {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) {
          if (!cancelled) router.push('/login');
          return;
        }
        if (cancelled) return;
        setUser(u);

        const prof = await getProfile(u.id);
        if (cancelled) return;
        if (prof) {
          setProfile(prof);
          setForm({
            name: prof.name || '',
            country: prof.country || '',
            bio: prof.bio || '',
          });
        }
      } catch (err) {
        console.error('[profile] error:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          clearTimeout(timeout);
        }
      }
    }
    load();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateProfile(user.id, {
        name: form.name,
        country: form.country,
        bio: form.bio,
        avatar_initial: form.name?.[0] || 'U',
      });
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center">
        <div className="text-white text-xl">{t.profile.loading}</div>
      </main>
    );
  }

  if (!user) return null;

  const isGuide = profile?.role === 'guide';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(
        lang === 'ar' ? 'ar-EG' : 'en-US',
        { year: 'numeric', month: 'long' }
      )
    : '';

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <Link href="/" className="text-2xl">→</Link>
        <div className="text-xl font-bold">
          {t.profile.title} <span className="text-amber-400">| Profile</span>
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
        <div className="max-w-2xl mx-auto space-y-4">

          {/* بطاقة الملف */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-20 h-20 rounded-full bg-teal-600 text-white flex items-center justify-center text-3xl font-bold flex-shrink-0">
                {profile?.avatar_initial || profile?.name?.[0] || 'U'}
              </div>
              <div className="flex-1">
                {!editing ? (
                  <>
                    <h2 className="font-bold text-2xl text-slate-800">{profile?.name || 'User'}</h2>
                    <p className="text-sm text-slate-500">{user?.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-medium">
                        {t.profile.roles[profile?.role] || t.profile.roles.user}
                      </span>
                      {isGuide && profile?.specialty && (
                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                          {t.guide.specialties[profile.specialty] || profile.specialty}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t.profile.name}</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t.profile.country}</label>
                      <input
                        type="text"
                        value={form.country}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t.profile.bio}</label>
                      <textarea
                        value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        rows={3}
                        className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!editing && profile?.bio && (
              <div className="pt-3 border-t border-slate-200">
                <div className="text-sm text-slate-700 leading-relaxed">{profile.bio}</div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {!editing ? (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition"
                  >
                    {t.profile.edit}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition"
                  >
                    {t.profile.logout}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-3 rounded-xl font-bold transition"
                  >
                    {t.profile.cancel}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
                  >
                    {saving ? '...' : t.profile.save}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* إحصائيات — للمرشدين */}
          {isGuide && !editing && (
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-lg text-slate-800 mb-4">
                📊 {lang === 'ar' ? 'الإحصائيات' : 'Statistics'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-amber-600">
                    ⭐ {profile?.rating || 5.0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {lang === 'ar' ? 'التقييم' : 'Rating'}
                  </div>
                </div>
                <div className="bg-teal-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-teal-600">
                    💬 {profile?.sessions_count || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t.guide.sessions}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-slate-700">
                    🌍 {(profile?.languages || []).length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {lang === 'ar' ? 'اللغات' : 'Languages'}
                  </div>
                </div>
              </div>

              {/* اللغات */}
              {profile?.languages && profile.languages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="text-xs text-slate-500 mb-2">
                    🌍 {t.guide.languages_label}:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.languages.map((code, i) => (
                      <span key={i} className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-medium">
                        {getLanguageLabel(code)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* تاريخ الانضمام */}
              {memberSince && (
                <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                  📅 {lang === 'ar' ? 'عضو منذ' : 'Member since'}: {memberSince}
                </div>
              )}
            </div>
          )}

          {/* الموقع */}
          {!editing && profile?.country && (
            <div className="bg-white rounded-2xl p-4 shadow-lg flex items-center gap-3">
              <div className="text-2xl">📍</div>
              <div>
                <div className="text-xs text-slate-500">{t.profile.country}</div>
                <div className="font-bold text-slate-800">{profile.country}</div>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
// app/profile/page.js
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { supabase, getProfile, updateProfile, getUserSessions } from '@/lib/supabase-client';

export default function ProfilePage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({
    name: '',
    country: '',
    bio: '',
  });

  const isRTL = lang === 'ar' || lang === 'ur';

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUser(user);

        const prof = await getProfile(user.id);
        if (prof) {
          setProfile(prof);
          setForm({
            name: prof.name || '',
            country: prof.country || '',
            bio: prof.bio || '',
          });
        }

        const userSessions = await getUserSessions(user.id);
        setSessions(userSessions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleSave = async () => {
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
      alert('فشل الحفظ: ' + err.message);
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

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      
      {/* Header */}
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

          {/* Profile Card */}
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
                    <span className="inline-block mt-2 bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-medium">
                      {t.profile.roles[profile?.role] || t.profile.roles.user}
                    </span>
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

            {/* Info (غير التعديل) */}
            {!editing && (
              <div className="space-y-3 text-sm">
                {profile?.country && (
                  <div className="flex gap-2">
                    <span className="text-slate-500">{t.profile.country}:</span>
                    <span className="text-slate-800 font-medium">{profile.country}</span>
                  </div>
                )}
                {profile?.bio && (
                  <div className="pt-3 border-t border-slate-200">
                    <div className="text-slate-500 mb-1">{t.profile.bio}:</div>
                    <div className="text-slate-800 leading-relaxed">{profile.bio}</div>
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
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

          {/* My Sessions */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-lg text-slate-800 mb-4">
              {t.profile.my_sessions}
            </h3>

            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                {t.profile.no_sessions}
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-slate-800">
                        {s.guide?.name || 'Guide'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        s.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        s.status === 'active' ? 'bg-green-100 text-green-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{s.initial_question}</p>
                    <Link
                      href={`/guide/${s.id}`}
                      className="text-xs text-teal-600 hover:underline mt-2 inline-block"
                    >
                      {t.profile.my_sessions} →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </main>
  );
}
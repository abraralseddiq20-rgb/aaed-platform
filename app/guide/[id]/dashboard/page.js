// app/guide/dashboard/page.js
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { supabase, getGuideSessions, updateSessionStatus } from '@/lib/supabase-client';

export default function GuideDashboard() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('pending');

  const isRTL = lang === 'ar' || lang === 'ur';

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('[dashboard] timeout');
        setLoading(false);
      }
    }, 8000);

    async function load() {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) {
          router.push('/login');
          return;
        }
        if (cancelled) return;
        setUser(u);

        const { data: prof } = await supabase
          .from('profiles').select('*').eq('id', u.id).maybeSingle();

        if (cancelled) return;
        setProfile(prof);

        if (!prof || prof.role !== 'guide') {
          router.push('/');
          return;
        }

        const data = await getGuideSessions(u.id);
        if (!cancelled) setSessions(data);
      } catch (err) {
        console.error('[dashboard] error:', err);
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
  }, [router]);

  const handleStatusChange = async (sessionId, newStatus) => {
    try {
      await updateSessionStatus(sessionId, newStatus);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: newStatus } : s))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSessions = filter === 'all'
    ? sessions
    : sessions.filter((s) => s.status === filter);

  const counts = {
    pending: sessions.filter((s) => s.status === 'pending').length,
    active: sessions.filter((s) => s.status === 'active').length,
    closed: sessions.filter((s) => s.status === 'closed').length,
    all: sessions.length,
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center">
        <div className="text-white text-xl">{t.guide_dashboard.loading}</div>
      </main>
    );
  }

  if (!profile || profile.role !== 'guide') {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <p className="text-slate-800 font-bold">هذه الصفحة للمرشدين فقط</p>
          <Link href="/" className="text-teal-600 hover:underline block mt-4">← الرئيسية</Link>
        </div>
      </main>
    );
  }

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <Link href="/" className="text-2xl">→</Link>
        <div className="text-xl font-bold">
          {t.guide_dashboard.title} <span className="text-amber-400">| Dashboard</span>
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
        <div className="max-w-3xl mx-auto space-y-4">

          {/* ترحيب */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-teal-600 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
                {profile?.avatar_initial || profile?.name?.[0] || '?'}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-xl text-slate-800">
                  {t.guide_dashboard.welcome.replace('{name}', profile?.name || '')}
                </h2>
                <p className="text-sm text-slate-500">
                  {profile?.specialty && <span>{t.guide.specialties[profile.specialty] || profile.specialty} · </span>}
                  {profile?.country}
                </p>
              </div>
            </div>
          </div>

          {/* إحصائيات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-lg text-center">
              <div className="text-3xl font-bold text-amber-500">{counts.pending}</div>
              <div className="text-xs text-slate-500 mt-1">{t.guide_dashboard.pending_requests}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-lg text-center">
              <div className="text-3xl font-bold text-teal-600">{counts.active}</div>
              <div className="text-xs text-slate-500 mt-1">{t.guide_dashboard.active_sessions}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-lg text-center">
              <div className="text-3xl font-bold text-slate-500">{counts.closed}</div>
              <div className="text-xs text-slate-500 mt-1">{t.guide_dashboard.closed_sessions}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-lg text-center">
              <div className="text-3xl font-bold text-slate-800">{counts.all}</div>
              <div className="text-xs text-slate-500 mt-1">الكل</div>
            </div>
          </div>

          {/* فلاتر */}
          <div className="flex gap-2 overflow-x-auto">
            {['pending', 'active', 'closed', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  filter === f ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {f === 'pending' && t.guide_dashboard.pending_requests}
                {f === 'active' && t.guide_dashboard.active_sessions}
                {f === 'closed' && t.guide_dashboard.closed_sessions}
                {f === 'all' && 'الكل'}
              </button>
            ))}
          </div>

          {/* جلسات */}
          {filteredSessions.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500">
              {filter === 'pending' ? t.guide_dashboard.no_pending : t.guide_dashboard.no_active}
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div key={session.id} className="bg-white rounded-2xl p-4 shadow-lg">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold flex-shrink-0">
                    {session.user?.avatar_initial || session.user?.name?.[0] || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800">
                      {session.user?.name || 'User'}
                    </div>
                    <div className="text-xs text-slate-500 flex gap-2 flex-wrap">
                      {session.user?.country && <span>{session.user.country}</span>}
                      <span>·</span>
                      <span>{formatDate(session.created_at)}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    session.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    session.status === 'active' ? 'bg-green-100 text-green-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {session.status === 'pending' && t.guide_dashboard.pending_requests}
                    {session.status === 'active' && t.guide_dashboard.active_sessions}
                    {session.status === 'closed' && t.guide_dashboard.closed_sessions}
                  </span>
                </div>

                {session.initial_question && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-3">
                    <div className="text-xs text-slate-500 mb-1">{t.guide_dashboard.question}:</div>
                    <div className="text-sm text-slate-700">{session.initial_question}</div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    href={`/guide/${session.user_id}`}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-bold text-sm text-center transition"
                  >
                    {t.guide_dashboard.reply}
                  </Link>
                  {session.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(session.id, 'active')}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-bold text-sm transition"
                    >
                      {t.guide_dashboard.open}
                    </button>
                  )}
                  {session.status === 'active' && (
                    <button
                      onClick={() => handleStatusChange(session.id, 'closed')}
                      className="flex-1 bg-slate-400 hover:bg-slate-500 text-white py-2 rounded-lg font-bold text-sm transition"
                    >
                      {t.guide_dashboard.close}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

        </div>
      </div>
    </main>
  );
}
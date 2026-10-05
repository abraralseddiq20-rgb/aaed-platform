// app/guide/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/layout';
import { supabase, getGuides } from '@/lib/supabase-client';

const LABELS = {
  my_chats: { ar: 'محادثاتي', en: 'My chats', fr: 'Mes conversations', ur: 'میری گفتگو', id: 'Obrolan saya' },
  new_reply: { ar: 'رد جديد', en: 'New reply', fr: 'Nouvelle réponse', ur: 'نیا جواب', id: 'Balasan baru' },
  you: { ar: 'أنت', en: 'You', fr: 'Vous', ur: 'آپ', id: 'Anda' },
};

export default function GuidePage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState(null);
  const [conversations, setConversations] = useState([]);

  const isRTL = lang === 'ar' || lang === 'ur';
  const L = (key) => LABELS[key][lang] || LABELS[key].ar;

  // ───── قائمة المرشدين ─────
  useEffect(() => {
    async function load() {
      try {
        const filters = {};
        if (specialtyFilter !== 'all') filters.specialty = specialtyFilter;
        const data = await getGuides(filters);
        setMentors(data || []);
      } catch (err) {
        console.error('[guide-list] Error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [specialtyFilter]);

  // ───── من أنا؟ ─────
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setMeId(data?.session?.user?.id || null);
    });
    return () => { active = false; };
  }, []);

  // ───── محادثاتي ─────
  const loadConversations = useCallback(async (uid) => {
    try {
      const { data: sess } = await supabase
        .from('chat_sessions')
        .select('id, guide_id, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (!sess || sess.length === 0) {
        setConversations([]);
        return;
      }

      const sessionIds = sess.map((s) => s.id);
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, session_id, sender_id, content, created_at')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false });

      // آخر رسالة لكل جلسة
      const lastBySession = new Map();
      for (const m of msgs || []) {
        if (!lastBySession.has(m.session_id)) lastBySession.set(m.session_id, m);
      }

      // محادثة واحدة لكل مرشد (الأحدث رسالةً)
      const byGuide = new Map();
      for (const s of sess) {
        const last = lastBySession.get(s.id);
        if (!last) continue; // نتجاهل الجلسات الفاضية
        const prev = byGuide.get(s.guide_id);
        if (!prev || new Date(last.created_at) > new Date(prev.last.created_at)) {
          byGuide.set(s.guide_id, { sessionId: s.id, guideId: s.guide_id, last });
        }
      }

      const guideIds = Array.from(byGuide.keys());
      if (guideIds.length === 0) {
        setConversations([]);
        return;
      }
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, avatar_initial')
        .in('id', guideIds);
      const profMap = new Map((profs || []).map((p) => [p.id, p]));

      const list = Array.from(byGuide.values()).map((c) => {
        let seen = null;
        try { seen = localStorage.getItem(`seen_${c.sessionId}`); } catch {}
        const fromOther = c.last.sender_id !== uid;
        const unread = fromOther && (!seen || new Date(c.last.created_at) > new Date(seen));
        return { ...c, guide: profMap.get(c.guideId), fromOther, unread };
      });
      list.sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
      setConversations(list);
    } catch (err) {
      console.error('[guide-list] conversations error:', err);
    }
  }, []);

  useEffect(() => {
    if (!meId) return;
    loadConversations(meId);

    // تحديث فوري لما توصل رسالة جديدة
    const channel = supabase
      .channel(`guide-list-${meId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadConversations(meId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, loadConversations]);

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

  const preview = (c) => {
    const text = c.last.content.length > 60 ? c.last.content.slice(0, 60) + '…' : c.last.content;
    return c.fromOther ? text : `${L('you')}: ${text}`;
  };

  const unreadCount = conversations.filter((c) => c.unread).length;

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <Link href="/" className="text-2xl">→</Link>
        <div className="text-xl font-bold flex items-center gap-2">
          <span>{t.guide.title} <span className="text-amber-400">| Guide</span></span>
          {unreadCount > 0 && (
            <span className="bg-amber-400 text-slate-900 text-xs font-bold rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
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
        <p className="text-white/80 text-center mb-6 text-sm">{t.guide.subtitle}</p>

        {/* محادثاتي */}
        {conversations.length > 0 && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="text-white font-bold mb-2 flex items-center gap-2">
              💬 {L('my_chats')}
            </div>
            <div className="space-y-2">
              {conversations.map((c) => (
                <Link
                  key={c.sessionId}
                  href={`/guide/${c.guideId}`}
                  className={`flex items-center gap-3 bg-white rounded-2xl p-4 shadow-lg hover:bg-slate-50 transition ${
                    c.unread ? 'ring-2 ring-amber-400' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {c.guide?.avatar_initial || c.guide?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800">{c.guide?.name || ''}</div>
                    <div
                      dir="auto"
                      className={`text-sm truncate ${c.unread ? 'text-slate-800 font-medium' : 'text-slate-500'}`}
                    >
                      {preview(c)}
                    </div>
                  </div>
                  {c.unread && (
                    <span className="bg-amber-400 text-slate-900 text-xs font-bold rounded-full px-3 py-1 whitespace-nowrap">
                      {L('new_reply')}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto mb-6">
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="w-full p-3 rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:border-amber-400"
          >
            <option value="all" className="text-slate-800">{t.guide.specialties.all}</option>
            <option value="family" className="text-slate-800">{t.guide.specialties.family}</option>
            <option value="psychology" className="text-slate-800">{t.guide.specialties.psychology}</option>
            <option value="fiqh" className="text-slate-800">{t.guide.specialties.fiqh}</option>
            <option value="seerah" className="text-slate-800">{t.guide.specialties.seerah}</option>
          </select>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl p-6 text-center text-slate-500">
              {t.guide.loading}
            </div>
          ) : mentors.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-slate-600">
              {t.guide.no_results}
            </div>
          ) : (
            mentors.map((mentor) => (
              <div key={mentor.id} className="bg-white rounded-2xl p-5 shadow-lg">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {mentor.avatar_initial || mentor.name?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-slate-800">{mentor.name}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                      {mentor.country && <span>📍 {mentor.country}</span>}
                      <span>⭐ {mentor.rating || 5}/5</span>
                      <span>💬 {mentor.sessions_count || 0} {t.guide.sessions}</span>
                    </div>
                  </div>
                </div>

                {mentor.bio && (
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">{mentor.bio}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {(mentor.languages || []).map((code, i) => (
                    <span key={i} className="bg-slate-100 text-teal-700 px-3 py-1 rounded-full text-xs font-medium">
                      {getLanguageLabel(code)}
                    </span>
                  ))}
                  {mentor.specialty && (
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                      {t.guide.specialties[mentor.specialty] || mentor.specialty}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => router.push(`/guide/${mentor.id}`)}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition"
                >
                  {t.guide.start_chat}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="max-w-2xl mx-auto mt-6 bg-white/10 backdrop-blur rounded-2xl p-5 text-white text-sm">
          <div className="font-bold mb-2">💡 {t.guide.how_it_works}</div>
          <ul className="list-disc pr-5 space-y-1 opacity-90">
            {(t.guide.points || []).map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
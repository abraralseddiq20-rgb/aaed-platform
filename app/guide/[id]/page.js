// app/guide/[id]/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/app/layout';
import { supabase, createChatSession } from '@/lib/supabase-client';

const WELCOME_MESSAGES = {
  ar: 'السلام عليكم! كيف أقدر أساعدك اليوم؟',
  en: 'Peace be upon you! How can I help you today?',
  fr: 'Que la paix soit sur vous! Comment puis-je vous aider aujourd\'hui?',
  ur: 'السلام علیکم! آج میں آپ کی کیسے مدد کر سکتا ہوں؟',
  id: 'Assalamualaikum! Bagaimana saya bisa membantu Anda hari ini?',
};

export default function GuideChatPage() {
  const params = useParams();
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  const [user, setUser] = useState(null);
  const [other, setOther] = useState(null);       // الطرف الآخر (المرشد أو المستخدم)
  const [session, setSession] = useState(null);   // null = لسا ما انفتحت جلسة
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef(null);

  const isRTL = lang === 'ar' || lang === 'ur';
  const routeId = params?.id;

  // true لو اللي فاتح الصفحة هو المرشد صاحب الجلسة
  const isGuideSide = !!(session && user && session.guide_id === user.id);

  // ───── تحميل الجلسة والرسائل ─────
  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;

    async function load() {
      try {
        const { data: { user: me } } = await supabase.auth.getUser();
        if (!me) {
          router.push('/login');
          return;
        }
        if (cancelled) return;
        setUser(me);

        const sessionParam = new URLSearchParams(window.location.search).get('session');

        let sess = null;
        let otherId = routeId;

        if (sessionParam) {
          // المرشد جاي من اللوحة: نفتح الجلسة نفسها
          const { data } = await supabase
            .from('chat_sessions').select('*').eq('id', sessionParam).maybeSingle();
          if (!data) {
            if (!cancelled) setError('Session not found');
            return;
          }
          sess = data;
          otherId = me.id === data.user_id ? data.guide_id : data.user_id;
        } else {
          // المستخدم يفتح شات مع مرشد: نبحث عن جلسة مفتوحة (pending أو active)
          const { data } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', me.id)
            .eq('guide_id', routeId)
            .in('status', ['pending', 'active'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          sess = data;
        }

        const { data: otherProfile } = await supabase
          .from('profiles').select('*').eq('id', otherId).maybeSingle();
        if (!otherProfile) {
          if (!cancelled) setError('Not found');
          return;
        }
        if (cancelled) return;
        setOther(otherProfile);

        if (sess) {
          const { data: msgs, error: msgsErr } = await supabase
            .from('messages')
            .select('*')
            .eq('session_id', sess.id)
            .order('created_at', { ascending: true });
          if (msgsErr) console.error('[chat] load messages:', msgsErr);
          if (cancelled) return;
          setMessages(msgs || []);
        }
        setSession(sess);
      } catch (err) {
        console.error('[chat] load error:', err);
        if (!cancelled) setError('Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [routeId, router]);

  // ───── الاستقبال الفوري (Realtime) ─────
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`messages-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // نزول تلقائي لآخر رسالة
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ───── الإرسال ─────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user || sending) return;
    setSending(true);
    setSendError('');

    try {
      let sess = session;

      // أول رسالة: ننشئ الجلسة الآن (والسؤال الأول = نص الرسالة)
      if (!sess) {
        sess = await createChatSession(user.id, routeId, text, lang);
        setSession(sess);
      }

      const { data, error: insertErr } = await supabase
        .from('messages')
        .insert({ session_id: sess.id, sender_id: user.id, content: text })
        .select()
        .single();
      if (insertErr) throw insertErr;

      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setInput('');

      // لما المرشد يرد على طلب جديد، تتحول الجلسة إلى نشطة
      if (sess.guide_id === user.id && sess.status === 'pending') {
        const { error: stErr } = await supabase
          .from('chat_sessions').update({ status: 'active' }).eq('id', sess.id);
        if (!stErr) setSession({ ...sess, status: 'active' });
      }
    } catch (err) {
      console.error('[chat] send error:', err);
      setSendError(err?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  // ───── العرض ─────
  if (loading) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center">
        <div className="text-white text-xl">{t.guide.loading}</div>
      </main>
    );
  }

  if (error || !other) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <div className="text-5xl mb-4">👤</div>
          <p className="text-slate-800 mb-4 font-bold">{error || 'Not found'}</p>
          <button onClick={() => router.push('/guide')} className="text-teal-600 hover:underline">
            ← {t.guide.modal.cancel}
          </button>
        </div>
      </main>
    );
  }

  const backTo = isGuideSide ? '/guide/dashboard' : '/guide';
  const showWelcome = messages.length === 0 && !isGuideSide;

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <button onClick={() => router.push(backTo)} className="text-2xl">→</button>
        <div className="flex items-center gap-3 flex-1 justify-center">
          <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
            {other.avatar_initial || other.name?.[0] || '?'}
          </div>
          <div className="text-center">
            <div className="font-bold">{other.name}</div>
            <div className="text-xs opacity-80">
              {other.country}
              {other.role === 'guide' && other.specialty
                ? ` · ${t.guide.specialties?.[other.specialty] || other.specialty}`
                : ''}
            </div>
          </div>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showWelcome && (
          <div className="max-w-[80%] p-4 rounded-2xl bg-white text-slate-800 ml-auto rounded-br-sm">
            <div className="text-sm leading-relaxed">
              {WELCOME_MESSAGES[lang] || WELCOME_MESSAGES.ar}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`max-w-[80%] p-4 rounded-2xl ${
                isMine
                  ? 'bg-teal-500 text-white mr-auto rounded-bl-sm'
                  : 'bg-white text-slate-800 ml-auto rounded-br-sm'
              }`}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white p-4 shadow-lg">
        {sendError && (
          <div className="text-xs text-red-600 mb-2">⚠️ {sendError}</div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.guide.chat_placeholder}
            className="flex-1 p-3 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-teal-500"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 rounded-xl font-bold disabled:opacity-50"
          >
            {t.guide.send}
          </button>
        </div>
      </div>
    </main>
  );
}
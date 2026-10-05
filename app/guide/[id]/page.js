// app/guide/[id]/page.js
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/app/layout';
import { supabase, getMessages, sendMessage, createChatSession } from '@/lib/supabase-client';

const WELCOME_MESSAGES = {
  ar: 'السلام عليكم! كيف أقدر أساعدك اليوم؟',
  en: 'Peace be upon you! How can I help you today?',
  fr: 'Que la paix soit sur vous! Comment puis-je vous aider aujourd\'hui?',
  ur: 'السلام علیکم! آج میں آپ کی کیسے مدد کر سکتا ہوں؟',
  id: 'Assalamualaikum! Bagaimana saya bisa membantu Anda hari ini?',
};

const AUTO_REPLY_MESSAGES = {
  ar: 'شكراً لرسالتك. سأرد عليك في أقرب وقت بإذن الله.',
  en: 'Thank you for your message. I will reply as soon as possible.',
  fr: 'Merci pour votre message. Je vous répondrai dès que possible.',
  ur: 'آپ کے پیغام کا شکریہ۔ میں جلد جواب دوں گا۔',
  id: 'Terima kasih atas pesan Anda. Saya akan membalas secepatnya.',
};

export default function GuideChatPage() {
  const params = useParams();
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [user, setUser] = useState(null);
  const [guide, setGuide] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const isRTL = lang === 'ar' || lang === 'ur';
  const guideId = params?.id;

  // ⚠️ إذا الرابط "dashboard" → redirect
  useEffect(() => {
    if (guideId === 'dashboard') {
      router.replace('/guide/dashboard');
    }
  }, [guideId, router]);

  useEffect(() => {
    if (guideId === 'dashboard') return; // تجنب التحميل

    let cancelled = false;

    async function load() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
          router.push('/login');
          return;
        }
        if (cancelled) return;
        setUser(currentUser);

        const { data: guideData, error: guideError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', guideId)
          .maybeSingle();

        if (guideError || !guideData) {
          setError('Guide not found');
          setLoading(false);
          return;
        }

        if (cancelled) return;
        setGuide(guideData);

        const { data: existing } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('guide_id', guideId)
          .eq('status', 'pending')
          .maybeSingle();

        let session = existing;
        if (!session) {
          try {
            session = await createChatSession(
              currentUser.id,
              guideId,
              'Initial question',
              lang
            );
          } catch (createErr) {
            console.error('[guide-chat] createChatSession error:', createErr);
          }
        }

        if (cancelled) return;
        if (session) setSessionId(session.id);

        const welcomeMsg = {
          id: 'welcome',
          content: WELCOME_MESSAGES[lang] || WELCOME_MESSAGES.ar,
          sender_id: guideId,
          created_at: new Date().toISOString(),
        };

        if (session) {
          try {
            const msgs = await getMessages(session.id);
            if (!cancelled) {
              setMessages(msgs.length > 0 ? msgs : [welcomeMsg]);
            }
          } catch (msgErr) {
            if (!cancelled) setMessages([welcomeMsg]);
          }
        } else {
          if (!cancelled) setMessages([welcomeMsg]);
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (guideId) load();

    return () => {
      cancelled = true;
    };
  }, [guideId, lang]);

  const handleSend = async () => {
    if (!input.trim() || !user || sending) return;
    setSending(true);

    const text = input.trim();
    const isFirstMessage = !messages.some((m) => m.sender_id === user.id);

    const userMsg = {
      id: Date.now(),
      content: text,
      sender_id: user.id,
      created_at: new Date().toISOString(),
    };

    const autoReply = {
      id: `auto-${Date.now() + 1}`,
      content: AUTO_REPLY_MESSAGES[lang] || AUTO_REPLY_MESSAGES.ar,
      sender_id: guideId,
      created_at: new Date(Date.now() + 1500).toISOString(),
      is_auto: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    if (isFirstMessage) {
      setTimeout(() => {
        setMessages((prev) => [...prev, autoReply]);
      }, 1500);
    }

    try {
      if (sessionId) {
        await sendMessage(sessionId, user.id, text);
      }
    } catch (err) {
      console.error('[guide-chat] sendMessage error:', err);
    } finally {
      setSending(false);
    }
  };

  if (guideId === 'dashboard') {
    return null;
  }

  if (loading) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center">
        <div className="text-white text-xl">{t.guide.loading}</div>
      </main>
    );
  }

  if (error || !guide) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <div className="text-5xl mb-4">👤</div>
          <p className="text-slate-800 mb-4 font-bold">{error || 'Guide not found'}</p>
          <button
            onClick={() => router.push('/guide')}
            className="text-teal-600 hover:underline"
          >
            ← {t.guide.modal.cancel}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <button onClick={() => router.push('/guide')} className="text-2xl">→</button>
        <div className="flex items-center gap-3 flex-1 justify-center">
          <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
            {guide.avatar_initial || guide.name?.[0] || '?'}
          </div>
          <div className="text-center">
            <div className="font-bold">{guide.name}</div>
            <div className="text-xs opacity-80">
              {guide.country} · {t.guide.specialties?.[guide.specialty] || guide.specialty || ''}
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
        {messages.map((msg, idx) => {
          const isUser = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id || idx}
              className={`max-w-[80%] p-4 rounded-2xl ${
                isUser
                  ? 'bg-teal-500 text-white mr-auto rounded-bl-sm'
                  : 'bg-white text-slate-800 ml-auto rounded-br-sm'
              }`}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-4 shadow-lg">
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
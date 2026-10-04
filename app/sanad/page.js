// app/sanad/page.js
'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/app/layout';

export default function SanadPage() {
  const { lang, setLang, t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const isRTL = lang === 'ar' || lang === 'ur';

  useEffect(() => {
    setMessages([
      { role: 'sanad', text: t.sanad.initial_message }
    ]);
  }, [lang, t.sanad.initial_message]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/sanad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentInput,
          lang: lang
        })
      });

      const data = await response.json();

      if (data.error) {
        // عرض خطأ بلغة الواجهة
        setMessages(prev => [...prev, {
          role: 'sanad',
          text: '⏳ ' + (t.sanad.error || data.error)
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'sanad',
          text: data.answer,
          sources: data.sources
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'sanad',
        text: '⏳ ' + t.sanad.error
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <a href="/" className="text-2xl">←</a>
        <div className="text-xl font-bold">
          {t.sanad.title} <span className="text-amber-400">| Sanad</span>
        </div>
        <div className="flex gap-1">
          {['ar', 'en', 'fr', 'ur', 'id'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded text-xs font-bold transition ${
                lang === l
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[80%] p-4 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-teal-500 text-white mr-auto rounded-bl-sm'
                : 'bg-white text-slate-800 ml-auto rounded-br-sm'
            }`}
          >
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>

            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-500 mb-1">
                  {t.sanad.source_label}:
                </div>
                <ul className="text-xs text-slate-500 space-y-1">
                  {msg.sources.map((s, i) => (
                    <li key={i}>
                      [{i + 1}] {s.source || s.table} {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                          🔗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="bg-white text-slate-500 p-4 rounded-2xl ml-auto rounded-br-sm max-w-[80%]">
            {t.sanad.loading}
          </div>
        )}
      </div>

      <div className="bg-white p-4 shadow-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t.sanad.input_placeholder}
            className="flex-1 p-3 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-teal-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 rounded-xl font-bold disabled:opacity-50"
          >
            {t.sanad.send}
          </button>
        </div>
      </div>
    </main>
  );
}
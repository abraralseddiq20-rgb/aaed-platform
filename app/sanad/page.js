'use client';
import { useState } from 'react';

export default function SanadPage() {
  const [messages, setMessages] = useState([
    { role: 'sanad', text: 'السلام عليكم! أنا سند، رفيقك في رحلة العودة. كيف أساعدك اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/sanad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input })
      });

      const data = await response.json();
      setMessages(prev => [...prev, { 
        role: 'sanad', 
        text: data.answer || data.error,
        source: data.source 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'sanad', 
        text: 'عذراً، حدث خطأ. حاول مرة أخرى.' 
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
    <main dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <a href="/" className="text-2xl">←</a>
        <div className="text-xl font-bold">
          سند <span className="text-amber-400">| Sanad</span>
        </div>
        <div className="text-2xl">🌐</div>
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
            {msg.source && (
              <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                📖 المصدر: {msg.source}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="bg-white text-slate-500 p-4 rounded-2xl ml-auto rounded-br-sm max-w-[80%]">
            سند يكتب...
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
            placeholder="اكتب رسالتك..."
            className="flex-1 p-3 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-teal-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 rounded-xl font-bold disabled:opacity-50"
          >
            إرسال
          </button>
        </div>
      </div>
    </main>
  );
}
'use client';
import { useState, useEffect } from 'react';

const INITIAL_MESSAGES = {
  ar: 'السلام عليكم! أنا سند، رفيقك في رحلة العودة. كيف أساعدك اليوم؟',
  en: 'Peace be upon you! I am Sanad, your companion on the journey back. How can I help you today?',
  fr: 'Que la paix soit sur vous! Je suis Sanad, votre compagnon sur le chemin du retour. Comment puis-je vous aider?',
  ur: 'السلام علیکم! میں سند ہوں، واپسی کے سفر میں آپ کا ساتھی۔ آج میں آپ کی کیسے مدد کر سکتا ہوں؟',
  id: 'Assalamualaikum! Saya Sanad, pendamping Anda dalam perjalanan kembali. Bagaimana saya bisa membantu Anda hari ini?',
};

export default function SanadPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('ar');

  useEffect(() => {
    const savedLang = localStorage.getItem('aaed-lang') || 'ar';
    setLang(savedLang);
    setMessages([
      { role: 'sanad', text: INITIAL_MESSAGES[savedLang] || INITIAL_MESSAGES.ar }
    ]);
  }, []);

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('aaed-lang', newLang);
    setMessages([
      { role: 'sanad', text: INITIAL_MESSAGES[newLang] || INITIAL_MESSAGES.ar }
    ]);
  };

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
        setMessages(prev => [...prev, { 
          role: 'sanad', 
          text: '⏳ ' + data.error 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'sanad', 
          text: data.answer,
          source: data.source 
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'sanad', 
        text: '⏳ حدث خطأ مؤقت. حاول مرة أخرى.' 
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

  const isRTL = lang === 'ar' || lang === 'ur';

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      
      <header className="bg-teal-900 text-white p-4 flex items-center justify-between shadow-lg">
        <a href="/" className="text-2xl">←</a>
        <div className="text-xl font-bold">
          سند <span className="text-amber-400">| Sanad</span>
        </div>
        <div className="flex gap-1">
          {['ar', 'en', 'fr', 'ur', 'id'].map((l) => (
            <button
              key={l}
              onClick={() => changeLang(l)}
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
            {msg.source && (
              <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                📖 {msg.source}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="bg-white text-slate-500 p-4 rounded-2xl ml-auto rounded-br-sm max-w-[80%]">
            {lang === 'ar' ? 'سند يكتب...' : 
             lang === 'fr' ? 'Sanad écrit...' :
             lang === 'ur' ? 'سند لکھ رہا ہے...' :
             lang === 'id' ? 'Sanad sedang menulis...' :
             'Sanad is typing...'}
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
            placeholder={
              lang === 'ar' ? 'اكتب رسالتك...' :
              lang === 'fr' ? 'Écrivez votre message...' :
              lang === 'ur' ? 'اپنا پیغام لکھیں...' :
              lang === 'id' ? 'Tulis pesan Anda...' :
              'Type your message...'
            }
            className="flex-1 p-3 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-teal-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 rounded-xl font-bold disabled:opacity-50"
          >
            {lang === 'ar' ? 'إرسال' :
             lang === 'fr' ? 'Envoyer' :
             lang === 'ur' ? 'بھیجیں' :
             lang === 'id' ? 'Kirim' :
             'Send'}
          </button>
        </div>
      </div>

    </main>
  );
}
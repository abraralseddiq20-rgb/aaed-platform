'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const mentorsData = {
  '1': {
    name: 'أحمد محمود',
    avatar: 'أ',
    country: 'السودان',
    specialty: 'الأسئلة الأسرية',
  },
  '2': {
    name: 'فاطمة علي',
    avatar: 'ف',
    country: 'مصر',
    specialty: 'الدعم النفسي',
  },
  '3': {
    name: 'محمد الحسن',
    avatar: 'م',
    country: 'السعودية',
    specialty: 'الفقه والعقيدة',
  },
};

export default function ChatPage() {
  const params = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const mentor = mentorsData[params.id] || mentorsData['1'];

  useEffect(() => {
    setMessages([
      { 
        role: 'mentor', 
        text: `السلام عليكم، أنا ${mentor.name}. تم استلام طلبك بنجاح. سأساعدك في ${mentor.specialty}. كيف أقدر أساعدك؟` 
      }
    ]);
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');

    // رد تلقائي مؤقت
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'mentor', 
        text: 'شكراً لرسالتك. سأرد عليك في أقرب وقت ممكن بإذن الله.' 
      }]);
    }, 1000);
  };

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex flex-col">
      
      {/* Header */}
      <header className="bg-teal-900 text-white p-4 flex items-center gap-3 shadow-lg">
        <a href="/guide" className="text-2xl">→</a>
        <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-bold flex-shrink-0">
          {mentor.avatar}
        </div>
        <div className="flex-1">
          <div className="font-bold">{mentor.name}</div>
          <div className="text-xs opacity-80">
            {mentor.country} · {mentor.specialty}
          </div>
        </div>
        <div className="w-3 h-3 rounded-full bg-green-400"></div>
      </header>

      {/* Chat Area */}
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
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="bg-white p-4 shadow-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="اكتب رسالتك للمرشد..."
            className="flex-1 p-3 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-teal-500"
          />
          <button
            onClick={sendMessage}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 rounded-xl font-bold"
          >
            إرسال
          </button>
        </div>
      </div>

    </main>
  );
}
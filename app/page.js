export default function Home() {
  return (
    <main 
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-6"
    >
      <div className="text-center text-white max-w-3xl w-full">
        
        <div className="flex flex-col items-center mb-12">
          
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            عائد <span className="text-amber-400">|</span> <span className="text-amber-400">Aaed</span>
          </h1>

          <p className="text-2xl md:text-3xl opacity-95 tracking-wide">
            رفيقك في رحلة العودة
          </p>

        </div>

        <p className="text-base md:text-lg mb-10 opacity-80 max-w-xl mx-auto">
          منصة اجتماعية متعددة اللغات، تجمع المسلمين الجدد والراجعين للإسلام
          في بيئة رقمية آمنة.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          
          <div className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition">
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="12" rx="2"/>
                <path d="M9 8V5a3 3 0 0 1 6 0v3"/>
                <circle cx="9" cy="14" r="1" fill="white"/>
                <circle cx="15" cy="14" r="1" fill="white"/>
              </svg>
            </div>
            <div className="font-bold text-sm">سند</div>
            <div className="text-xs opacity-70">المساعد الذكي</div>
          </div>

          <div className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition">
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
              </svg>
            </div>
            <div className="font-bold text-sm">المرشد</div>
            <div className="text-xs opacity-70">الدعم البشري</div>
          </div>

          <div className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition">
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3"/>
                <circle cx="17" cy="9" r="2.5"/>
                <path d="M3 20c0-3 3-5 6-5s6 2 6 5"/>
                <path d="M15 20c0-2 1.5-3.5 4-3.5"/>
              </svg>
            </div>
            <div className="font-bold text-sm">المجتمع</div>
            <div className="text-xs opacity-70">العائدون</div>
          </div>

          <div className="bg-white/10 backdrop-blur p-4 rounded-xl hover:bg-white/20 transition">
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4"/>
                <path d="M4 4v18"/>
                <path d="M8 8h8"/>
                <path d="M8 12h8"/>
                <path d="M8 16h5"/>
              </svg>
            </div>
            <div className="font-bold text-sm">المكتبة</div>
            <div className="text-xs opacity-70">محتوى متجدد</div>
          </div>

        </div>

      </div>
    </main>
  );
}
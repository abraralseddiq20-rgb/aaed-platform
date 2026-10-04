import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { question } = await request.json();

    if (!question) {
      return Response.json({ error: 'السؤال مطلوب' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" 
    });

    const prompt = `
أنت "سند"، مساعد ذكي متخصص في المحتوى الإسلامي.

⚠️ قواعد صارمة:
1. أجب فقط من المصادر الإسلامية الموثوقة
2. لا تفتِ في مسائل شخصية — أشر للمرشد البشري
3. اذكر المصدر إذا أمكن
4. كن دافئاً ومحترماً
5. إذا لم تكن متأكداً — قل "لا أعرف" وأحل للمرشد

السؤال: ${question}

الإجابة:
    `;

    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    return Response.json({ 
      answer,
      source: 'Gemini AI'
    });

  } catch (error) {
    console.error('Sanad API Error:', error);
    return Response.json({ 
      error: 'حدث خطأ في الاتصال' 
    }, { status: 500 });
  }
}
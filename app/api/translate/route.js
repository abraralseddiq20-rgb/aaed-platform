// app/api/translate/route.js
// ترجمة المحتوى عبر Gemini
// POST: { text, from, to }

export async function POST(request) {
  try {
    const { text, from, to } = await request.json();

    if (!text || !from || !to) {
      return Response.json(
        { error: 'Missing required params: text, from, to' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY missing' },
        { status: 500 }
      );
    }

    // خريطة أسماء اللغات
    const langNames = {
      ar: 'Arabic',
      en: 'English',
      fr: 'French',
      ur: 'Urdu',
      id: 'Indonesian',
    };

    const targetLang = langNames[to] || to;
    const sourceLang = langNames[from] || from;

    const prompt = `You are a professional Islamic content translator.
Translate the following text from ${sourceLang} to ${targetLang}.

Rules:
- Preserve the meaning faithfully
- Keep Islamic terms accurate
- Maintain the original tone
- Output ONLY the translation, no explanations

Text:
${text}`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Translation API error:', errText);
      return Response.json(
        { error: 'Translation failed' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const translation =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!translation) {
      return Response.json(
        { error: 'Empty translation' },
        { status: 500 }
      );
    }

    return Response.json({ translation });
  } catch (err) {
    console.error('Translate error:', err);
    return Response.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
// app/api/moderate/route.js
// فلترة المحتوى (Bad Words + AI Moderation)
// POST: { text }
// Returns: { safe: boolean, reason?: string }

// قائمة الكلمات الممنوعة الأساسية
const BAD_WORDS = [
  // بذاءة عربية (مختصرة)
  'كلب', 'حمار', 'غبي', 'خنزير', 'حقير', 'زبالة',
  // إنجليزية
  'fuck', 'shit', 'bitch', 'asshole', 'bastard',
  // كراهية عامة
  'اكرهك', 'موت', 'اقتل',
];

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return Response.json(
        { error: 'text required' },
        { status: 400 }
      );
    }

    const lowerText = text.toLowerCase();

    // 1. فحص الكلمات الممنوعة
    for (const word of BAD_WORDS) {
      if (lowerText.includes(word.toLowerCase())) {
        return Response.json({
          safe: false,
          reason: 'المحتوى يحتوي على كلمات غير لائقة',
        });
      }
    }

    // 2. فحص AI (Gemini)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // لو ما فيه API، نرجع آمن
      return Response.json({ safe: true });
    }

    const prompt = `You are a content moderator for an Islamic community platform.
Analyze the following text and determine if it's appropriate for a family-friendly Islamic community.

The content should NOT contain:
- Profanity, insults, or vulgar language
- Hate speech or discrimination
- Violence or threats
- Sexual content
- Anti-Islamic rhetoric or mockery

Text:
${text}

Respond ONLY with JSON in this exact format:
{"safe": true} or {"safe": false, "reason": "brief reason in Arabic"}`;

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
          generationConfig: { maxOutputTokens: 200, temperature: 0 },
        }),
      }
    );

    if (!response.ok) {
      // فشل الفحص → نرجع آمن (fail-open)
      return Response.json({ safe: true });
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // استخراج JSON من النص
    const jsonMatch = resultText.match(/\{[^}]+\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return Response.json({
          safe: result.safe !== false,
          reason: result.reason || null,
        });
      } catch {
        return Response.json({ safe: true });
      }
    }

    return Response.json({ safe: true });
  } catch (err) {
    console.error('Moderate error:', err);
    // فشل → نرجع آمن
    return Response.json({ safe: true });
  }
}
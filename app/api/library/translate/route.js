// app/api/library/translate/route.js
// ترجمة محتوى المكتبة عبر Gemini
// POST: { itemId, targetLang }
// - يتحقق أولاً من translations المخزنة (cache)
// - لو موجودة → يرجعها فورًا
// - لو مش موجودة → يستدعي Gemini ويخزنها في Supabase

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GEMINI_MODEL = 'gemini-flash-latest';

// قاموس المصطلحات الشرعية — لترجمة موحدة
const ISLAMIC_GLOSSARY = {
  'الإسلام': 'Islam',
  'التوحيد': 'Tawhid (Islamic monotheism)',
  'العبادة': 'Ibadah (worship)',
  'النبوة': 'Nubuwwah (prophethood)',
  'الوحي': 'Wahy (divine revelation)',
  'الشريعة': 'Sharia (Islamic law)',
  'الحديث': 'Hadith (prophetic tradition)',
  'السنة': 'Sunnah (prophetic practice)',
  'الفتوى': 'Fatwa (religious ruling)',
  'الدعوة': 'Dawah (invitation to Islam)',
  'الكعبة': 'the Kaaba',
  'القبلة': 'the Qibla (direction of prayer)',
  'الصلاة': 'Salah (prayer)',
  'الزكاة': 'Zakat (obligatory charity)',
  'الصيام': 'Sawm (fasting)',
  'الحج': 'Hajj (pilgrimage)',
  'الإيمان': 'Iman (faith)',
  'القرآن': 'the Quran',
  'النبي': 'the Prophet (Muhammad)',
  'الصحابة': 'the Companions',
};

const LANG_NAMES = {
  ar: 'Arabic',
  en: 'English',
  fr: 'French',
  ur: 'Urdu',
  id: 'Indonesian',
};

export async function POST(request) {
  try {
    const { itemId, targetLang } = await request.json();

    // التحقق من المدخلات
    if (!itemId || !targetLang) {
      return Response.json(
        { error: 'Missing required params: itemId, targetLang' },
        { status: 400 }
      );
    }

    if (!LANG_NAMES[targetLang]) {
      return Response.json(
        { error: `Unsupported language: ${targetLang}` },
        { status: 400 }
      );
    }

    // 1. جيب العنصر من Supabase
    const { data: item, error: fetchError } = await supabase
      .from('library_content')
      .select('id, title_ar, description_ar, content, translations')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      return Response.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // 2. لو العربي مطلوب → رجّع النص الأصلي
    if (targetLang === 'ar') {
      return Response.json({
        translation: {
          title: item.title_ar,
          description: item.description_ar,
          content: item.content,
        },
        cached: true,
      });
    }

    // 3. تحقق من الـ cache
    const existing = item.translations?.[targetLang];
    if (existing && existing.title) {
      return Response.json({
        translation: existing,
        cached: true,
      });
    }

    // 4. لو مش موجود → استدعي Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY missing' },
        { status: 500 }
      );
    }

    // 5. جهّز النص للترجمة
    const textsToTranslate = {
      title: item.title_ar || '',
      description: item.description_ar || '',
      content: item.content || '',
    };

    // 6. استدعي Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: buildPrompt(textsToTranslate, LANG_NAMES[targetLang])
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return Response.json(
        { error: 'Translation service failed', details: errText },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return Response.json(
        { error: 'Empty response from Gemini' },
        { status: 502 }
      );
    }

    // 7. حلّل الـ JSON
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // لو Gemini رجّع نص غير JSON، حاول نضيفه
      parsed = { title: '', description: '', content: rawText };
    }

    const translation = {
      title: parsed.title || '',
      description: parsed.description || '',
      content: parsed.content || '',
      translated_at: new Date().toISOString(),
    };

    // 8. خزّنها في Supabase
    const updatedTranslations = {
      ...(item.translations || {}),
      [targetLang]: translation,
    };

    const { error: updateError } = await supabase
      .from('library_content')
      .update({ translations: updatedTranslations })
      .eq('id', itemId);

    if (updateError) {
      console.error('Failed to cache translation:', updateError);
      // ما نرجعش خطأ — الترجمة نفسها نجحت
    }

    return Response.json({
      translation,
      cached: false,
    });

  } catch (err) {
    console.error('Translate error:', err);
    return Response.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

function buildPrompt(texts, targetLangName) {
  return `You are a professional Islamic content translator.

Translate the following content from Arabic to ${targetLangName}.

STRICT RULES:
1. Preserve the meaning faithfully — no additions, no omissions.
2. Use this glossary EXACTLY for these Islamic terms (do not replace with generic terms):
${JSON.stringify(ISLAMIC_GLOSSARY, null, 2)}
3. Quranic verses: keep as-is if they exist.
4. Hadith: keep as-is if they exist.
5. Maintain a respectful tone for sacred content.
6. If a field is empty, return an empty string for it.

You will receive a JSON object with these fields:
- "title": the content title
- "description": short description
- "content": full body text (may be empty)

Return ONLY a JSON object with the exact same fields, translated:
{
  "title": "...",
  "description": "...",
  "content": "..."
}

Input:
${JSON.stringify(texts, null, 2)}`;
}
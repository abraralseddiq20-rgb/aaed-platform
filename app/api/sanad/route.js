const SYSTEM_PROMPT = `أنت "سند"، أداة مدعومة بالذكاء الاصطناعي (ولست مختصاً بشرياً) تخدم المحتوى الإسلامي. التزم بالضوابط الآتية:

## المراجع المعتمدة الوحيدة للاستشهاد
- القرآن: نص مجمع الملك فهد (quranpedia.net)
- التفسير: dorar.net/tafseer
- الحديث: الصحيحان، وdorar.net/hadith
- العقيدة: dorar.net/aqeeda
- الفقه: dorar.net/feqhia (على المذاهب الأربعة)
- السيرة والتاريخ: dorar.net/history
- الشبهات والأسئلة: dawa.center/file/7937
- المصطلحات والترجمة: islamic-content.com/dictionary

## مستويات الأسئلة
صنّف السؤال داخلياً ثم التزم بسلوكه:
- (أ) معلومات مستقرة (قرآن، حديث صحيح، أركان، سيرة أساسية، أخلاق): إجابة مباشرة موثقة بالمصدر.
- (ب) شرح وتعريف واستدلال وشبهات عامة: أجب من المادة المعتمدة مع المرجع، وتجنب القطع فيما يحتمل الخلاف.
- (ج) خلاف فقهي أو مسائل عقدية تفصيلية أو قضايا تاريخية جدلية: اذكر وجود الخلاف بإيجاز، أو أحِل إلى المختص.
- (د) فتوى أو حالة شخصية (واقعة فردية، صحة عقد أو عبادة لشخص بعينه، نزاع أسري، مسائل قانونية أو طبية): لا تُصدر حكماً. قدّم معلومة عامة فقط، وأحِل إلى جهة أو عالم مؤهل.

## قواعد ملزمة
1. الإسناد: كل معلومة شرعية تُنسب إلى مصدر من القائمة أعلاه. لا تنسب نصاً أو قولاً إلى مرجع لا تتيقن أنه فيه. فرّق بين النص الشرعي وشرحك.
2. لا تكتب نص آية أو حديث من الذاكرة إلا إذا كنت متيقناً تماماً منه، وإلا فاذكر المعنى وأحِل للمصدر (سورة/آية، أو الصحيحين، أو الرابط).
3. لا تختلق حديثاً أبداً. إن طُلب حديث يثبت قولاً ولم تجد دليلاً صحيحاً مطابقاً فقل ذلك صراحة.
4. إن كانت الآية أو الحديث في سؤال المستخدم منقولاً بخطأ، نبّه بلطف على النص الصحيح مع ذكر السورة والآية.
5. لا تعرض المسائل الخلافية بصيغة القطع. وضّح القطعي من الاجتهادي، ولا تنسب اتفاقاً غير ثابت.
6. مقاومة الهلوسة: عند غياب المرجع الكافي أو ضعف ثقتك، امتنع أو تحفّظ أو أحِل. لا تولّد إجابة غير موثقة.
7. لا تستقل بالفتوى الشخصية. وإن اشتبه الأمر فاطلب التوضيح أو أحِل.
8. السائل المتهجم أو العدائي: لا تجارِ العدائية، حدّد محل السؤال، وأجب بحكمة ودقة دون تنازل عن المعلومة. السائل المخطئ في تصوره (مثل "لماذا يعبد المسلمون الكعبة؟"): صحّح التصور دون توبيخ.
9. راعِ مستوى السائل ولغته. أجب بلغة السائل. ابدأ بالأصل قبل الفرع. إن كان السائل لا يعرف المصطلح فعرّف المفهوم بلغة بسيطة أولاً ثم اذكر المصطلح.
10. الترجمة: لا تترجم المصطلحات الشرعية حرفياً. التوحيد = Tawhid (Oneness of God) مع شرح أنه إفراد الله بالربوبية والألوهية. الشريعة = Sharia (Islamic law and guidance). الحديث = Hadith. الفتوى = Fatwa. الدعوة = Da'wah. الوحي = Revelation. العبادة = Worship (تشمل أعمال القلب والقول والعمل).
11. الخصوصية: لا تطلب بيانات شخصية ولا تستنتج شيئاً دينياً عن المستخدم.
12. الأسلوب: مختصر، واضح، بتنسيق بسيط. اختم بسطر "المصادر:" يذكر المراجع المناسبة من القائمة (اسم المصدر ورابطه). وإن تعلقت الإجابة بحالة شخصية فاختم بالإحالة.

## التحقق الذاتي قبل الإرسال
قبل إرسال إجابتك، راجعها داخلياً:
1. هل كل معلومة شرعية منسوبة لمصدر من القائمة المعتمدة؟
2. هل تجنّبت القطع في المسائل الخلافية؟
3. هل الإجابة تناسب مستوى السائل (أ، ب، ج، د)؟
4. هل أنت متيقّن من نص الآية/الحديث؟ إن لا — اذكر المعنى وأحِل.
5. هل السؤال شخصي (مستوى د)؟ إن نعم — لم تُصدر حكماً، وأحِل للمختص.

إذا وجدت خللاً — صحّحه قبل الإرسال.`;

export async function POST(request) {
  try {
    const { question } = await request.json();

    if (!question || !question.trim()) {
      return Response.json({ error: 'السؤال مطلوب' }, { status: 400 });
    }
    if (question.length > 1500) {
      return Response.json({ error: 'السؤال طويل جداً' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is missing');
      return Response.json({ error: 'الخدمة غير مهيأة حالياً' }, { status: 500 });
    }

    const models = [
      process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite',
    ];

    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
    });

    let response, data;

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      for (let attempt = 1; attempt <= 2; attempt++) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body,
        });
        data = await response.json();

        if (response.ok) break;

        console.warn(
          `[${model}] attempt ${attempt} failed (${response.status})`,
          data.error?.message || ''
        );

        if (response.status !== 503) break;
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }

      if (response.ok) break;
    }

    if (!response.ok) {
      console.error('API Error:', response.status, JSON.stringify(data));
      const msg = [429, 503].includes(response.status)
        ? 'الخدمة عليها ضغط حالياً، حاول مرة أخرى بعد قليل.'
        : 'عذراً، حدث خطأ مؤقت. حاول مرة أخرى.';
      return Response.json({ error: msg }, { status: 500 });
    }

    const candidate = data.candidates?.[0];

    const answer =
      candidate?.content?.parts
        ?.filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join('') || 'لم أتمكن من توليد إجابة. يُرجى إعادة صياغة السؤال أو الرجوع إلى أهل العلم.';

    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('finishReason:', candidate.finishReason);
    }

    return Response.json({ answer, source: 'سند - أداة مدعومة بالذكاء الاصطناعي' });

  } catch (error) {
    console.error('Server Error:', error);
    return Response.json(
      { error: 'عذراً، حدث خطأ مؤقت. حاول مرة أخرى.' },
      { status: 500 }
    );
  }
}
const k = process.env.GEMINI_API_KEY;
const m = process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';

fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': k,
  },
  body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
})
  .then(async (r) => {
    console.log('=====STATUS:', r.status, '=====');
    console.log((await r.text()).slice(0, 300));
  })
  .catch((e) => console.log('=====ERROR:', e.message));
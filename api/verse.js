// Maps our translation names to bible-api.com identifiers (public domain only)
const FREE_TRANSLATIONS = { KJV: 'kjv' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { reference, translation = 'KJV', random = false } = req.body;
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  try {
    // ── KJV: use free bible-api.com ──────────────────────────────────────────
    if (FREE_TRANSLATIONS[translation]) {
      const t = FREE_TRANSLATIONS[translation];
      const url = random
        ? `https://bible-api.com/data/${t}/random`
        : `https://bible-api.com/${encodeURIComponent(reference)}?translation=${t}`;

      const r = await fetch(url);
      const data = await r.json();

      if (random) {
        // random endpoint returns { reference, text, verses: [{book_name, chapter, verse, text}] }
        const v = data.verses?.[0];
        return res.json({
          reference: `${v.book_name} ${v.chapter}:${v.verse}`,
          text: v.text.trim(),
          translation,
        });
      }

      if (data.error) return res.status(404).json({ error: data.error });
      return res.json({
        reference: data.reference,
        text: data.text.trim(),
        translation,
      });
    }

    // ── ESV / NLT / CSB: use Gemini ──────────────────────────────────────────
    const prompt = random
      ? `Give me one well-known Bible verse in the ${translation} translation. Reply with ONLY this JSON (no markdown): {"reference":"Book Chapter:Verse","text":"the verse text"}`
      : `Give me the exact text of ${reference} from the ${translation} Bible translation. Reply with ONLY this JSON (no markdown): {"reference":"${reference}","text":"the verse text"}`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.json({ ...parsed, translation });
  } catch (err) {
    console.error('verse api error', err);
    return res.status(500).json({ error: err.message });
  }
}

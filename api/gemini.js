export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { prompt } = req.body;
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  try {
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
    const text = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

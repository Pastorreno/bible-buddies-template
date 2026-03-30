export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { message } = req.body;
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    const payload = {
      system_instruction: {
        parts: [{ text: 'You are Bible Buddies, a knowledgeable and passionate Bible teacher in the tradition of expository preaching. You help people understand Scripture with depth, clarity, and practical application. Always point people back to the Word of God. Reference specific Bible verses when relevant.' }]
      },
      contents: [{ role: 'user', parts: [{ text: message }] }]
    };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.status(200).json({ reply: text || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

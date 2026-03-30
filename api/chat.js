const SYSTEM_INSTRUCTION =
    'You are Bible Buddies, a knowledgeable and passionate Bible teacher in the tradition of expository preaching. ' +
    'You help people understand Scripture with depth, clarity, and practical application. ' +
    'Always point people back to the Word of God. Reference specific Bible verses when relevant.';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method Not Allowed' });
    }

  try {
        const { message, history = [] } = req.body;

      if (!message) {
              return res.status(400).json({ error: 'Missing message in request body.' });
      }

      const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

      // Build conversation contents array from history + current message
      // history items: { role: 'user' | 'model', content: string }
      const contents = [
              ...history.map(item => ({
                        role: item.role === 'user' ? 'user' : 'model',
                        parts: [{ text: item.content }],
              })),
        {
                  role: 'user',
                  parts: [{ text: message }],
        },
            ];

      const payload = {
              system_instruction: {
                        parts: [{ text: SYSTEM_INSTRUCTION }],
              },
              contents,
      };

      const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
        }
            );

      const data = await response.json();

      if (!response.ok) {
              console.error('Gemini API error:', data);
              return res.status(500).json({ error: 'Gemini API error', details: data });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return res.status(200).json({ reply: text || null });
  } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: error.message });
  }
}

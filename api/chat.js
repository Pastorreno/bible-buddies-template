const SYSTEM_INSTRUCTION =
  'You are Bible Buddy, a knowledgeable Bible teacher in the tradition of expository preaching. ' +
  'For every question, respond using EXACTLY this structure — no exceptions:\n\n' +
  '**Short Answer**\n' +
  'One to three sentences directly answering the question.\n\n' +
  '**Scripture**\n' +
  'List 2–4 relevant Bible verses with their full reference (e.g., Romans 8:28, John 3:16). Quote each verse in full.\n\n' +
  '**Explanation**\n' +
  'Clear, plain-language explanation of the passage and its meaning in context.\n\n' +
  '**Application**\n' +
  'One practical way this truth applies to daily life today.\n\n' +
  '**Sources**\n' +
  'List 2–3 reputable references the user can consult to go deeper. Include: Bible commentaries, theologians, or study resources (e.g., Matthew Henry\'s Commentary, ESV Study Bible, John Stott, N.T. Wright). Format as a simple list.\n\n' +
  '**Suggested Next Question**\n' +
  'One follow-up question to deepen the study.\n\n' +
  'Always be warm, clear, and grounded in Scripture. Never speculate beyond what the Bible teaches.';

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

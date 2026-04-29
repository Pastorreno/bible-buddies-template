const SYSTEM_INSTRUCTION =
  'You are Bible Buddy, a knowledgeable Bible teacher in the tradition of expository preaching. ' +
  'Your answers are known for their depth — you do not give shallow summaries. You teach like a pastor who has studied for decades and genuinely loves the Word.\n\n' +
  'For every question, respond using EXACTLY this structure — no exceptions:\n\n' +
  '**Short Answer**\n' +
  'A direct, substantive answer to the question in 2–4 sentences. Be clear but do not oversimplify.\n\n' +
  '**Scripture**\n' +
  'List 3–5 relevant Bible verses with their full reference. Quote each verse in full. Choose verses that illuminate the topic from multiple angles — not just the obvious ones.\n\n' +
  '**Explanation**\n' +
  'This is the heart of your response. Give a rich, thorough explanation: unpack the original context, the meaning of key words or phrases, the theological significance, and how this passage fits into the larger biblical narrative. Write at least 3–5 substantial paragraphs. Do not rush this section.\n\n' +
  '**Application**\n' +
  'Give 2–3 specific, practical ways this truth applies to daily life today. Be concrete, not generic.\n\n' +
  '**Sources**\n' +
  'List 3–4 reputable references the user can consult to go deeper: Bible commentaries, theologians, or study resources (e.g., Matthew Henry\'s Commentary, ESV Study Bible, John Stott, N.T. Wright, D.A. Carson, Tim Keller). Format as a simple list.\n\n' +
  '**Suggested Next Question**\n' +
  'One compelling follow-up question that would naturally deepen the study.\n\n' +
  'Always be warm, precise, and grounded in Scripture. Depth is a feature, not a bug. Never speculate beyond what the Bible teaches.';

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

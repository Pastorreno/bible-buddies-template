const SYSTEM_INSTRUCTION =
  'You are Bible Buddy, a Bible teacher trained in expository preaching and systematic theology. ' +
  'You write like a commentary — precise, scholarly, yet accessible. You think in doctrines: every question connects to the larger system of biblical truth (theology proper, Christology, soteriology, pneumatology, eschatology, etc.). ' +
  'Your answers are known for depth. You do not give shallow summaries. You teach like a pastor-theologian who has spent decades in the text.\n\n' +
  'For every question, respond using EXACTLY this structure:\n\n' +
  '**Short Answer**\n' +
  'A direct, theologically precise answer in 2–4 sentences.\n\n' +
  '**Scripture**\n' +
  'List 3–5 key passages with full references. Quote each verse in full. Select passages that speak to the topic from multiple angles — include both direct and cross-reference texts.\n\n' +
  '**Commentary & Systematic Theology**\n' +
  'This is the core of your response. Write like a commentary entry:\n' +
  '- Unpack the passage in its original historical and literary context\n' +
  '- Examine key words or phrases (reference Greek/Hebrew where meaningful)\n' +
  '- Connect the text to its doctrinal category (e.g., "This passage speaks to the doctrine of justification...")\n' +
  '- Trace the theme through redemptive history (OT foundation → NT fulfillment where applicable)\n' +
  '- Note where major theological traditions agree or differ (Reformed, Arminian, Catholic, etc.) if relevant\n' +
  'Write at least 4–6 substantial paragraphs. Do not rush this section.\n\n' +
  '**Application**\n' +
  'Give 2–3 specific, concrete applications for daily life. Ground each one in the doctrine just explained.\n\n' +
  '**Sources**\n' +
  'List 3–5 commentaries, systematic theologies, or theologians the user can consult. Prefer primary scholarly sources: Matthew Henry, John Calvin, Charles Spurgeon, D.A. Carson, N.T. Wright, Wayne Grudem (Systematic Theology), John Stott, Tim Keller, Thomas Aquinas where relevant.\n\n' +
  '**Suggested Next Question**\n' +
  'One follow-up question that naturally advances the theological study.\n\n' +
  'Tone: warm, pastoral, intellectually serious. Depth is the product. Never speculate beyond Scripture.';


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

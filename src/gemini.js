export async function callGemini(prompt) {
  const r = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.text || '';
}

import React, { useState } from 'react';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function studyWord(word, reference, translation) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const prompt =
    `You are a biblical language scholar. A student tapped the word "${word}" in ${reference} (${translation}).\n\n` +
    `Provide a concise word study. Reply with ONLY this JSON (no markdown):\n` +
    `{"word":"${word}","original":"the Greek or Hebrew word (transliterated)","language":"Greek or Hebrew","strongs":"Strong's number e.g. G26","literal":"literal meaning","definition":"clear 1-2 sentence definition","usage":"how this word is used elsewhere in Scripture — 2-3 key examples with references","significance":"1-2 sentences on why this word matters in this specific verse","disclaimer":"Always verify with a Strong's concordance or lexicon (BDAG for Greek, BDB for Hebrew)."}`;

  const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  const data = await r.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

export default function WordStudy({ reference, verseText, translation, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);
  const [error, setError] = useState('');

  const handleWordTap = async (word) => {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (clean.length < 2) return;
    setSelectedWord(clean);
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const data = await studyWord(clean, reference, translation);
      setResult(data);
    } catch {
      setError('Could not load word study. Try another word.');
    }
    setLoading(false);
  };

  const words = verseText.split(/(\s+)/);

  return (
    <div className="word-study-panel">
      <div className="word-study-header">
        <span className="section-label" style={{ margin: 0 }}>WORD STUDY · {reference}</span>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Tap any word to study the original language</p>

      {/* Tappable verse */}
      <div className="word-study-verse">
        {words.map((w, i) =>
          /\s+/.test(w) ? <span key={i}>{w}</span> : (
            <span key={i}
              className={`tappable-word ${selectedWord === w.replace(/[^a-zA-Z]/g, '') ? 'selected' : ''}`}
              onClick={() => handleWordTap(w)}>
              {w}
            </span>
          )
        )}
      </div>

      {loading && (
        <div className="typing-dots" style={{ marginTop: 12 }}><span /><span /><span /></div>
      )}

      {error && <p className="scripture-error">{error}</p>}

      {result && (
        <div className="word-study-result">
          <div className="word-study-original">
            <span className="word-study-term">{result.original}</span>
            <span className="word-study-lang">{result.language} · {result.strongs}</span>
          </div>
          <p className="word-study-literal">"{result.literal}"</p>
          <p className="word-study-def">{result.definition}</p>

          <div style={{ marginTop: 12 }}>
            <span className="section-label">USED ELSEWHERE</span>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, marginTop: 4 }}>{result.usage}</p>
          </div>

          <div style={{ marginTop: 10 }}>
            <span className="section-label">WHY IT MATTERS HERE</span>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, marginTop: 4, fontStyle: 'italic' }}>{result.significance}</p>
          </div>

          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, fontStyle: 'italic' }}>⚠️ {result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

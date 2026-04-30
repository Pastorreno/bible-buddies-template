import { callGemini } from './gemini';
import React, { useState } from 'react';

const CATECHISMS = [
  { id: 'westminster', label: 'Westminster Shorter Catechism', tradition: 'Reformed/Presbyterian' },
  { id: 'heidelberg', label: 'Heidelberg Catechism', tradition: 'Reformed' },
  { id: 'baptist', label: 'Baptist Catechism (Keach)', tradition: 'Baptist' },
  { id: 'custom', label: 'Custom Question', tradition: 'Any tradition' },
];

async function askCatechism(question, catechism, translation) {
  const catRef = catechism !== 'custom'
    ? `Reference the ${CATECHISMS.find(c => c.id === catechism)?.label} where relevant.`
    : '';

  const prompt =
    `You are a catechism teacher using the historical-grammatical method. Answer this doctrinal question in classic catechism format.\n\n` +
    `Question: "${question}"\n` +
    `Translation: ${translation}\n` +
    `${catRef}\n\n` +
    `Reply with ONLY this JSON (no markdown):\n` +
    `{"question":"restate the question clearly","answer":"the catechism-style answer in 1-3 sentences","proof_texts":[{"reference":"Book Chapter:Verse","text":"full verse text","explanation":"one sentence on why this verse proves the answer"}],"historical_note":"1-2 sentences on the historical context of this doctrine — when was it defined, why, against what error","deeper":"2-3 sentences going deeper for the scholar","disclaimer":"Always verify through personal study of Scripture and the primary catechism sources."}`;

  const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  const data = await r.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

const STARTER_QUESTIONS = [
  "What is the chief end of man?",
  "What is God?",
  "What is justification?",
  "What is sanctification?",
  "What is the Trinity?",
  "What is the Gospel?",
  "What is repentance?",
  "What is saving faith?",
];

export default function CatechismTab({ translation, onBack }) {
  const [catechism, setCatechism] = useState('westminster');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const ask = async (q) => {
    const text = q || question.trim();
    if (!text) return;
    setLoading(true);
    setError('');
    setResult(null);
    setExpanded(false);
    try {
      const data = await askCatechism(text, catechism, translation);
      setResult(data);
    } catch {
      setError('Could not generate answer. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>CATECHISM</span>
      </div>

      {/* Catechism selector */}
      <div className="form-group">
        <label className="form-label">Tradition</label>
        <select className="scripture-select" value={catechism} onChange={e => setCatechism(e.target.value)}>
          {CATECHISMS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      {/* Question input */}
      <div className="lookup-row">
        <input className="scripture-input" placeholder="Ask a doctrinal question…"
          value={question} onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()} />
        <button className="scripture-btn" onClick={() => ask()} disabled={loading || !question.trim()}>
          {loading ? '…' : 'Ask'}
        </button>
      </div>

      {/* Starter questions */}
      {!result && !loading && (
        <div className="suggestions" style={{ marginTop: 4 }}>
          {STARTER_QUESTIONS.map((q, i) => (
            <button key={i} className="suggestion-chip" onClick={() => { setQuestion(q); ask(q); }}>{q}</button>
          ))}
        </div>
      )}

      {error && <p className="scripture-error">{error}</p>}

      {loading && (
        <div className="assess-start" style={{ flex: 'none', padding: '20px 0' }}>
          <div className="typing-dots"><span /><span /><span /></div>
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Q&A */}
          <div className="catechism-card">
            <p className="catechism-q">Q: {result.question}</p>
            <p className="catechism-a">A: {result.answer}</p>
          </div>

          {/* Proof texts */}
          <div className="scripture-section">
            <span className="section-label">PROOF TEXTS</span>
            {result.proof_texts?.map((pt, i) => (
              <div key={i} style={{ marginTop: 10, paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <p className="verse-result-ref">{pt.reference}</p>
                <p className="verse-result-text">"{pt.text}"</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>{pt.explanation}</p>
              </div>
            ))}
          </div>

          {/* Historical note */}
          {result.historical_note && (
            <div className="scripture-section">
              <span className="section-label">HISTORICAL CONTEXT</span>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, marginTop: 4 }}>{result.historical_note}</p>
            </div>
          )}

          {/* Deeper */}
          <button className="commentary-toggle" onClick={() => setExpanded(p => !p)} style={{ textAlign: 'left' }}>
            {expanded ? '▲' : '▼'} Go Deeper
          </button>
          {expanded && result.deeper && (
            <div className="scripture-section">
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7 }}>{result.deeper}</p>
            </div>
          )}

          {/* Disclaimer */}
          <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 8px' }}>
            ⚠️ {result.disclaimer}
          </p>

          <button className="back-btn" style={{ alignSelf: 'center' }} onClick={() => { setResult(null); setQuestion(''); }}>
            Ask Another
          </button>
        </div>
      )}
    </div>
  );
}

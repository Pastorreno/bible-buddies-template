import React, { useState, useEffect } from 'react';

const JOURNAL_KEY = 'bible_buddy_prayers_v1';

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function loadPrayers() { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY)) || []; } catch { return []; } }
function savePrayers(p) { localStorage.setItem(JOURNAL_KEY, JSON.stringify(p)); }

const CATEGORIES = ['Praise', 'Confession', 'Thanksgiving', 'Supplication', 'Intercession'];

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function getPrayerInsight(prayers, translation) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const summary = prayers.slice(0, 20).map(p =>
    `[${p.category}] ${p.passage ? p.passage + ': ' : ''}${p.request}`
  ).join('\n');

  const prompt =
    `A person has logged these prayer requests:\n${summary}\n\n` +
    `Using the ${translation} Bible, provide:\n` +
    `1. A brief observation about patterns in their prayer life (2-3 sentences)\n` +
    `2. One Scripture that speaks to their most common prayer theme\n` +
    `3. One encouragement from the historical-grammatical perspective\n\n` +
    `Reply with ONLY this JSON (no markdown):\n` +
    `{"pattern":"observation","scripture":{"reference":"Book Chapter:Verse","text":"full verse"},"encouragement":"one paragraph","disclaimer":"Prayer is personal communion with God. These observations are meant to encourage, not prescribe."}`;

  const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  const data = await r.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

export default function PrayerJournal({ translation, onBack }) {
  const [prayers, setPrayers] = useState(() => loadPrayers());
  const [view, setView] = useState('list'); // 'list' | 'add' | 'insight'

  // Add form
  const [request, setRequest] = useState('');
  const [passage, setPassage] = useState('');
  const [category, setCategory] = useState('Supplication');
  const [answered, setAnswered] = useState(false);

  // Insight
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const persist = (updated) => { setPrayers(updated); savePrayers(updated); };

  const addPrayer = () => {
    if (!request.trim()) return;
    const p = { id: makeId(), request: request.trim(), passage: passage.trim(), category, answered: false, date: Date.now() };
    persist([p, ...prayers]);
    setRequest(''); setPassage(''); setCategory('Supplication'); setAnswered(false);
    setView('list');
  };

  const toggleAnswered = (id) => {
    persist(prayers.map(p => p.id === id ? { ...p, answered: !p.answered } : p));
  };

  const deletePrayer = (id) => {
    persist(prayers.filter(p => p.id !== id));
  };

  const loadInsight = async () => {
    if (prayers.length < 3) return;
    setInsightLoading(true);
    setInsight(null);
    setView('insight');
    try {
      const data = await getPrayerInsight(prayers, translation);
      setInsight(data);
    } catch { setInsight(null); }
    setInsightLoading(false);
  };

  const active = prayers.filter(p => !p.answered);
  const answered_list = prayers.filter(p => p.answered);

  const categoryCount = CATEGORIES.reduce((acc, c) => {
    acc[c] = prayers.filter(p => p.category === c).length;
    return acc;
  }, {});

  // ── Add prayer ──────────────────────────────────────────────────────────────
  if (view === 'add') return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={() => setView('list')}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>NEW PRAYER</span>
      </div>
      <div className="builder-form">
        <div className="form-group">
          <label className="form-label">Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={category === c ? 'scripture-btn' : 'back-btn'}
                style={{ padding: '5px 12px', fontSize: 12 }}>{c}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Prayer Request</label>
          <textarea className="scripture-input" rows={4} placeholder="Write your prayer request…"
            value={request} onChange={e => setRequest(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Passage (optional)</label>
          <input className="scripture-input" placeholder="e.g. Philippians 4:6-7"
            value={passage} onChange={e => setPassage(e.target.value)} />
        </div>
        <button className="scripture-btn" style={{ width: '100%', padding: 12, fontSize: 14 }}
          onClick={addPrayer} disabled={!request.trim()}>
          Log Prayer
        </button>
      </div>
    </div>
  );

  // ── Insight ─────────────────────────────────────────────────────────────────
  if (view === 'insight') return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={() => setView('list')}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>PRAYER PATTERNS</span>
      </div>
      {insightLoading && (
        <div className="assess-start" style={{ flex: 'none', padding: '20px 0' }}>
          <div className="typing-dots"><span /><span /><span /></div>
        </div>
      )}
      {insight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="scripture-section">
            <span className="section-label">PATTERN OBSERVED</span>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, marginTop: 4 }}>{insight.pattern}</p>
          </div>
          {insight.scripture && (
            <div className="scripture-section">
              <span className="section-label">SCRIPTURE FOR YOUR JOURNEY</span>
              <p className="verse-result-ref" style={{ marginTop: 6 }}>{insight.scripture.reference}</p>
              <p className="verse-result-text">"{insight.scripture.text}"</p>
            </div>
          )}
          <div className="scripture-section">
            <span className="section-label">ENCOURAGEMENT</span>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 4 }}>{insight.encouragement}</p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center' }}>⚠️ {insight.disclaimer}</p>
        </div>
      )}
    </div>
  );

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="section-label" style={{ margin: 0, flex: 1 }}>PRAYER JOURNAL</span>
        <button className="scripture-btn" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setView('add')}>+ Add</button>
      </div>

      {/* Category breakdown */}
      {prayers.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.filter(c => categoryCount[c] > 0).map(c => (
            <span key={c} style={{ fontSize: 11, background: 'var(--border)', borderRadius: 12, padding: '3px 10px', color: 'var(--ink-2)' }}>
              {c} {categoryCount[c]}
            </span>
          ))}
          {prayers.length >= 3 && (
            <button className="ask-buddy-inline" onClick={loadInsight} style={{ fontSize: 11 }}>✨ See Patterns</button>
          )}
        </div>
      )}

      {prayers.length === 0 ? (
        <div className="assess-start" style={{ flex: 'none', padding: '20px 0' }}>
          <span style={{ fontSize: '2rem' }}>🙏</span>
          <p className="assess-desc">Log your first prayer request to begin your journal.</p>
          <button className="scripture-btn assess-start-btn" onClick={() => setView('add')}>Add Prayer</button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <span className="section-label">ACTIVE ({active.length})</span>
              <div className="sermon-cue-list">
                {active.map(p => (
                  <div key={p.id} className="sermon-cue-item" style={{ cursor: 'default' }}>
                    <div className="sermon-cue-body" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, background: 'var(--border)', borderRadius: 10, padding: '2px 8px', color: 'var(--ink-2)' }}>{p.category}</span>
                        {p.passage && <span style={{ fontSize: 10, color: 'var(--crimson)', fontWeight: 600 }}>{p.passage}</span>}
                      </div>
                      <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p.request}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{new Date(p.date).toLocaleDateString()}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button className="scripture-btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => toggleAnswered(p.id)}>✓ Answered</button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }} onClick={() => deletePrayer(p.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {answered_list.length > 0 && (
            <>
              <span className="section-label" style={{ marginTop: 8 }}>ANSWERED 🙌 ({answered_list.length})</span>
              <div className="sermon-cue-list">
                {answered_list.map(p => (
                  <div key={p.id} className="sermon-cue-item" style={{ cursor: 'default', opacity: 0.7 }}>
                    <div className="sermon-cue-body" style={{ flex: 1 }}>
                      <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p.request}</p>
                      {p.passage && <p style={{ fontSize: 11, color: 'var(--crimson)', marginTop: 2 }}>{p.passage}</p>}
                    </div>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, flexShrink: 0 }} onClick={() => deletePrayer(p.id)}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

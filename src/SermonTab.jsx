import React, { useState, useEffect, useCallback } from 'react';

const CHANNEL = 'bible_buddy_present';

async function buildCueList(topic, passage, translation) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const prompt =
    `You are helping a pastor prepare a sermon presentation. ` +
    `Create an ordered cue list of 6-10 Bible verses for a sermon on: "${topic || passage}".\n` +
    `Use the ${translation} translation.\n` +
    `Reply with ONLY this JSON (no markdown):\n` +
    `{"title":"Sermon Title","cues":[{"reference":"Book Chapter:Verse","text":"full verse text","note":"one-line preaching note"}]}`;

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
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Projector window content (rendered in the popup) ─────────────────────────
function ProjectorPage() {
  const [slide, setSlide] = useState(null);

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => setSlide(e.data);
    return () => ch.close();
  }, []);

  return (
    <div style={{
      background: '#0a0a0a', color: '#fff', height: '100vh', width: '100vw',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '8vw', boxSizing: 'border-box',
      fontFamily: 'Georgia, serif',
    }}>
      {!slide ? (
        <p style={{ color: '#444', fontSize: '1.5rem' }}>Waiting for presenter…</p>
      ) : slide.blank ? (
        <div />
      ) : (
        <>
          <p style={{
            fontSize: 'clamp(2rem, 5vw, 4rem)', lineHeight: 1.5,
            textAlign: 'center', marginBottom: '2rem', fontStyle: 'italic',
            color: '#f5f0e8',
          }}>
            "{slide.text}"
          </p>
          <p style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.8rem)', color: '#c9a84c',
            letterSpacing: '0.08em', fontStyle: 'normal',
          }}>
            — {slide.reference} <span style={{ color: '#666', fontSize: '0.75em' }}>({slide.translation})</span>
          </p>
          {slide.title && (
            <p style={{ position: 'absolute', top: 24, left: 32, color: '#444', fontSize: '0.9rem', letterSpacing: '0.1em' }}>
              {slide.title}
            </p>
          )}
          <p style={{ position: 'absolute', bottom: 24, right: 32, color: '#333', fontSize: '0.85rem' }}>
            {slide.index + 1} / {slide.total}
          </p>
        </>
      )}
    </div>
  );
}

// ── Main SermonTab ────────────────────────────────────────────────────────────
export default function SermonTab({ translation }) {
  const [topic, setTopic] = useState('');
  const [passage, setPassage] = useState('');
  const [sermon, setSermon] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(0);
  const [projector, setProjector] = useState(null);
  const [channel] = useState(() => new BroadcastChannel(CHANNEL));

  // If this page is the projector popup
  const isProjector = window.location.hash === '#projector';
  if (isProjector) return <ProjectorPage />;

  const broadcast = useCallback((idx, blank = false) => {
    if (!sermon) return;
    const cue = sermon.cues[idx];
    channel.postMessage(blank ? { blank: true } : {
      reference: cue.reference,
      text: cue.text,
      translation,
      title: sermon.title,
      index: idx,
      total: sermon.cues.length,
    });
  }, [sermon, channel, translation]);

  const openProjector = () => {
    const win = window.open(window.location.href.split('#')[0] + '#projector', 'projector',
      'width=1280,height=720,menubar=no,toolbar=no,location=no');
    setProjector(win);
    // Send current slide after a short delay for the window to load
    setTimeout(() => broadcast(current), 800);
  };

  const go = (idx) => {
    setCurrent(idx);
    broadcast(idx);
  };

  const prev = () => go(Math.max(0, current - 1));
  const next = () => go(Math.min(sermon.cues.length - 1, current + 1));

  // Keyboard control
  useEffect(() => {
    if (!sermon) return;
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sermon, current]);

  const generate = async () => {
    if (!topic.trim() && !passage.trim()) return;
    setLoading(true);
    setError('');
    setSermon(null);
    setCurrent(0);
    try {
      const data = await buildCueList(topic, passage, translation);
      setSermon(data);
    } catch {
      setError('Could not generate cue list. Please try again.');
    }
    setLoading(false);
  };

  // ── Builder screen ──────────────────────────────────────────────────────────
  if (!sermon && !loading) return (
    <div className="assess-tab">
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <span style={{ fontSize: '2.5rem' }}>📽</span>
        <h2 className="assess-title">Sermon Presenter</h2>
        <p className="assess-desc">Enter your sermon topic or key passage. Bible Buddy will build a verse cue list ready to present.</p>
      </div>
      <div className="builder-form">
        <div className="form-group">
          <label className="form-label">Sermon Topic</label>
          <input className="scripture-input" placeholder="e.g. The Grace of God, Redemption, Faith"
            value={topic} onChange={e => setTopic(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Key Passage (optional)</label>
          <input className="scripture-input" placeholder="e.g. Romans 8, John 15:1-17"
            value={passage} onChange={e => setPassage(e.target.value)} />
        </div>
        {error && <p className="scripture-error">{error}</p>}
        <button className="scripture-btn" style={{ width: '100%', padding: 12, fontSize: 14 }}
          onClick={generate} disabled={!topic.trim() && !passage.trim()}>
          Build Cue List
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="assess-tab">
      <div className="assess-start">
        <div className="typing-dots"><span /><span /><span /></div>
        <p className="assess-desc" style={{ marginTop: 12 }}>Building your sermon cue list…</p>
      </div>
    </div>
  );

  // ── Operator view ───────────────────────────────────────────────────────────
  const cue = sermon.cues[current];

  return (
    <div className="sermon-operator">
      {/* Header */}
      <div className="sermon-header">
        <div>
          <p className="sermon-title-label">{sermon.title}</p>
          <p className="sermon-sub">{translation} · {sermon.cues.length} slides</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="scripture-btn" onClick={openProjector} style={{ fontSize: 12 }}>
            📽 Open Projector
          </button>
          <button className="back-btn" onClick={() => { setSermon(null); channel.postMessage({ blank: true }); }}>
            New
          </button>
        </div>
      </div>

      {/* Current slide preview */}
      <div className="sermon-preview">
        <p className="sermon-preview-ref">{cue.reference}</p>
        <p className="sermon-preview-text">"{cue.text}"</p>
        {cue.note && <p className="sermon-preview-note">📝 {cue.note}</p>}
      </div>

      {/* Prev / Next controls */}
      <div className="sermon-controls">
        <button className="sermon-nav-btn" onClick={prev} disabled={current === 0}>◀ Prev</button>
        <span className="sermon-counter">{current + 1} / {sermon.cues.length}</span>
        <button className="sermon-nav-btn" onClick={next} disabled={current === sermon.cues.length - 1}>Next ▶</button>
      </div>

      {/* Cue list */}
      <div className="sermon-cue-list">
        {sermon.cues.map((c, i) => (
          <button key={i} className={`sermon-cue-item ${i === current ? 'active' : ''}`} onClick={() => go(i)}>
            <span className="sermon-cue-num">{i + 1}</span>
            <div className="sermon-cue-body">
              <p className="sermon-cue-ref">{c.reference}</p>
              <p className="sermon-cue-text">{c.text.slice(0, 80)}{c.text.length > 80 ? '…' : ''}</p>
            </div>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>
        Use ← → arrow keys to advance slides
      </p>
    </div>
  );
}

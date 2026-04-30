import { callGemini } from './gemini';
import React, { useState, useEffect, useCallback } from 'react';

const CHANNEL = 'bible_buddy_present';

async function fetchVerseText(reference, translation) {
  const r = await fetch('/api/verse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, translation }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return { reference: d.reference, text: d.text };
}

async function suggestVerses(topic, translation, existing) {
  const used = existing.map(c => c.reference).join(', ');
  const prompt =
    `A pastor is preaching on "${topic}". They already have: ${used || 'no verses yet'}.\n` +
    `Suggest 4 additional Bible verses that would complement this sermon.\n` +
    `Use the ${translation} translation. Reply ONLY with this JSON (no markdown):\n` +
    `{"suggestions":[{"reference":"Book Chapter:Verse","text":"full verse text","reason":"one sentence why this fits"}]}`;

  const raw = await callGemini(prompt);
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// ── Projector window ──────────────────────────────────────────────────────────
function ProjectorPage() {
  const [slide, setSlide] = useState(null);
  const [bg, setBg] = useState(null);

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => {
      setSlide(e.data);
      // Generate background when title arrives for the first time
      if (e.data?.title && !bg) {
        fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `A cinematic, reverent, photorealistic background image for a church sermon titled "${e.data.title}". Soft light, sacred atmosphere, no text, no people, suitable as a dark presentation background. Muted tones, dramatic lighting.`,
          }),
        })
          .then(r => r.json())
          .then(d => { if (d.image) setBg(`data:${d.mimeType};base64,${d.image}`); })
          .catch(() => {});
      }
    };
    return () => ch.close();
  }, [bg]);

  return (
    <div style={{
      background: bg ? `url(${bg}) center/cover no-repeat` : '#0a0a0a',
      height: '100vh', width: '100vw', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '8vw', boxSizing: 'border-box',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Dark overlay so text stays readable over any image */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.62)' }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%' }}>
        {!slide ? (
          <p style={{ color: '#444', fontSize: '1.5rem' }}>Waiting for presenter…</p>
        ) : slide.blank ? null : (
          <>
            <p style={{ fontSize: 'clamp(1.8rem,4.5vw,3.8rem)', lineHeight: 1.55, textAlign: 'center', marginBottom: '2rem', fontStyle: 'italic', color: '#f5f0e8' }}>
              "{slide.text}"
            </p>
            <p style={{ fontSize: 'clamp(1rem,2.5vw,1.8rem)', color: '#c9a84c', letterSpacing: '0.08em' }}>
              — {slide.reference} <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75em' }}>({slide.translation})</span>
            </p>
            {slide.note && (
              <p style={{ position: 'absolute', bottom: 60, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 'clamp(0.8rem,1.5vw,1.1rem)', fontStyle: 'italic' }}>
                {slide.note}
              </p>
            )}
            {slide.title && (
              <p style={{ position: 'absolute', top: 24, left: 32, color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', letterSpacing: '0.1em' }}>{slide.title}</p>
            )}
            <p style={{ position: 'absolute', bottom: 24, right: 32, color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>
              {slide.index + 1} / {slide.total}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SermonTab({ translation }) {
  const [title, setTitle] = useState('');
  const [cues, setCues] = useState([]);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState('build'); // 'build' | 'present'
  const [channel] = useState(() => new BroadcastChannel(CHANNEL));

  // Add verse state
  const [refInput, setRefInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // AI suggest state
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Editing note inline
  const [editingNote, setEditingNote] = useState(null);
  const [editNoteVal, setEditNoteVal] = useState('');

  if (window.location.hash === '#projector') return <ProjectorPage />;

  const broadcast = useCallback((idx, blank = false) => {
    if (!cues.length) return;
    const cue = cues[idx];
    channel.postMessage(blank ? { blank: true } : {
      reference: cue.reference, text: cue.text,
      note: cue.note, translation, title, index: idx, total: cues.length,
    });
  }, [cues, channel, translation, title]);

  const go = (idx) => { setCurrent(idx); broadcast(idx); };
  const prev = () => go(Math.max(0, current - 1));
  const next = () => go(Math.min(cues.length - 1, current + 1));

  useEffect(() => {
    if (mode !== 'present' || !cues.length) return;
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, cues, current]);

  const addVerse = async () => {
    if (!refInput.trim()) return;
    setAddLoading(true);
    setAddError('');
    try {
      const { reference, text } = await fetchVerseText(refInput.trim(), translation);
      setCues(prev => [...prev, { id: makeId(), reference, text, note: noteInput.trim() }]);
      setRefInput('');
      setNoteInput('');
    } catch {
      setAddError('Verse not found. Try "John 3:16" or "Romans 8:1-4".');
    }
    setAddLoading(false);
  };

  const removeVerse = (id) => {
    setCues(prev => {
      const next = prev.filter(c => c.id !== id);
      if (current >= next.length) setCurrent(Math.max(0, next.length - 1));
      return next;
    });
  };

  const moveUp = (i) => {
    if (i === 0) return;
    setCues(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; });
  };

  const moveDown = (i) => {
    setCues(prev => {
      if (i >= prev.length - 1) return prev;
      const a = [...prev]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a;
    });
  };

  const saveNote = (id) => {
    setCues(prev => prev.map(c => c.id === id ? { ...c, note: editNoteVal } : c));
    setEditingNote(null);
  };

  const getSuggestions = async () => {
    setSuggestLoading(true);
    setSuggestions(null);
    try {
      const data = await suggestVerses(title || 'this sermon', translation, cues);
      setSuggestions(data.suggestions);
    } catch { setSuggestions([]); }
    setSuggestLoading(false);
  };

  const addSuggestion = (s) => {
    setCues(prev => [...prev, { id: makeId(), reference: s.reference, text: s.text, note: '' }]);
    setSuggestions(prev => prev.filter(x => x.reference !== s.reference));
  };

  const openProjector = () => {
    window.open(window.location.href.split('#')[0] + '#projector', 'projector',
      'width=1280,height=720,menubar=no,toolbar=no,location=no');
    setTimeout(() => broadcast(current), 800);
  };

  // ── Build mode ──────────────────────────────────────────────────────────────
  if (mode === 'build') return (
    <div className="sermon-operator">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="scripture-input"
          placeholder="Sermon title…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, fontWeight: 600 }}
        />
        {cues.length > 0 && (
          <button className="scripture-btn" onClick={() => { setMode('present'); broadcast(0); setCurrent(0); }}>
            Present ▶
          </button>
        )}
      </div>

      {/* Add verse */}
      <div className="scripture-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="section-label">ADD VERSE</span>
        <div className="lookup-row">
          <input className="scripture-input" placeholder="Reference (e.g. John 3:16)"
            value={refInput} onChange={e => setRefInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addVerse()} />
          <button className="scripture-btn" onClick={addVerse} disabled={addLoading || !refInput.trim()}>
            {addLoading ? '…' : 'Add'}
          </button>
        </div>
        <input className="scripture-input" placeholder="Preaching note (optional)"
          value={noteInput} onChange={e => setNoteInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addVerse()} />
        {addError && <p className="scripture-error">{addError}</p>}
      </div>

      {/* AI suggest */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="ask-buddy-inline" onClick={getSuggestions} disabled={suggestLoading}
          style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}>
          {suggestLoading ? '…' : '✨ AI: Suggest related verses'}
        </button>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="scripture-section">
          <span className="section-label">SUGGESTIONS — tap to add</span>
          {suggestions.map((s, i) => (
            <div key={i} className="search-result-item" style={{ marginTop: 8 }}>
              <div className="search-result-header">
                <span className="verse-result-ref">{s.reference}</span>
                <button className="scripture-btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => addSuggestion(s)}>+ Add</button>
              </div>
              <p className="verse-result-text">{s.text}</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>{s.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cue list */}
      {cues.length === 0 ? (
        <div className="assess-start" style={{ flex: 'none', padding: '24px 0' }}>
          <span style={{ fontSize: '2rem' }}>📋</span>
          <p className="assess-desc">Add verses above to build your cue list.</p>
        </div>
      ) : (
        <div className="sermon-cue-list">
          <span className="section-label">CUE LIST ({cues.length} slides)</span>
          {cues.map((c, i) => (
            <div key={c.id} className="sermon-cue-item" style={{ flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sermon-cue-num">{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p className="sermon-cue-ref">{c.reference}</p>
                  <p className="sermon-cue-text">{c.text.slice(0, 70)}{c.text.length > 70 ? '…' : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="topic-menu-actions" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }} onClick={() => moveUp(i)} title="Move up">↑</button>
                  <button className="topic-menu-actions" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }} onClick={() => moveDown(i)} title="Move down">↓</button>
                  <button className="topic-menu-actions" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}
                    onClick={() => { setEditingNote(c.id); setEditNoteVal(c.note || ''); }} title="Edit note">✎</button>
                  <button className="topic-menu-actions" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--crimson)' }} onClick={() => removeVerse(c.id)} title="Remove">✕</button>
                </div>
              </div>
              {editingNote === c.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="scripture-input" style={{ flex: 1, fontSize: 12 }}
                    value={editNoteVal} onChange={e => setEditNoteVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveNote(c.id)} autoFocus />
                  <button className="scripture-btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => saveNote(c.id)}>Save</button>
                </div>
              ) : c.note ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', paddingLeft: 26 }}>📝 {c.note}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Present mode ────────────────────────────────────────────────────────────
  const cue = cues[current];
  return (
    <div className="sermon-operator">
      <div className="sermon-header">
        <div>
          <p className="sermon-title-label">{title || 'Sermon'}</p>
          <p className="sermon-sub">{translation} · {cues.length} slides</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="scripture-btn" onClick={openProjector} style={{ fontSize: 12 }}>📽 Projector</button>
          <button className="back-btn" onClick={() => { setMode('build'); channel.postMessage({ blank: true }); }}>Edit</button>
        </div>
      </div>

      <div className="sermon-preview">
        <p className="sermon-preview-ref">{cue.reference}</p>
        <p className="sermon-preview-text">"{cue.text}"</p>
        {cue.note && <p className="sermon-preview-note">📝 {cue.note}</p>}
      </div>

      <div className="sermon-controls">
        <button className="sermon-nav-btn" onClick={prev} disabled={current === 0}>◀ Prev</button>
        <span className="sermon-counter">{current + 1} / {cues.length}</span>
        <button className="sermon-nav-btn" onClick={next} disabled={current === cues.length - 1}>Next ▶</button>
      </div>

      <div className="sermon-cue-list">
        {cues.map((c, i) => (
          <button key={c.id} className={`sermon-cue-item ${i === current ? 'active' : ''}`} onClick={() => go(i)}>
            <span className="sermon-cue-num">{i + 1}</span>
            <div className="sermon-cue-body">
              <p className="sermon-cue-ref">{c.reference}</p>
              <p className="sermon-cue-text">{c.text.slice(0, 80)}{c.text.length > 80 ? '…' : ''}</p>
            </div>
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '4px 0 8px' }}>← → arrow keys to advance</p>
    </div>
  );
}

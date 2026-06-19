import React, { useState, useEffect, useCallback, useRef } from 'react';
import { callGemini } from './gemini';
import { supabase, makeSessionId } from './supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

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

function parseNotesText(raw) {
  // Split on blank lines or "---" dividers; detect headings (lines ending with ":")
  const blocks = raw.split(/\n(?:\s*\n)+|^---$/m).map(b => b.trim()).filter(Boolean);
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const first = lines[0] || '';
    // If first line looks like a heading (short, ends with : or ALL CAPS)
    const isHeading = first.endsWith(':') || (first === first.toUpperCase() && first.length < 60);
    if (lines.length === 1) {
      return { id: uid(), type: 'note', heading: '', body: first };
    }
    return {
      id: uid(), type: 'note',
      heading: isHeading ? first.replace(/:$/, '') : '',
      body: isHeading ? lines.slice(1).join(' ') : lines.join(' '),
    };
  });
}

async function suggestVerses(topic, translation, existing) {
  const used = existing.filter(s => s.type === 'verse').map(c => c.reference).join(', ');
  const prompt =
    `A pastor is preaching on "${topic}". They already have: ${used || 'no verses yet'}.\n` +
    `Suggest 4 Bible verses that would complement this sermon.\n` +
    `Use the ${translation} translation. Reply ONLY with this JSON (no markdown):\n` +
    `{"suggestions":[{"reference":"Book Chapter:Verse","text":"full verse text","reason":"one sentence why this fits"}]}`;
  const raw = await callGemini(prompt);
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Session sync ──────────────────────────────────────────────────────────────
async function pushSession(sessionId, title, slides, currentSlide, isBlank) {
  if (!supabase || !sessionId) return;
  await supabase.from('bb_sessions').upsert({
    id: sessionId, title, slides, current_slide: currentSlide,
    is_blank: isBlank, updated_at: new Date().toISOString(),
  });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PresentTab({ translation }) {
  const [mode, setMode] = useState('build'); // 'build' | 'present'
  const [title, setTitle] = useState('');
  const [slides, setSlides] = useState([]);
  const [current, setCurrent] = useState(0);
  const [isBlank, setIsBlank] = useState(false);
  const [sessionId] = useState(makeSessionId);

  // Add verse
  const [refInput, setRefInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Add notes
  const [notesInput, setNotesInput] = useState('');
  const [addMode, setAddMode] = useState('verse'); // 'verse' | 'notes' | 'title'
  const [titleInput, setTitleInput] = useState('');

  // AI suggestions
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Editing
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const fileRef = useRef();

  // Sync to Supabase whenever state changes in present mode
  useEffect(() => {
    if (mode === 'present' && slides.length > 0) {
      pushSession(sessionId, title, slides, current, isBlank);
    }
  }, [mode, slides, current, isBlank, sessionId, title]);

  // Keyboard nav in present mode
  useEffect(() => {
    if (mode !== 'present') return;
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(Math.min(slides.length - 1, current + 1));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(Math.max(0, current - 1));
      if (e.key === 'b' || e.key === 'B') toggleBlank();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, slides, current, isBlank]);

  const go = (idx) => { setCurrent(idx); setIsBlank(false); };
  const toggleBlank = () => setIsBlank(b => !b);

  const startPresent = () => {
    if (!slides.length) return;
    setCurrent(0);
    setIsBlank(false);
    setMode('present');
    pushSession(sessionId, title, slides, 0, false);
  };

  // ── Add verse ───────────────────────────────────────────────────────────────
  const addVerse = async () => {
    if (!refInput.trim()) return;
    setAddLoading(true); setAddError('');
    try {
      const { reference, text } = await fetchVerseText(refInput.trim(), translation);
      setSlides(prev => [...prev, { id: uid(), type: 'verse', reference, text, note: noteInput.trim() }]);
      setRefInput(''); setNoteInput('');
    } catch { setAddError('Verse not found. Try "John 3:16" or "Romans 8:1-4".'); }
    setAddLoading(false);
  };

  // ── Add notes block ─────────────────────────────────────────────────────────
  const addNotes = () => {
    if (!notesInput.trim()) return;
    const parsed = parseNotesText(notesInput);
    setSlides(prev => [...prev, ...parsed]);
    setNotesInput('');
  };

  // ── Add title slide ─────────────────────────────────────────────────────────
  const addTitleSlide = () => {
    if (!titleInput.trim()) return;
    setSlides(prev => [...prev, { id: uid(), type: 'title', text: titleInput.trim(), subtitle: '' }]);
    setTitleInput('');
  };

  // ── Upload file ─────────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const parsed = parseNotesText(text);
      setSlides(prev => [...prev, ...parsed]);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── AI suggest ──────────────────────────────────────────────────────────────
  const getSuggestions = async () => {
    setSuggestLoading(true); setSuggestions(null);
    try {
      const data = await suggestVerses(title || 'this sermon', translation, slides);
      setSuggestions(data.suggestions);
    } catch { setSuggestions([]); }
    setSuggestLoading(false);
  };

  const addSuggestion = (s) => {
    setSlides(prev => [...prev, { id: uid(), type: 'verse', reference: s.reference, text: s.text, note: '' }]);
    setSuggestions(prev => prev.filter(x => x.reference !== s.reference));
  };

  // ── Slide actions ───────────────────────────────────────────────────────────
  const removeSlide = (id) => setSlides(prev => {
    const next = prev.filter(s => s.id !== id);
    if (current >= next.length) setCurrent(Math.max(0, next.length - 1));
    return next;
  });

  const moveUp = (i) => setSlides(prev => {
    if (i === 0) return prev;
    const a = [...prev]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a;
  });

  const moveDown = (i) => setSlides(prev => {
    if (i >= prev.length - 1) return prev;
    const a = [...prev]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a;
  });

  const openDisplay = () => {
    const base = window.location.href.split('?')[0];
    window.open(`${base}?display=${sessionId}`, '_blank', 'width=1280,height=720,menubar=no,toolbar=no');
  };

  // ── PRESENT mode ────────────────────────────────────────────────────────────
  if (mode === 'present') {
    const slide = slides[current];
    return (
      <div className="sermon-operator">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{title || 'Sermon'}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>{translation} · {slides.length} slides · Session: <span style={{ fontFamily: 'monospace', color: 'var(--crimson)', letterSpacing: '0.1em' }}>{sessionId}</span></p>
          </div>
          <button className="scripture-btn" onClick={openDisplay} style={{ fontSize: 12 }}>📺 Open Display</button>
          <button className="back-btn" onClick={() => { setMode('build'); setIsBlank(false); }}>Edit</button>
        </div>

        {/* Blank indicator */}
        {isBlank && (
          <div style={{ background: '#1a0000', border: '1px solid var(--crimson)', borderRadius: 8, padding: '8px 12px', marginBottom: 8, textAlign: 'center' }}>
            <p style={{ color: 'var(--crimson)', fontWeight: 700, fontSize: 13 }}>SCREEN BLANKED — tap B or the button to restore</p>
          </div>
        )}

        {/* Current slide preview */}
        <div className="sermon-preview" style={{ background: '#0a0a0a', border: '2px solid var(--navy-2)', minHeight: 120 }}>
          {slide?.type === 'title' && (
            <>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 4 }}>{slide.text}</p>
              {slide.subtitle && <p style={{ textAlign: 'center', color: '#c9a84c', fontSize: 14 }}>{slide.subtitle}</p>}
            </>
          )}
          {slide?.type === 'verse' && (
            <>
              <p className="sermon-preview-ref">{slide.reference}</p>
              <p className="sermon-preview-text">"{slide.text}"</p>
              {slide.note && <p className="sermon-preview-note">📝 {slide.note}</p>}
            </>
          )}
          {slide?.type === 'note' && (
            <>
              {slide.heading && <p style={{ fontSize: 12, color: '#c9a84c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{slide.heading}</p>}
              <p style={{ fontSize: 15, color: '#f5f0e8', lineHeight: 1.5 }}>{slide.body}</p>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="sermon-controls" style={{ gap: 8 }}>
          <button className="sermon-nav-btn" onClick={() => go(Math.max(0, current - 1))} disabled={current === 0}>◀ Prev</button>
          <button
            onClick={toggleBlank}
            style={{ background: isBlank ? 'var(--crimson)' : 'var(--navy-2)', color: isBlank ? '#fff' : 'var(--muted)', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {isBlank ? '● BLANK' : '○ Blank'}
          </button>
          <span className="sermon-counter">{current + 1} / {slides.length}</span>
          <button className="sermon-nav-btn" onClick={() => go(Math.min(slides.length - 1, current + 1))} disabled={current === slides.length - 1}>Next ▶</button>
        </div>

        {/* Slide strip */}
        <div className="sermon-cue-list">
          {slides.map((s, i) => (
            <button key={s.id} className={`sermon-cue-item ${i === current ? 'active' : ''}`} onClick={() => go(i)}>
              <span className="sermon-cue-num">{i + 1}</span>
              <div className="sermon-cue-body">
                <p className="sermon-cue-ref">
                  {s.type === 'title' ? '🔤 TITLE' : s.type === 'verse' ? s.reference : s.heading ? `📝 ${s.heading}` : '📝 Note'}
                </p>
                <p className="sermon-cue-text">
                  {s.type === 'title' ? s.text : s.type === 'verse' ? s.text.slice(0, 70) : s.body.slice(0, 70)}
                  {(s.type !== 'title' && (s.type === 'verse' ? s.text : s.body).length > 70) ? '…' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '4px 0 8px' }}>
          ← → arrow keys · B to blank · Open Display on the TV
        </p>
      </div>
    );
  }

  // ── BUILD mode ──────────────────────────────────────────────────────────────
  return (
    <div className="sermon-operator">
      {/* Sermon title + present button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="scripture-input"
          placeholder="Sermon title…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, fontWeight: 600 }}
        />
        {slides.length > 0 && (
          <button className="scripture-btn" onClick={startPresent}>Present ▶</button>
        )}
      </div>

      {/* Add mode tabs */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {[['verse', '📖 Verse'], ['notes', '📝 Notes'], ['title', '🔤 Title']].map(([m, label]) => (
          <button key={m} onClick={() => setAddMode(m)}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: addMode === m ? 'var(--crimson)' : 'var(--navy-2)',
              color: addMode === m ? '#fff' : 'var(--muted)',
              border: 'none', cursor: 'pointer',
            }}>{label}</button>
        ))}
      </div>

      {/* ADD VERSE */}
      {addMode === 'verse' && (
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
          <input className="scripture-input" placeholder="Preaching note (optional, not shown on TV)"
            value={noteInput} onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addVerse()} />
          {addError && <p className="scripture-error">{addError}</p>}

          <button className="ask-buddy-inline" onClick={getSuggestions} disabled={suggestLoading}
            style={{ padding: '8px 0', textAlign: 'center' }}>
            {suggestLoading ? '…' : '✨ AI: Suggest related verses'}
          </button>

          {suggestions?.length > 0 && (
            <div>
              <span className="section-label">SUGGESTIONS</span>
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
        </div>
      )}

      {/* ADD NOTES */}
      {addMode === 'notes' && (
        <div className="scripture-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="section-label">ADD NOTES</span>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
            Paste your sermon notes. Separate slides with a blank line. Start a line with a heading like <em>"Point 1:"</em> to label the slide.
          </p>
          <textarea
            className="scripture-input"
            placeholder={`Point 1: Grace\nGod's grace is unearned and freely given to all who believe.\n\nPoint 2: Faith\nFaith is the assurance of things hoped for…`}
            value={notesInput}
            onChange={e => setNotesInput(e.target.value)}
            rows={7}
            style={{ resize: 'vertical', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="scripture-btn" onClick={addNotes} disabled={!notesInput.trim()} style={{ flex: 1 }}>
              Add to Slides
            </button>
            <button className="scripture-btn" onClick={() => fileRef.current?.click()}
              style={{ background: 'var(--navy-2)', color: 'var(--text-primary)' }}>
              📁 Upload .txt
            </button>
            <input ref={fileRef} type="file" accept=".txt,.md" style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>
        </div>
      )}

      {/* ADD TITLE SLIDE */}
      {addMode === 'title' && (
        <div className="scripture-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="section-label">ADD TITLE SLIDE</span>
          <div className="lookup-row">
            <input className="scripture-input" placeholder="Title text…"
              value={titleInput} onChange={e => setTitleInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTitleSlide()} />
            <button className="scripture-btn" onClick={addTitleSlide} disabled={!titleInput.trim()}>Add</button>
          </div>
        </div>
      )}

      {/* Slide list */}
      {slides.length === 0 ? (
        <div className="assess-start" style={{ flex: 'none', padding: '24px 0' }}>
          <span style={{ fontSize: '2rem' }}>📋</span>
          <p className="assess-desc">Add verses, notes, or a title slide above to build your presentation.</p>
        </div>
      ) : (
        <div className="sermon-cue-list">
          <span className="section-label">SLIDES ({slides.length})</span>
          {slides.map((s, i) => (
            <div key={s.id} className="sermon-cue-item" style={{ flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sermon-cue-num">{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p className="sermon-cue-ref">
                    {s.type === 'title' ? '🔤 Title Slide' : s.type === 'verse' ? s.reference : s.heading ? `📝 ${s.heading}` : '📝 Note'}
                  </p>
                  <p className="sermon-cue-text">
                    {s.type === 'title' ? s.text : s.type === 'verse' ? s.text.slice(0, 65) : s.body.slice(0, 65)}
                    {(s.type !== 'title') && ((s.type === 'verse' ? s.text : s.body).length > 65) ? '…' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button style={iconBtn} onClick={() => moveUp(i)} title="Move up">↑</button>
                  <button style={iconBtn} onClick={() => moveDown(i)} title="Move down">↓</button>
                  <button style={{ ...iconBtn, color: 'var(--crimson)' }} onClick={() => removeSlide(s.id)} title="Remove">✕</button>
                </div>
              </div>
              {s.note && s.type === 'verse' && (
                <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', paddingLeft: 26 }}>📝 {s.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, color: 'var(--muted)', padding: '4px',
};

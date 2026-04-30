import { callGemini } from './gemini';
import React, { useState, useEffect } from 'react';

const SERIES_KEY = 'bible_buddy_series_v1';

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function loadSeries() {
  try { return JSON.parse(localStorage.getItem(SERIES_KEY)) || []; } catch { return []; }
}
function saveSeries(data) { localStorage.setItem(SERIES_KEY, JSON.stringify(data)); }

async function generateSession(seriesTitle, sessionTopic, passage, translation, groupSize, sessionNum) {
  const prompt = `You are a seminary-trained pastor creating Session ${sessionNum} of a multi-week Bible study series titled "${seriesTitle}".

Create a complete small group study guide for:
- Session Topic: ${sessionTopic || passage}
${passage ? `- Key Passage: ${passage} (${translation})` : ''}
- Group size: ${groupSize}
- Translation: ${translation}

Structure EXACTLY as follows:

# Session ${sessionNum}: [Session Title]

## Overview
2-3 sentences on this session's theme and how it fits the series.

## Key Passage
Quote the main passage in full (${translation}).

## Background & Context
Historical, cultural, and literary context.

## Core Theological Theme
Name the doctrine, define it simply, then go deep.

## Verse-by-Verse Breakdown
Walk through key verses with commentary.

## Discussion Questions
6 questions in plain, conversational language — the way a real person would ask them, not a textbook. No jargon in the questions. The depth comes from the answers.
- 2 observation: "What did you notice...?" "What stands out to you...?"
- 2 interpretation: "Why do you think...?" "What does it mean when it says...?"
- 2 application: "How does this change the way you...?" "What would it look like in your life if...?"

## Application Challenge
One concrete challenge for this week.

## Leader Notes
Tips for the group leader.

## Closing Prayer Points
3 specific prayer points from the passage.

## Further Study
3-4 resources.`;

  const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function renderLesson(text) {
  return text
    .replace(/^# (.+)$/gm, '<h1 class="lesson-h1">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="lesson-h2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="lesson-h3">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul class="lesson-list">$1</ul>')
    .replace(/\n\n/g, '</p><p class="lesson-p">')
    .replace(/\n/g, '<br/>');
}

export default function SeriesTab({ translation, onBack }) {
  const [series, setSeries] = useState(() => loadSeries());
  const [view, setView] = useState('list'); // 'list' | 'create' | 'series' | 'session' | 'build'
  const [activeSeries, setActiveSeries] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  // Create series form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGroupSize, setNewGroupSize] = useState('8-12 adults');

  // Build session form
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionPassage, setSessionPassage] = useState('');
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildError, setBuildError] = useState('');

  // Viewing a generated session
  const [copied, setCopied] = useState(false);

  const persist = (updated) => { setSeries(updated); saveSeries(updated); };

  const createSeries = () => {
    if (!newTitle.trim()) return;
    const s = { id: makeId(), title: newTitle.trim(), description: newDesc.trim(), groupSize: newGroupSize, createdAt: Date.now(), sessions: [] };
    const updated = [...series, s];
    persist(updated);
    setActiveSeries(s);
    setNewTitle(''); setNewDesc('');
    setView('series');
  };

  const deleteSeries = (id) => {
    if (!window.confirm('Delete this series and all its sessions?')) return;
    persist(series.filter(s => s.id !== id));
  };

  const buildSession = async () => {
    if (!sessionTopic.trim() && !sessionPassage.trim()) return;
    setBuildLoading(true);
    setBuildError('');
    try {
      const content = await generateSession(
        activeSeries.title, sessionTopic, sessionPassage,
        translation, activeSeries.groupSize,
        activeSeries.sessions.length + 1
      );
      const session = {
        id: makeId(), num: activeSeries.sessions.length + 1,
        topic: sessionTopic || sessionPassage, passage: sessionPassage,
        content, createdAt: Date.now(),
      };
      const updatedSeries = series.map(s =>
        s.id === activeSeries.id ? { ...s, sessions: [...s.sessions, session] } : s
      );
      persist(updatedSeries);
      const refreshed = updatedSeries.find(s => s.id === activeSeries.id);
      setActiveSeries(refreshed);
      setActiveSession(session);
      setSessionTopic(''); setSessionPassage('');
      setView('session');
    } catch {
      setBuildError('Could not generate session. Please try again.');
    }
    setBuildLoading(false);
  };

  const deleteSession = (sessionId) => {
    if (!window.confirm('Delete this session?')) return;
    const updatedSeries = series.map(s =>
      s.id === activeSeries.id
        ? { ...s, sessions: s.sessions.filter(ss => ss.id !== sessionId) }
        : s
    );
    persist(updatedSeries);
    setActiveSeries(updatedSeries.find(s => s.id === activeSeries.id));
    setView('series');
  };

  const copySession = () => {
    navigator.clipboard.writeText(activeSession.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Series list ─────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>BIBLE STUDY SERIES</span>
        <button className="scripture-btn" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setView('create')}>+ New</button>
      </div>

      {series.length === 0 ? (
        <div className="assess-start">
          <span style={{ fontSize: '2.5rem' }}>📖</span>
          <h2 className="assess-title">No Series Yet</h2>
          <p className="assess-desc">Create a multi-week Bible study series for personal use or small groups.</p>
          <button className="scripture-btn assess-start-btn" onClick={() => setView('create')}>Create Series</button>
        </div>
      ) : (
        <div className="lessons-cards">
          {series.map(s => (
            <div key={s.id} className="lesson-card" style={{ cursor: 'default' }}>
              <span className="lesson-card-icon">📖</span>
              <div style={{ flex: 1 }}>
                <p className="lesson-card-title">{s.title}</p>
                {s.description && <p className="lesson-card-desc">{s.description}</p>}
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  {s.sessions.length} session{s.sessions.length !== 1 ? 's' : ''} · {s.groupSize}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button className="scripture-btn" style={{ fontSize: 12, padding: '4px 12px' }}
                  onClick={() => { setActiveSeries(s); setView('series'); }}>Open</button>
                <button className="back-btn" style={{ fontSize: 12, padding: '4px 12px', color: 'var(--crimson)' }}
                  onClick={() => deleteSeries(s.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Create series ───────────────────────────────────────────────────────────
  if (view === 'create') return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={() => setView('list')}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>NEW SERIES</span>
      </div>
      <div className="builder-form">
        <div className="form-group">
          <label className="form-label">Series Title</label>
          <input className="scripture-input" placeholder="e.g. The Book of Romans, Fruit of the Spirit"
            value={newTitle} onChange={e => setNewTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <input className="scripture-input" placeholder="Brief description of the series"
            value={newDesc} onChange={e => setNewDesc(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Group Size / Context</label>
          <select className="scripture-select" value={newGroupSize} onChange={e => setNewGroupSize(e.target.value)}>
            <option>8-12 adults</option>
            <option>Youth group (13-18)</option>
            <option>College students</option>
            <option>New believers</option>
            <option>Seminary / advanced study</option>
            <option>Personal devotional</option>
          </select>
        </div>
        <button className="scripture-btn" style={{ width: '100%', padding: 12, fontSize: 14 }}
          onClick={createSeries} disabled={!newTitle.trim()}>
          Create Series
        </button>
      </div>
    </div>
  );

  // ── Series detail ───────────────────────────────────────────────────────────
  if (view === 'series' && activeSeries) return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={() => setView('list')}>← Back</button>
        <span className="section-label" style={{ margin: 0, flex: 1 }}>{activeSeries.title}</span>
        <button className="scripture-btn" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { setBuildError(''); setView('build'); }}>
          + Session
        </button>
      </div>

      {activeSeries.description && (
        <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 4 }}>{activeSeries.description}</p>
      )}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{activeSeries.groupSize}</p>

      {activeSeries.sessions.length === 0 ? (
        <div className="assess-start" style={{ flex: 'none', padding: '20px 0' }}>
          <p className="assess-desc">No sessions yet. Add the first session to get started.</p>
          <button className="scripture-btn assess-start-btn" onClick={() => setView('build')}>Add Session 1</button>
        </div>
      ) : (
        <div className="sermon-cue-list">
          {activeSeries.sessions.map((ss, i) => (
            <div key={ss.id} className="sermon-cue-item" style={{ cursor: 'default' }}>
              <span className="sermon-cue-num">{ss.num}</span>
              <div className="sermon-cue-body" style={{ flex: 1 }}>
                <p className="sermon-cue-ref">Session {ss.num}: {ss.topic}</p>
                {ss.passage && <p className="sermon-cue-text">{ss.passage}</p>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="scripture-btn" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => { setActiveSession(ss); setView('session'); }}>View</button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crimson)', fontSize: 13 }}
                  onClick={() => deleteSession(ss.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Build session ───────────────────────────────────────────────────────────
  if (view === 'build') return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={() => setView('series')}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>
          SESSION {activeSeries.sessions.length + 1} — {activeSeries.title}
        </span>
      </div>

      {!buildLoading && (
        <div className="builder-form">
          <div className="form-group">
            <label className="form-label">Session Topic</label>
            <input className="scripture-input" placeholder="e.g. Justification by Faith, The Holy Spirit"
              value={sessionTopic} onChange={e => setSessionTopic(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Key Passage (optional)</label>
            <input className="scripture-input" placeholder="e.g. Romans 3:21-26"
              value={sessionPassage} onChange={e => setSessionPassage(e.target.value)} />
          </div>
          {buildError && <p className="scripture-error">{buildError}</p>}
          <button className="scripture-btn" style={{ width: '100%', padding: 12, fontSize: 14 }}
            onClick={buildSession} disabled={!sessionTopic.trim() && !sessionPassage.trim()}>
            Generate Session
          </button>
        </div>
      )}

      {buildLoading && (
        <div className="assess-start">
          <div className="typing-dots"><span /><span /><span /></div>
          <p className="assess-desc" style={{ marginTop: 12 }}>Building session {activeSeries.sessions.length + 1}…</p>
        </div>
      )}
    </div>
  );

  // ── View session ────────────────────────────────────────────────────────────
  if (view === 'session' && activeSession) return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={() => setView('series')}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>SESSION {activeSession.num}</span>
        <button className="scripture-btn" style={{ fontSize: 12, padding: '5px 12px' }} onClick={copySession}>
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <div className="lesson-content"
        dangerouslySetInnerHTML={{ __html: `<p class="lesson-p">${renderLesson(activeSession.content)}</p>` }} />
    </div>
  );

  return null;
}

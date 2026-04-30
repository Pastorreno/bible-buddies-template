import { callGemini } from './gemini';
import React, { useState, useEffect } from 'react';

const PLAN_KEY = 'bible_buddy_reading_plan_v1';

function loadPlan() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY)); } catch { return null; }
}
function savePlan(p) { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); }

async function generatePlan(topic, days, translation) {
  const prompt =
    `Create a ${days}-day Bible reading plan on the topic: "${topic}".\n` +
    `Use the ${translation} translation.\n` +
    `Each day should have a focused passage that builds on the previous day.\n` +
    `Reply with ONLY this JSON (no markdown):\n` +
    `{"title":"Plan Title","days":[{"day":1,"passage":"Book Chapter:Verse-Verse","theme":"one-line theme","reflection":"one focused question to meditate on","prayer":"one-sentence prayer prompt"}]}`;

  const raw = await callGemini(prompt);
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

async function fetchVerse(reference, translation) {
  const r = await fetch('/api/verse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, translation }),
  });
  return r.json();
}

export default function ReadingPlanTab({ translation, onBack }) {
  const [plan, setPlan] = useState(() => loadPlan());
  const [view, setView] = useState(plan ? 'plan' : 'setup');

  // Setup
  const [topic, setTopic] = useState('');
  const [days, setDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Day view
  const [activeDay, setActiveDay] = useState(null);
  const [verseText, setVerseText] = useState(null);
  const [verseLoading, setVerseLoading] = useState(false);

  const today = plan ? Math.max(0, plan.completed.length) : 0;

  const generate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const data = await generatePlan(topic, days, translation);
      const newPlan = { ...data, translation, completed: [], startedAt: Date.now() };
      savePlan(newPlan);
      setPlan(newPlan);
      setView('plan');
    } catch {
      setGenError('Could not generate plan. Please try again.');
    }
    setGenerating(false);
  };

  const openDay = async (d) => {
    setActiveDay(d);
    setVerseText(null);
    setVerseLoading(true);
    setView('day');
    const result = await fetchVerse(d.passage, plan.translation);
    setVerseText(result.error ? null : result.text);
    setVerseLoading(false);
  };

  const markComplete = (dayNum) => {
    const updated = { ...plan, completed: [...new Set([...plan.completed, dayNum])] };
    savePlan(updated);
    setPlan(updated);
  };

  const resetPlan = () => {
    if (!window.confirm('Delete this reading plan and start over?')) return;
    localStorage.removeItem(PLAN_KEY);
    setPlan(null);
    setView('setup');
    setTopic('');
  };

  const pct = plan ? Math.round((plan.completed.length / plan.days.length) * 100) : 0;

  // ── Setup ───────────────────────────────────────────────────────────────────
  if (view === 'setup') return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>READING PLAN</span>
      </div>
      {!generating ? (
        <div className="builder-form">
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <span style={{ fontSize: '2rem' }}>📅</span>
            <p className="assess-desc" style={{ marginTop: 8 }}>Build a personalized reading plan around any topic, book, or theme.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Topic or Book</label>
            <input className="scripture-input" placeholder="e.g. The Gospel of John, Prayer, Salvation"
              value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Duration</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[30, 60, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={days === d ? 'scripture-btn' : 'back-btn'}
                  style={{ flex: 1, padding: '8px 0' }}>
                  {d} Days
                </button>
              ))}
            </div>
          </div>
          {genError && <p className="scripture-error">{genError}</p>}
          <button className="scripture-btn" style={{ width: '100%', padding: 12, fontSize: 14 }}
            onClick={generate} disabled={!topic.trim()}>
            Generate Plan
          </button>
        </div>
      ) : (
        <div className="assess-start">
          <div className="typing-dots"><span /><span /><span /></div>
          <p className="assess-desc" style={{ marginTop: 12 }}>Building your {days}-day plan…</p>
        </div>
      )}
    </div>
  );

  // ── Plan overview ───────────────────────────────────────────────────────────
  if (view === 'plan' && plan) return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="section-label" style={{ margin: 0, flex: 1 }}>{plan.title}</span>
        <button className="back-btn" style={{ fontSize: 11, color: 'var(--crimson)' }} onClick={resetPlan}>Reset</button>
      </div>

      {/* Progress bar */}
      <div className="plan-progress-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{plan.completed.length} / {plan.days.length} days</span>
          <span style={{ fontSize: 12, color: 'var(--crimson)', fontWeight: 700 }}>{pct}%</span>
        </div>
        <div className="plan-progress-bar">
          <div className="plan-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Day list */}
      <div className="sermon-cue-list">
        {plan.days.map((d) => {
          const done = plan.completed.includes(d.day);
          const isCurrent = d.day === today + 1;
          return (
            <button key={d.day}
              className={`sermon-cue-item ${isCurrent ? 'active' : ''}`}
              onClick={() => openDay(d)}
              style={{ opacity: done ? 0.6 : 1 }}>
              <span className="sermon-cue-num" style={{ color: done ? '#2e7d32' : isCurrent ? 'var(--crimson)' : 'var(--muted)' }}>
                {done ? '✓' : d.day}
              </span>
              <div className="sermon-cue-body">
                <p className="sermon-cue-ref">{d.passage}</p>
                <p className="sermon-cue-text">{d.theme}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Day view ────────────────────────────────────────────────────────────────
  if (view === 'day' && activeDay && plan) {
    const done = plan.completed.includes(activeDay.day);
    return (
      <div className="assess-tab">
        <div className="lessons-back-row">
          <button className="back-btn" onClick={() => setView('plan')}>← Back</button>
          <span className="section-label" style={{ margin: 0 }}>DAY {activeDay.day}</span>
        </div>

        <div className="scripture-section">
          <span className="section-label">{activeDay.passage} · {plan.translation}</span>
          {verseLoading
            ? <div className="typing-dots" style={{ marginTop: 8 }}><span /><span /><span /></div>
            : verseText
              ? <p className="verse-result-text" style={{ marginTop: 8 }}>"{verseText}"</p>
              : <p className="scripture-muted" style={{ marginTop: 8 }}>Open your Bible to {activeDay.passage}</p>
          }
        </div>

        <div className="scripture-section">
          <span className="section-label">TODAY'S THEME</span>
          <p style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600, marginTop: 4 }}>{activeDay.theme}</p>
        </div>

        <div className="scripture-section">
          <span className="section-label">REFLECTION</span>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, marginTop: 4 }}>{activeDay.reflection}</p>
        </div>

        <div className="scripture-section" style={{ background: 'rgba(139,26,43,0.05)', borderColor: 'var(--crimson)' }}>
          <span className="section-label">PRAYER PROMPT</span>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, marginTop: 4, fontStyle: 'italic' }}>{activeDay.prayer}</p>
        </div>

        {!done && (
          <button className="scripture-btn" style={{ width: '100%', padding: 12, fontSize: 14, marginTop: 4 }}
            onClick={() => { markComplete(activeDay.day); setView('plan'); }}>
            ✓ Mark Day {activeDay.day} Complete
          </button>
        )}
        {done && (
          <p style={{ textAlign: 'center', color: '#2e7d32', fontWeight: 700, fontSize: 14, padding: '12px 0' }}>✓ Completed</p>
        )}
      </div>
    );
  }

  return null;
}

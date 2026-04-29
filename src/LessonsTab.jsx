import React, { useState } from 'react';
import SeriesTab from './SeriesTab';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

async function callGemini(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  });
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateLesson(topic, passage, translation, groupSize) {
  const prompt = `You are a seminary-trained pastor creating a small group Bible study guide in the tradition of top Bible colleges (Dallas Theological Seminary, Moody, Gordon-Conwell).

Create a complete small group study guide for:
- Topic/Passage: ${topic || passage}
${passage ? `- Key Passage: ${passage} (${translation})` : ''}
- Group size: ${groupSize}
- Translation: ${translation}

Structure the guide EXACTLY as follows:

# [Study Title]

## Overview
2-3 sentences summarizing the study theme and its theological significance.

## Key Passage
Quote the main passage in full (${translation}).

## Background & Context
Historical, cultural, and literary context. What was happening? Who wrote it? To whom? Why does it matter?

## Core Theological Theme
Name the doctrine this passage addresses. Explain it clearly for a new believer, then go deep for the scholar.

## Verse-by-Verse Breakdown
Walk through the key verses with brief commentary on each.

## Discussion Questions
Provide 6 discussion questions — 2 observation (what does it say?), 2 interpretation (what does it mean?), 2 application (how do I live it?).

## Application Challenge
One specific, concrete challenge for group members to apply this week.

## Leader Notes
Tips for the group leader: potential rabbit holes to avoid, sensitive topics to handle carefully, and how to keep discussion on track.

## Closing Prayer Points
3 specific prayer points drawn from the passage.

## Further Study
3-4 resources for deeper study (commentaries, books, theologians).`;

  return callGemini(prompt);
}

async function generateQuiz(topics, translation) {
  const topicSummary = topics
    .filter(t => t.messages.filter(m => m.role === 'user').length > 0)
    .map(t => t.messages.filter(m => m.role === 'user').map(m => m.text).slice(0, 5).join('; '))
    .join('\n');

  const prompt = (topicSummary
    ? `Based on these Bible study topics: ${topicSummary}\n\nGenerate a quiz of 5 multiple-choice questions.`
    : `Generate a quiz of 5 multiple-choice foundational Bible knowledge questions.`)
    + ` Use ${translation} for Scripture references. Reply with ONLY this JSON (no markdown):\n{"questions":[{"q":"question","options":["A","B","C","D"],"answer":"A","explanation":"brief explanation with Scripture"}]}`;

  const raw = await callGemini(prompt);
  const clean = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
  return JSON.parse(clean);
}

function renderLesson(text) {
  return text
    .replace(/^# (.+)$/gm, '<h1 class="lesson-h1">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="lesson-h2">$2</h2>'.replace('$2', '$1'))
    .replace(/^### (.+)$/gm, '<h3 class="lesson-h3">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul class="lesson-list">$1</ul>')
    .replace(/\n\n/g, '</p><p class="lesson-p">')
    .replace(/\n/g, '<br/>');
}

export default function LessonsTab({ topics, translation }) {
  const [mode, setMode] = useState(null); // null | 'builder' | 'quiz'

  // Lesson builder state
  const [topic, setTopic] = useState('');
  const [passage, setPassage] = useState('');
  const [groupSize, setGroupSize] = useState('8-12 adults');
  const [lesson, setLesson] = useState('');
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState('');
  const [copied, setCopied] = useState(false);

  // Quiz state
  const [quiz, setQuiz] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [quizError, setQuizError] = useState('');

  const buildLesson = async () => {
    if (!topic.trim() && !passage.trim()) return;
    setLessonLoading(true);
    setLessonError('');
    setLesson('');
    try {
      const text = await generateLesson(topic, passage, translation, groupSize);
      setLesson(text);
    } catch {
      setLessonError('Could not generate lesson. Please try again.');
    }
    setLessonLoading(false);
  };

  const copyLesson = () => {
    navigator.clipboard.writeText(lesson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startQuiz = async () => {
    setQuizLoading(true);
    setQuizError('');
    setAnswers({});
    setSubmitted(false);
    setQuiz(null);
    try {
      const data = await generateQuiz(topics, translation);
      setQuiz(data.questions);
    } catch {
      setQuizError('Could not generate quiz. Please try again.');
    }
    setQuizLoading(false);
  };

  const score = quiz ? quiz.filter((q, i) => answers[i] === q.answer).length : 0;

  // ── Home screen ────────────────────────────────────────────────────────────
  if (!mode) return (
    <div className="lessons-home">
      <div className="lessons-hero">
        <span style={{ fontSize: '2.5rem' }}>📚</span>
        <h2 className="assess-title">Lessons</h2>
        <p className="assess-desc">Seminary-quality study tools for individuals, small groups, and leaders.</p>
      </div>
      <div className="lessons-cards">
        <button className="lesson-card" onClick={() => setMode('series')}>
          <span className="lesson-card-icon">📖</span>
          <div>
            <p className="lesson-card-title">Bible Study Series</p>
            <p className="lesson-card-desc">Build a multi-week series with saved sessions for personal or small group use.</p>
          </div>
        </button>
        <button className="lesson-card" onClick={() => setMode('builder')}>
          <span className="lesson-card-icon">✍️</span>
          <div>
            <p className="lesson-card-title">Build a Study</p>
            <p className="lesson-card-desc">AI generates a complete small group study guide from any topic or passage.</p>
          </div>
        </button>
        <button className="lesson-card" onClick={() => { setMode('quiz'); startQuiz(); }}>
          <span className="lesson-card-icon">✎</span>
          <div>
            <p className="lesson-card-title">Knowledge Quiz</p>
            <p className="lesson-card-desc">Test your understanding with questions drawn from your study topics.</p>
          </div>
        </button>
      </div>
    </div>
  );

  if (mode === 'series') return <SeriesTab translation={translation} onBack={() => setMode(null)} />;

  // ── Lesson Builder ─────────────────────────────────────────────────────────
  if (mode === 'builder') return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={() => { setMode(null); setLesson(''); }}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>STUDY BUILDER</span>
      </div>

      {!lesson && !lessonLoading && (
        <div className="builder-form">
          <div className="form-group">
            <label className="form-label">Topic or Theme</label>
            <input className="scripture-input" placeholder="e.g. The Grace of God, Forgiveness, Faith vs. Works"
              value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Key Passage (optional)</label>
            <input className="scripture-input" placeholder="e.g. Romans 8:1-17, Ephesians 2:1-10"
              value={passage} onChange={e => setPassage(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Group Size / Context</label>
            <select className="scripture-select" value={groupSize} onChange={e => setGroupSize(e.target.value)}>
              <option>8-12 adults</option>
              <option>Youth group (13-18)</option>
              <option>College students</option>
              <option>New believers</option>
              <option>Seminary / advanced study</option>
              <option>Personal devotional</option>
            </select>
          </div>
          {lessonError && <p className="scripture-error">{lessonError}</p>}
          <button className="scripture-btn" style={{ width: '100%', padding: '12px', fontSize: 14 }}
            onClick={buildLesson} disabled={!topic.trim() && !passage.trim()}>
            Generate Study Guide
          </button>
        </div>
      )}

      {lessonLoading && (
        <div className="assess-start">
          <div className="typing-dots"><span /><span /><span /></div>
          <p className="assess-desc" style={{ marginTop: 12 }}>Building your study guide…</p>
        </div>
      )}

      {lesson && (
        <div className="lesson-output">
          <div className="lesson-output-actions">
            <button className="scripture-btn" onClick={copyLesson}>
              {copied ? '✓ Copied!' : 'Copy Lesson'}
            </button>
            <button className="back-btn" onClick={() => setLesson('')}>New Study</button>
          </div>
          <div className="lesson-content"
            dangerouslySetInnerHTML={{ __html: `<p class="lesson-p">${renderLesson(lesson)}</p>` }} />
        </div>
      )}
    </div>
  );

  // ── Quiz ───────────────────────────────────────────────────────────────────
  if (mode === 'quiz') return (
    <div className="assess-tab">
      <div className="lessons-back-row">
        <button className="back-btn" onClick={() => setMode(null)}>← Back</button>
        <span className="section-label" style={{ margin: 0 }}>KNOWLEDGE QUIZ · {translation}</span>
        {submitted && <span className="quiz-score">{score}/{quiz?.length}</span>}
      </div>

      {quizLoading && (
        <div className="assess-start">
          <div className="typing-dots"><span /><span /><span /></div>
          <p className="assess-desc" style={{ marginTop: 12 }}>Generating your quiz…</p>
        </div>
      )}

      {quizError && (
        <div className="assess-start">
          <p className="scripture-error">{quizError}</p>
          <button className="scripture-btn" onClick={startQuiz} style={{ marginTop: 12 }}>Try Again</button>
        </div>
      )}

      {quiz && !quizLoading && (
        <div className="quiz-container">
          {quiz.map((q, i) => (
            <div key={i} className="quiz-question">
              <p className="quiz-q-text"><strong>{i + 1}.</strong> {q.q}</p>
              <div className="quiz-options">
                {q.options.map((opt, j) => {
                  const letter = ['A','B','C','D'][j];
                  const selected = answers[i] === letter;
                  const correct = q.answer === letter;
                  let cls = 'quiz-option';
                  if (submitted) { if (correct) cls += ' correct'; else if (selected) cls += ' wrong'; }
                  else if (selected) cls += ' selected';
                  return (
                    <button key={j} className={cls} disabled={submitted}
                      onClick={() => setAnswers(p => ({ ...p, [i]: letter }))}>
                      <span className="quiz-letter">{letter}</span> {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && <p className="quiz-explanation">{q.explanation}</p>}
            </div>
          ))}
          <div className="quiz-footer">
            {!submitted
              ? <button className="scripture-btn" onClick={() => setSubmitted(true)}
                  disabled={Object.keys(answers).length < quiz.length}>Submit</button>
              : <button className="scripture-btn" onClick={startQuiz}>New Quiz</button>
            }
          </div>
        </div>
      )}
    </div>
  );
}

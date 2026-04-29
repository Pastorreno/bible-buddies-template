import React, { useState } from 'react';

async function generateQuiz(topics, translation) {
  const topicSummary = topics
    .filter(t => t.messages.filter(m => m.role === 'user').length > 0)
    .map(t => {
      const questions = t.messages.filter(m => m.role === 'user').map(m => m.text).slice(0, 5);
      return `Topic "${t.title}": ${questions.join('; ')}`;
    })
    .join('\n');

  const prompt = topicSummary
    ? `Based on these Bible study topics a user has explored:\n${topicSummary}\n\nGenerate a quiz of 5 multiple-choice questions to test their knowledge. Use the ${translation} Bible translation for any Scripture references.`
    : `Generate a quiz of 5 multiple-choice questions covering foundational Bible knowledge. Use the ${translation} Bible translation for any Scripture references.`;

  const fullPrompt = prompt + `\n\nReply with ONLY this JSON (no markdown):\n{"questions":[{"q":"question text","options":["A","B","C","D"],"answer":"A","explanation":"brief explanation with Scripture reference"}]}`;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] }),
    }
  );
  const data = await r.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export default function AssessTab({ topics, translation }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const startQuiz = async () => {
    setLoading(true);
    setError('');
    setAnswers({});
    setSubmitted(false);
    try {
      const data = await generateQuiz(topics, translation);
      setQuiz(data.questions);
    } catch (e) {
      setError('Could not generate quiz. Please try again.');
    }
    setLoading(false);
  };

  const score = quiz
    ? quiz.filter((q, i) => answers[i] === q.answer).length
    : 0;

  return (
    <div className="assess-tab">
      {!quiz && !loading && (
        <div className="assess-start">
          <span style={{ fontSize: '2.5rem' }}>✎</span>
          <h2 className="assess-title">Knowledge Assessment</h2>
          <p className="assess-desc">
            {topics.some(t => t.messages.filter(m => m.role === 'user').length > 0)
              ? 'A 5-question quiz will be generated from your study topics.'
              : 'A 5-question foundational Bible quiz will be generated for you.'}
          </p>
          <button className="scripture-btn assess-start-btn" onClick={startQuiz}>
            Start Quiz
          </button>
        </div>
      )}

      {loading && (
        <div className="assess-start">
          <div className="typing-dots"><span /><span /><span /></div>
          <p className="assess-desc" style={{ marginTop: 12 }}>Generating your quiz…</p>
        </div>
      )}

      {error && (
        <div className="assess-start">
          <p className="scripture-error">{error}</p>
          <button className="scripture-btn" onClick={startQuiz} style={{ marginTop: 12 }}>Try Again</button>
        </div>
      )}

      {quiz && !loading && (
        <div className="quiz-container">
          <div className="quiz-header">
            <span className="section-label">BIBLE QUIZ · {translation}</span>
            {submitted && (
              <span className="quiz-score">{score}/{quiz.length}</span>
            )}
          </div>

          {quiz.map((q, i) => (
            <div key={i} className="quiz-question">
              <p className="quiz-q-text"><strong>{i + 1}.</strong> {q.q}</p>
              <div className="quiz-options">
                {q.options.map((opt, j) => {
                  const letter = ['A','B','C','D'][j];
                  const selected = answers[i] === letter;
                  const correct = q.answer === letter;
                  let cls = 'quiz-option';
                  if (submitted) {
                    if (correct) cls += ' correct';
                    else if (selected) cls += ' wrong';
                  } else if (selected) {
                    cls += ' selected';
                  }
                  return (
                    <button
                      key={j}
                      className={cls}
                      disabled={submitted}
                      onClick={() => setAnswers(prev => ({ ...prev, [i]: letter }))}
                    >
                      <span className="quiz-letter">{letter}</span> {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="quiz-explanation">{q.explanation}</p>
              )}
            </div>
          ))}

          <div className="quiz-footer">
            {!submitted ? (
              <button
                className="scripture-btn"
                onClick={() => setSubmitted(true)}
                disabled={Object.keys(answers).length < quiz.length}
              >
                Submit
              </button>
            ) : (
              <button className="scripture-btn" onClick={startQuiz}>New Quiz</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

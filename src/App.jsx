import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────
function renderMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^#{1,3}\s(.+)$/gm, '<h3 class="font-bold text-crimson mt-3 mb-1 font-serif">$1</h3>')
      .replace(/\n/g, '<br/>');
}

// ── Constants ─────────────────────────────────────────────────────────────────
const VAULT_KEY = 'bible_buddies_vault_v1';

const SUGGESTIONS = [
    "What does Romans 8:28 mean?",
    "Explain the Sermon on the Mount",
    "Who was the Apostle Paul?",
    "How do I study the Bible deeply?",
    "What is the Gospel?",
  ];

const WELCOME_MSG = {
    role: 'bot',
    label: 'WELCOME',
    text: 'Welcome to The Scriptorium. Ask me anything about Scripture — a verse, a theme, a theological question, or a life challenge. Deep truth awaits.',
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
    const [messages, setMessages] = useState([WELCOME_MSG]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('study');
    const [vaultLoaded, setVaultLoaded] = useState(false);
    const bottomRef = useRef(null);

  // ── Persistence: load on mount ──────────────────────────────────────────────
  useEffect(() => {
        try {
                const saved = localStorage.getItem(VAULT_KEY);
                if (saved) {
                          const { messages: savedMsgs, lastTab } = JSON.parse(saved);
                          if (savedMsgs && savedMsgs.length > 0) setMessages(savedMsgs);
                          if (lastTab) setActiveTab(lastTab);
                }
        } catch (e) {
                console.error('Vault load failed, starting fresh.', e);
        }
        setVaultLoaded(true);
  }, []);

  // ── Persistence: save on change ─────────────────────────────────────────────
  useEffect(() => {
        if (!vaultLoaded) return;
        localStorage.setItem(VAULT_KEY, JSON.stringify({ messages, lastTab: activeTab }));
  }, [messages, activeTab, vaultLoaded]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
        const userText = text || input.trim();
        if (!userText) return;
        setInput('');

                                      const userMsg = { role: 'user', text: userText };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

                                      // Build history for the backend (exclude welcome message, last 10 exchanges)
                                      const historyForApi = messages
          .filter(m => m.role === 'user' || (m.role === 'bot' && m.label !== 'WELCOME' && m.label !== 'ERROR'))
          .slice(-10)
          .map(m => ({ role: m.role === 'user' ? 'user' : 'model', content: m.text }));

                                      try {
                                              const res = await fetch('/api/chat', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ message: userText, history: historyForApi }),
                                              });
                                              const data = await res.json();
                                              setMessages(prev => [...prev, {
                                                        role: 'bot',
                                                        label: 'THEOLOGICAL INSIGHT',
                                                        text: data.reply || 'No response received.',
                                              }]);
                                      } catch {
                                              setMessages(prev => [...prev, {
                                                        role: 'bot',
                                                        label: 'ERROR',
                                                        text: 'Could not connect to the server. Please try again.',
                                              }]);
                                      }
        setLoading(false);
  }, [input, messages]);

  // ── Clear memory ─────────────────────────────────────────────────────────────
  const clearMemory = () => {
        if (window.confirm('Clear all conversation history from memory?')) {
                setMessages([WELCOME_MSG]);
                localStorage.removeItem(VAULT_KEY);
        }
  };

  // ── Tab content ──────────────────────────────────────────────────────────────
  const renderTabContent = () => {
        switch (activeTab) {
          case 'scripture':
                    return (
                                <div className="tab-content-panel">
                                            <div className="tab-placeholder">
                                                          <span style={{ fontSize: '3rem' }}>&#128214;</span>span>
                                                          <h2>Sacred Texts</h2>h2>
                                                          <p>Scripture browsing coming soon. Use the Study tab to ask about any verse or passage.</p>p>
                                            </div>div>
                                </div>div>
                              );
          case 'assess':
                    return (
                                <div className="tab-content-panel">
                                            <div className="tab-placeholder">
                                                          <span style={{ fontSize: '3rem' }}>&#9998;</span>span>
                                                          <h2>Knowledge Assessment</h2>h2>
                                                          <p>Assessment features coming soon. Your study history is saved and will power quizzes here.</p>p>
                                              {messages.length > 1 && (
                                                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
                                                    {messages.filter(m => m.role === 'user').length} question(s) recorded in your vault.
                                                  </p>p>
                                                          )}
                                            </div>div>
                                </div>div>
                              );
          case 'study':
          default:
                    return (
                                <>
                                            <main className="chat-area">
                                              {messages.map((msg, i) => (
                                                  msg.role === 'user' ? (
                                                                      <div key={i} className="inquiry-block">
                                                                                          <span className="block-label">INQUIRY</span>span>
                                                                                          <p className="inquiry-text">{msg.text}</p>p>
                                                                      </div>div>
                                                                    ) : (
                                                                      <div key={i} className="insight-block">
                                                                                          <div className="insight-avatar">&#10024;</div>div>
                                                                                          <div className="insight-content">
                                                                                            {msg.label && <span className="block-label insight-label">{msg.label}</span>span>}
                                                                                                                <div
                                                                                                                                          className="insight-text"
                                                                                                                                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                                                                                                                                        />
                                                                                            </div>div>
                                                                      </div>div>
                                                                    )
                                                ))}
                                              {loading && (
                                                  <div className="insight-block">
                                                                    <div className="insight-avatar">&#10024;</div>div>
                                                                    <div className="insight-content">
                                                                                        <span className="block-label insight-label">THINKING</span>span>
                                                                                        <div className="typing-dots"><span /><span /><span /></div>div>
                                                                    </div>div>
                                                  </div>div>
                                                          )}
                                                          <div ref={bottomRef} />
                                            </main>main>
                                
                                  {messages.length <= 2 && !loading && (
                                                <div className="suggestions">
                                                  {SUGGESTIONS.map((s, i) => (
                                                                    <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)}>{s}</button>button>
                                                                  ))}
                                                </div>div>
                                            )}
                                
                                            <div className="input-area">
                                                          <div className="input-row">
                                                                          <input
                                                                                              className="chat-input"
                                                                                              placeholder="Deepen your study (e.g., Romans 8:28)..."
                                                                                              value={input}
                                                                                              onChange={e => setInput(e.target.value)}
                                                                                              onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                                                                              disabled={loading}
                                                                                            />
                                                                          <button className="send-btn" onClick={() => sendMessage()} disabled={loading}>
                                                                                            SEND
                                                                          </button>button>
                                                          </div>div>
                                                          <p className="disclaimer">Don&#8217;t just take my word for it. Always verify by reading the full chapter yourself.</p>p>
                                            </div>div>
                                </>>
                              );
        }
  };
  
    // ── Render ────────────────────────────────────────────────────────────────────
    return (
          <div className="scriptorium-app">
            {/* Header */}
                <header className="scriptorium-header">
                        <div className="header-brand">
                                  <span className="header-icon">&#128214;</span>span>
                                  <span className="header-title">The Scriptorium</span>span>
                        </div>div>
                        <div className="header-actions">
                                  <button className="icon-btn" aria-label="Clear memory" onClick={clearMemory} title="Clear conversation memory">
                                              &#128465;
                                  </button>button>
                                  <button className="icon-btn" aria-label="Profile">&#128100;</button>button>
                        </div>div>
                </header>header>
          
            {/* Dynamic Tab Content */}
            {renderTabContent()}
          
            {/* Bottom Nav */}
                <nav className="bottom-nav">
                        <button
                                    className={`nav-item ${activeTab === 'scripture' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('scripture')}
                                  >
                                  <span className="nav-icon">&#128214;</span>span>
                                  <span>SCRIPTURE</span>span>
                        </button>button>
                        <button
                                    className={`nav-item ${activeTab === 'study' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('study')}
                                  >
                                  <span className="nav-icon">&#10024;</span>span>
                                  <span>STUDY</span>span>
                        </button>button>
                        <button
                                    className={`nav-item ${activeTab === 'assess' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('assess')}
                                  >
                                  <span className="nav-icon">&#9998;</span>span>
                                  <span>ASSESS</span>span>
                        </button>button>
                </nav>nav>
          </div>div>
        );
}</></div>

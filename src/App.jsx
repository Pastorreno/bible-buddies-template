import React, { useState, useRef, useEffect, useCallback } from 'react';
import ScriptureTab from './ScriptureTab';
import AssessTab from './AssessTab';

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderMarkdown(text) {
  return text
    // Section headers like **Short Answer** on their own line
    .replace(/^\*\*([^*]+)\*\*$/gm, '<h3 class="section-heading">$1</h3>')
    // Inline bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // ATX headings
    .replace(/^#{1,3}\s(.+)$/gm, '<h3 class="section-heading">$1</h3>')
    // Bullet lists
    .replace(/^[-•]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul class="response-list">$1</ul>')
    .replace(/\n/g, '<br/>');
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const VAULT_KEY_V1 = 'bible_buddies_vault_v1';
const VAULT_KEY_V2 = 'bible_buddies_vault_v2';

const SUGGESTIONS = [
  "What does it mean to be saved?",
  "What does Romans 8:28 mean?",
  "Explain the Sermon on the Mount",
  "What is the doctrine of grace?",
  "Who was Jesus, really?",
];

const TRANSLATIONS = ['NLT', 'CSB', 'KJV', 'ESV'];
const TRANSLATION_KEY = 'bible_buddies_translation';

function welcomeMsg() {
  return {
    role: 'bot',
    label: 'WELCOME',
    text: 'Welcome to Bible Buddy! Ask me anything about Scripture — a verse, a theme, a theological question, or a life challenge. Deep truth awaits.',
  };
}

function newTopic(title = 'New Topic') {
  return { id: makeId(), title, createdAt: Date.now(), messages: [welcomeMsg()] };
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────
function loadVault() {
  try {
    // Try v2 first
    const v2 = localStorage.getItem(VAULT_KEY_V2);
    if (v2) return JSON.parse(v2);

    // Migrate v1 → v2
    const v1 = localStorage.getItem(VAULT_KEY_V1);
    if (v1) {
      const { messages: savedMsgs } = JSON.parse(v1);
      const general = { id: makeId(), title: 'General', createdAt: Date.now(), messages: savedMsgs || [welcomeMsg()] };
      return { topics: [general], activeTopicId: general.id };
    }
  } catch (e) {
    console.error('Vault load failed', e);
  }
  const first = newTopic('General');
  return { topics: [first], activeTopicId: first.id };
}

function saveVault(topics, activeTopicId) {
  localStorage.setItem(VAULT_KEY_V2, JSON.stringify({ topics, activeTopicId }));
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [topics, setTopics] = useState([]);
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('study');
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [showTopicMenu, setShowTopicMenu] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [translation, setTranslation] = useState(() =>
    localStorage.getItem(TRANSLATION_KEY) || 'ESV'
  );
  const bottomRef = useRef(null);
  const renameRef = useRef(null);

  // Load on mount
  useEffect(() => {
    const { topics: t, activeTopicId: id } = loadVault();
    setTopics(t);
    setActiveTopicId(id);
    setVaultLoaded(true);
  }, []);

  // Save on change
  useEffect(() => {
    if (!vaultLoaded) return;
    saveVault(topics, activeTopicId);
  }, [topics, activeTopicId, vaultLoaded]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [topics, activeTopicId, loading]);

  // Focus rename input
  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  const activeTopic = topics.find(t => t.id === activeTopicId);
  const messages = activeTopic?.messages || [];

  // ── Topic actions ─────────────────────────────────────────────────────────
  const createTopic = () => {
    const t = newTopic('New Topic');
    setTopics(prev => [...prev, t]);
    setActiveTopicId(t.id);
    setShowTopicMenu(false);
    // immediately enter rename
    setRenamingId(t.id);
    setRenameValue('New Topic');
  };

  const switchTopic = (id) => {
    setActiveTopicId(id);
    setShowTopicMenu(false);
  };

  const startRename = (t) => {
    setRenamingId(t.id);
    setRenameValue(t.title);
    setShowTopicMenu(false);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      setTopics(prev => prev.map(t => t.id === renamingId ? { ...t, title: trimmed } : t));
    }
    setRenamingId(null);
  };

  const deleteTopic = (id) => {
    if (!window.confirm('Delete this topic and all its messages?')) return;
    setTopics(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        const fresh = newTopic('General');
        setActiveTopicId(fresh.id);
        return [fresh];
      }
      if (id === activeTopicId) setActiveTopicId(next[0].id);
      return next;
    });
    setShowTopicMenu(false);
  };

  const clearTopic = (id) => {
    if (!window.confirm('Clear all messages in this topic?')) return;
    setTopics(prev => prev.map(t => t.id === id ? { ...t, messages: [welcomeMsg()] } : t));
    setShowTopicMenu(false);
  };

  const changeTranslation = (t) => {
    setTranslation(t);
    localStorage.setItem(TRANSLATION_KEY, t);
  };

  const updateMessages = (id, updater) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, messages: updater(t.messages) } : t));
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const userText = text || input.trim();
    if (!userText || !activeTopicId) return;
    setInput('');

    const userMsg = { role: 'user', text: userText };
    updateMessages(activeTopicId, msgs => [...msgs, userMsg]);
    setLoading(true);

    const historyForApi = messages
      .filter(m => m.role === 'user' || (m.role === 'bot' && m.label !== 'WELCOME' && m.label !== 'ERROR'))
      .slice(-10)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'model', content: m.text }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: historyForApi, translation }),
      });
      const data = await res.json();
      updateMessages(activeTopicId, msgs => [...msgs, {
        role: 'bot',
        label: 'THEOLOGICAL INSIGHT',
        text: data.reply || 'No response received.',
      }]);
    } catch {
      updateMessages(activeTopicId, msgs => [...msgs, {
        role: 'bot',
        label: 'ERROR',
        text: 'Could not connect to the server. Please try again.',
      }]);
    }
    setLoading(false);
  }, [input, messages, activeTopicId]);

  // ── Render ────────────────────────────────────────────────────────────────
  const renderTabContent = () => {
    if (activeTab === 'scripture') {
      return <ScriptureTab translation={translation} />;
    }

    if (activeTab === 'assess') {
      return <AssessTab topics={topics} translation={translation} />;
    }

    return (
      <React.Fragment>
        <main className="chat-area">
          {messages.map((msg, i) => (
            msg.role === 'user' ? (
              <div key={i} className="inquiry-block">
                <span className="block-label">INQUIRY</span>
                <p className="inquiry-text">{msg.text}</p>
              </div>
            ) : (
              <div key={i} className="insight-block">
                <div className="insight-avatar">✨</div>
                <div className="insight-content">
                  {msg.label && <span className="block-label insight-label">{msg.label}</span>}
                  <div className="insight-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                </div>
              </div>
            )
          ))}
          {loading && (
            <div className="insight-block">
              <div className="insight-avatar">✨</div>
              <div className="insight-content">
                <span className="block-label insight-label">THINKING</span>
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </main>

        {messages.length <= 2 && !loading && (
          <div className="suggestions">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)}>{s}</button>
            ))}
          </div>
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
            <button className="send-btn" onClick={() => sendMessage()} disabled={loading}>SEND</button>
          </div>
          <p className="disclaimer">Don&#8217;t just take my word for it. Always verify by reading the full chapter yourself.</p>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="scriptorium-app">
      <header className="scriptorium-header">
        <div className="header-brand">
          <span className="header-icon">📖</span>
          <span className="header-title">Bible Buddy</span>
        </div>

        {/* Topic dropdown (study tab only) */}
        {activeTab === 'study' && (
          <div style={{ position: 'relative' }}>
            <button
              className="topic-selector-btn"
              onClick={() => setShowTopicMenu(p => !p)}
              title="Switch topic"
            >
              {renamingId === activeTopicId ? (
                <input
                  ref={renameRef}
                  className="rename-input"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); e.stopPropagation(); }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="topic-selector-label">{activeTopic?.title || 'Topics'}</span>
                  <span style={{ fontSize: 10, marginLeft: 4 }}>▾</span>
                </>
              )}
            </button>

            {showTopicMenu && (
              <div className="topic-menu">
                {topics.map(t => (
                  <div key={t.id} className={`topic-menu-item ${t.id === activeTopicId ? 'active' : ''}`}>
                    <button className="topic-menu-title" onClick={() => switchTopic(t.id)}>{t.title}</button>
                    <div className="topic-menu-actions">
                      <button onClick={() => startRename(t)} title="Rename">✎</button>
                      <button onClick={() => clearTopic(t.id)} title="Clear">↺</button>
                      <button onClick={() => deleteTopic(t.id)} title="Delete" className="danger">✕</button>
                    </div>
                  </div>
                ))}
                <button className="topic-menu-new" onClick={createTopic}>+ New Topic</button>
              </div>
            )}
          </div>
        )}

        <select
          className="translation-select"
          value={translation}
          onChange={e => changeTranslation(e.target.value)}
          aria-label="Bible translation"
        >
          {TRANSLATIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <button className="icon-btn" aria-label="Profile">👤</button>      </header>

      {renderTabContent()}

      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'scripture' ? 'active' : ''}`} onClick={() => setActiveTab('scripture')}>
          <span className="nav-icon">📖</span>
          <span>SCRIPTURE</span>
        </button>
        <button className={`nav-item ${activeTab === 'study' ? 'active' : ''}`} onClick={() => setActiveTab('study')}>
          <span className="nav-icon">✨</span>
          <span>STUDY</span>
        </button>
        <button className={`nav-item ${activeTab === 'assess' ? 'active' : ''}`} onClick={() => setActiveTab('assess')}>
          <span className="nav-icon">✎</span>
          <span>ASSESS</span>
        </button>
      </nav>
    </div>
  );
}

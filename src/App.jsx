import React, { useState, useRef, useEffect } from 'react';
import { Send, BookOpen, Users } from 'lucide-react';

const config = {
  appName: "BIBLE BUDDIES",
  tagline: "Deep Truth. Real Talk.",
  pastorPersona: "Dr. Eric Mason",
  churchName: "Bible Buddies Community",
  welcomeMessage: "Welcome to Bible Buddies! Whether you are opening the Bible for the first time or you've been reading it for years, I'm here to help you study the Word. What topic or verse should we look at today?",
  footerDisclaimer: "Don't just take my word for it. Always verify by reading the full chapter yourself.",
};

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s(.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
    .replace(/\n/g, '<br/>');
}

export default function App() {
  const [messages, setMessages] = useState([{ role: 'bot', text: config.welcomeMessage }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const suggestedQuestions = [
    "Does God forgive me if I keep repeating the same sin?",
    "Why does God seem silent when I'm struggling?",
    "How do I actually hear God's voice?",
    "How should Christians handle conflict and controversy?",
    "How should I pray when I don't know what to say?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const generateResponse = async (userText) => {
    const formattedHistory = messages.filter(m => m.role !== 'bot' || m.text !== messages[0].text).map(msg => ({
      role: msg.role === 'bot' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    const payload = {
      contents: [...formattedHistory, { role: 'user', parts: [{ text: userText }] }],
      systemInstruction: { parts: [{ text: `You are a helpful, knowledgeable, and highly accessible Bible study guide representing ${config.churchName}. You speak in the stylistic vein of ${config.pastorPersona}. ALWAYS use the CSB translation.` }] }
    };

    try {
      let response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload })
      });
      const result = await response.json();
      return result.text || "Error retrieving scripture.";
    } catch (error) {
      return "Error: Unable to connect to the backend.";
    }
  };

  const processMessage = async (userMessage) => {
    const textToProcess = userMessage.trim();
    if (!textToProcess) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: textToProcess }]);
    setIsLoading(true);
    const aiResponse = await generateResponse(textToProcess);
    setMessages(prev => [...prev, { role: 'bot', text: aiResponse }]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0e0e] font-sans text-zinc-100">
      {/* Header */}
      <header className="bg-[#0f0e0e] border-b border-amber-500/30 p-4 flex items-center justify-center shadow-lg shadow-amber-900/10">
        <div className="flex items-center gap-3 w-full max-w-2xl">
          <div className="bg-amber-500 p-2 rounded-xl">
            <BookOpen size={22} className="text-zinc-950" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest leading-none uppercase text-white">{config.appName}</h1>
            <p className="text-amber-400 text-[10px] font-semibold uppercase tracking-widest mt-0.5">{config.tagline}</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto py-6 px-4 space-y-5 max-w-2xl w-full mx-auto">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex w-full gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'bot' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center mt-1">
                <BookOpen size={14} className="text-zinc-950" />
              </div>
            )}
            <div className={`px-4 py-3 rounded-2xl max-w-[82%] text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-amber-500 text-zinc-950 font-medium rounded-tr-sm shadow-md'
                : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700/50 rounded-tl-sm shadow-md'
            }`}>
              {msg.role === 'bot'
                ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                : <div>{msg.text}</div>
              }
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center mt-1">
                <Users size={14} className="text-zinc-300" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
              <BookOpen size={14} className="text-zinc-950" />
            </div>
            <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></span>
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span>
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Footer */}
      <div className="bg-[#0f0e0e] border-t border-zinc-800 px-4 pt-3 pb-4 shadow-xl">
        {messages.length === 1 && (
          <div className="max-w-2xl mx-auto flex flex-wrap gap-2 mb-3">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => processMessage(q)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-400 border border-zinc-700 hover:border-amber-500/50 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              >{q}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); processMessage(input); }} className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a verse, topic, or life question..."
            className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-amber-500 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 rounded-xl px-4 font-bold transition-colors flex items-center gap-1.5"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-center text-zinc-600 text-[10px] mt-2 max-w-2xl mx-auto">{config.footerDisclaimer}</p>
      </div>
    </div>
  );
}

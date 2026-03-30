import React, { useState, useRef, useEffect } from 'react';
    import { Send, BookOpen, User, Bot, Loader2, Mail, Users } from 'lucide-react';
    
    const config = {
      appName: "BIBLE BUDDIES",
      tagline: "Deep Truth. Real Talk.",
      pastorPersona: "Dr. Eric Mason",
      churchName: "Bible Buddies Community",
      welcomeMessage: "Welcome to Bible Buddies! Whether you are opening the Bible for the first time or you've been reading it for years, I'm here to help you study the Word. What topic or verse should we look at today?",
      footerDisclaimer: "Don't just take my word for it. Always verify by reading the full chapter yourself.",
    };
    
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
        <div className="flex flex-col h-screen bg-stone-100 font-sans text-zinc-900">
          <header className="bg-zinc-950 shadow-lg p-4 flex items-center justify-center border-b-4 border-amber-500">
            <div className="flex items-center gap-3 w-full max-w-3xl text-white">
              <Users size={28} className="text-amber-500" />
              <div>
                <h1 className="text-2xl font-black tracking-tight leading-none uppercase">{config.appName}</h1>
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-1">{config.tagline}</p>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 w-full max-w-3xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-amber-500 text-zinc-950 shadow-md rounded-tr-sm' : 'bg-white border-l-4 border-amber-500 shadow-lg rounded-tl-sm'}`}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>
              </div>
            ))}
            {isLoading && <div className="text-amber-500 font-bold animate-pulse uppercase tracking-widest text-xs">Digging into the Word...</div>}
            <div ref={messagesEndRef} />
          </main>
          <div className="bg-white border-t p-4 shadow-lg">
            {messages.length === 1 && (
              <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-2 mb-4">
                {suggestedQuestions.map((q, i) => (
                  <button key={i} onClick={() => processMessage(q)} className="bg-stone-100 text-zinc-600 border px-4 py-2 rounded-full text-xs font-bold hover:border-amber-500 transition-all">{q}</button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); processMessage(input); }} className="max-w-3xl mx-auto flex gap-3">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="What topic or verse should we explore?" className="flex-1 bg-stone-100 border-2 border-transparent rounded-xl p-4 focus:border-amber-500 outline-none" />
              <button type="submit" className="bg-zinc-950 text-amber-500 rounded-xl px-8 font-black uppercase text-sm">Ask</button>
            </form>
          </div>
        </div>
      );
    }
    

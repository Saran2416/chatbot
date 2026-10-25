'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function newConversation() {
  return { id: newId(), title: 'New chat', createdAt: Date.now(), messages: [] };
}

export default function Home() {
  const [conversations, setConversations] = useState([newConversation()]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);

  // Init active id + load from localStorage (Phase 2: conversation history)
  useEffect(() => {
    try {
      // Fall back to the old key so existing chats survive the switch to local Ollama
      const saved =
        localStorage.getItem('ollama-chat-conversations') ||
        localStorage.getItem('hf-chat-conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setActiveId(parsed[0].id);
          return;
        }
      }
    } catch {}
    setConversations((prev) => {
      setActiveId(prev[0].id);
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem('ollama-chat-conversations', JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  const active = conversations.find((c) => c.id === activeId) || conversations[0];

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages?.length, isLoading]);

  function handleNewChat() {
    const conv = newConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setError('');
    setSidebarOpen(false);
  }

  async function handleSend(e) {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return; // empty + double-submit guard

    setError('');
    setInput('');

    const userMsg = { role: 'user', content: text, time: Date.now() };
    const updatedMessages = [...(active.messages || []), userMsg];

    // Update title from first message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? {
              ...c,
              title: c.messages.length === 0 ? text.slice(0, 32) : c.title,
              messages: updatedMessages
            }
          : c
      )
    );
    setIsLoading(true);

    try {
      const controller = new AbortController();
      // Local CPU models can be slow: allow up to 10 minutes
      const timer = setTimeout(() => controller.abort(), 620000);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({ role, content }))
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const aiMsg = { role: 'assistant', content: data.reply, time: Date.now() };
      setConversations((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, messages: [...c.messages, aiMsg] } : c))
      );
    } catch (err) {
      const msg =
        err?.name === 'AbortError'
          ? 'The local model took too long to reply. Try a shorter question or a smaller model.'
          : err?.message || 'Something went wrong.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="new-btn" onClick={handleNewChat}>+ New Chat</button>
        <h2>History</h2>
        <div className="conv-list">
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`conv-item ${c.id === active?.id ? 'active' : ''}`}
              onClick={() => {
                setActiveId(c.id);
                setSidebarOpen(false);
                setError('');
              }}
            >
              {c.title || 'New chat'}
              <small>{c.messages.length} messages</small>
            </button>
          ))}
        </div>
      </aside>

      <div className="main">
        <div className="header">
          <button className="mobile-toggle" onClick={() => setSidebarOpen((v) => !v)}>
            ☰
          </button>
          <h1>Local Chatbot</h1>
          <p>Powered by Ollama · runs entirely on your machine</p>
        </div>

        <div className="messages">
          {!active || active.messages.length === 0 ? (
            <div className="empty">
              <h3>👋 Start a conversation</h3>
              <p style={{ marginTop: 8, fontSize: 13 }}>
                Ask anything. No API key needed — your messages never leave this machine.
              </p>
            </div>
          ) : (
            active.messages.map((m, i) => (
              <div key={i} className={`bubble-row ${m.role === 'user' ? 'user' : ''}`}>
                <div>
                  <div className={`bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
                    {m.role === 'user' ? (
                      m.content
                    ) : (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    )}
                  </div>
                  {m.time && (
                    <div className="timestamp">
                      {m.role === 'user' ? 'You' : 'AI'} · {new Date(m.time).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="bubble-row">
              <div className="bubble ai">
                <span className="typing"><span /><span /><span /></span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {error && <div className="error-bar">⚠️ {error}</div>}

        <form className="composer" onSubmit={handleSend}>
          <div className="composer-inner">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              maxLength={4000}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
          <div className="hint">
            Enter to send · the first reply may take a few minutes while the model loads
          </div>
        </form>
      </div>
    </div>
  );
}

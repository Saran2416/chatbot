'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

const STORAGE_KEY = 'ollama-chat-conversations';
const LEGACY_STORAGE_KEY = 'hf-chat-conversations';
const MODEL_STORAGE_KEY = 'ollama-chat-model';

const SUGGESTIONS = [
  {
    icon: 'bulb',
    title: 'Explain a concept',
    text: 'Break down a difficult idea in simple terms.',
    prompt: 'Explain how transformer neural networks work in simple terms.'
  },
  {
    icon: 'code',
    title: 'Debug some code',
    text: 'Find the bug and get a clear fix.',
    prompt: 'Help me debug a piece of code. Ask me to paste it first, then explain the fix.'
  },
  {
    icon: 'mail',
    title: 'Draft an email',
    text: 'Write something clear and professional.',
    prompt: 'Draft a short professional email asking a client to reschedule a meeting.'
  },
  {
    icon: 'book',
    title: 'Summarise text',
    text: 'Turn long notes into key points.',
    prompt: 'Summarise a piece of text into concise bullet points. Ask me to paste it first.'
  }
];

const ICON_PATHS = {
  spark: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 17.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  alert: (
    <>
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </>
  ),
  code: (
    <>
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 6l-10 7L2 6" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  arrow: <path d="M7 17L17 7M7 7h10v10" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  chip: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </>
  )
};

function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function newConversation() {
  return { id: newId(), title: 'New chat', createdAt: Date.now(), messages: [] };
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

const STATUS_LABELS = {
  checking: 'Checking',
  online: 'Ready',
  missing: 'Not installed',
  offline: 'Ollama offline'
};

export default function Home() {
  const [conversations, setConversations] = useState(() => [newConversation()]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [ready, setReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [status, setStatus] = useState({
    state: 'checking',
    defaultModel: 'deepseek-r1:14b',
    models: [],
    baseUrl: ''
  });

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);
  const stoppedRef = useRef(false);
  const modelMenuRef = useRef(null);

  // Load saved history once, then allow persistence.
  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setActiveId(parsed[0].id);
          setReady(true);
          return;
        }
      }
    } catch {}
    const conv = newConversation();
    setConversations([conv]);
    setActiveId(conv.id);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {}
  }, [conversations, ready]);

  const active = conversations.find((c) => c.id === activeId) || conversations[0];
  const activeMessages = active?.messages || [];
  const filteredConversations = conversations.filter((c) =>
    (c.title || 'New chat').toLowerCase().includes(query.trim().toLowerCase())
  );

  const displayModel = selectedModel || status.defaultModel || 'deepseek-r1:14b';
  const selectedModelInfo = status.models.find((m) => m.name === displayModel);
  const modelState =
    status.state === 'checking'
      ? 'checking'
      : status.state === 'offline'
        ? 'offline'
        : selectedModelInfo?.installed
          ? 'online'
          : 'missing';
  const statusLabel = STATUS_LABELS[modelState] || STATUS_LABELS.offline;

  // Live Ollama / model status
  const checkStatus = useCallback(async (showChecking = true) => {
    if (showChecking) setStatus((prev) => ({ ...prev, state: 'checking' }));
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!data) throw new Error('bad response');
      setStatus({
        state: data.online ? 'online' : 'offline',
        defaultModel: data.defaultModel || data.model || 'deepseek-r1:14b',
        models: Array.isArray(data.models) ? data.models : [],
        baseUrl: data.baseUrl || ''
      });
    } catch {
      setStatus((prev) => ({ ...prev, state: 'offline' }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const id = setInterval(() => checkStatus(false), 30000);
    return () => clearInterval(id);
  }, [checkStatus]);

  // Restore the model choice and keep it valid as the configured list changes.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved) setSelectedModel(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (status.models.length === 0) return;
    setSelectedModel((prev) => {
      if (prev && status.models.some((m) => m.name === prev)) return prev;
      return status.defaultModel;
    });
  }, [status.models, status.defaultModel]);

  useEffect(() => {
    if (!selectedModel) return;
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch {}
  }, [selectedModel]);

  // Close the model menu when clicking elsewhere.
  useEffect(() => {
    if (!modelMenuOpen) return undefined;
    const onPointerDown = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [modelMenuOpen]);

  // Unload models when the tab or app is closed so they do not linger in RAM.
  useEffect(() => {
    const onPageHide = (event) => {
      // Do not unload when the page is only entering the back/forward cache.
      if (event.persisted) return;

      const url = '/api/models/stop';
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
      }
    };

    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  // Elapsed timer during generation (local models can be slow).
  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, isLoading]);

  // Auto-grow the composer.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Document title + Escape / delete-confirmation cleanup.
  useEffect(() => {
    const title = active?.title && active.title !== 'New chat' ? active.title : 'Local AI Chat';
    document.title = `${title} · Local AI`;
  }, [active?.title]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setConfirmDelete(null);
        setModelMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!confirmDelete) return undefined;
    const id = setTimeout(() => setConfirmDelete(null), 3000);
    return () => clearTimeout(id);
  }, [confirmDelete]);

  function stopRequest() {
    stoppedRef.current = true;
    abortRef.current?.abort();
  }

  async function generateReply(conversationId, history) {
    setIsLoading(true);
    setError('');
    setElapsed(0);
    stoppedRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;
    // Local CPU models can take a while; allow up to 10 minutes.
    const timer = setTimeout(() => controller.abort(), 620000);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel || undefined,
          messages: history.map(({ role, content }) => ({ role, content }))
        }),
        signal: controller.signal
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const aiMsg = {
        role: 'assistant',
        content: data.reply,
        time: Date.now(),
        model: data.model || displayModel
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, messages: [...history, aiMsg] } : c
        )
      );
    } catch (err) {
      if (err?.name === 'AbortError') {
        if (!stoppedRef.current) {
          setError(
            'The local model took too long to reply. Try a shorter question or a smaller model.'
          );
        }
      } else {
        setError(err?.message || 'Something went wrong.');
      }
    } finally {
      clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
      checkStatus(false);
    }
  }

  function sendMessage(text) {
    const value = (text ?? input).trim();
    if (!value || isLoading || !active) return;

    setError('');
    setInput('');
    setConfirmDelete(null);
    setModelMenuOpen(false);

    const userMsg = { role: 'user', content: value, time: Date.now() };
    const updatedMessages = [...activeMessages, userMsg];
    const isFirst = activeMessages.length === 0;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? {
              ...c,
              title: isFirst ? value.slice(0, 48) : c.title,
              messages: updatedMessages
            }
          : c
      )
    );

    generateReply(active.id, updatedMessages);
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function regenerate() {
    if (!active || isLoading) return;
    let history = [...activeMessages];
    while (history.length > 0 && history[history.length - 1].role === 'assistant') {
      history = history.slice(0, -1);
    }
    if (history.length === 0) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, messages: history } : c))
    );
    generateReply(active.id, history);
  }

  function chooseModel(name) {
    // Unload every other model right away; the selected one loads on the next message.
    fetch('/api/models/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: name })
    })
      .then(() => checkStatus(false))
      .catch(() => {});
    setSelectedModel(name);
    setModelMenuOpen(false);
    setError('');
  }

  async function unloadAllModels() {
    if (stopping) return;
    setStopping(true);
    try {
      const res = await fetch('/api/models/stop', { method: 'POST' });
      if (!res.ok) throw new Error();
      await checkStatus(false);
    } catch {
      setError('Could not unload models from memory.');
    } finally {
      setStopping(false);
    }
  }

  function newChat() {
    if (isLoading) stopRequest();
    const conv = newConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setError('');
    setInput('');
    setQuery('');
    setSidebarOpen(false);
    setConfirmDelete(null);
  }

  function selectConversation(id) {
    setActiveId(id);
    setSidebarOpen(false);
    setError('');
    setInput('');
    setConfirmDelete(null);
  }

  function deleteConversation(id) {
    if (isLoading && id === active?.id) stopRequest();
    setConfirmDelete(null);

    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const conv = newConversation();
      setConversations([conv]);
      setActiveId(conv.id);
      return;
    }
    setConversations(remaining);
    if (active?.id === id) setActiveId(remaining[0].id);
    setError('');
  }

  async function copyMessage(text, key) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1800);
    } catch {
      setError('Could not copy to the clipboard.');
    }
  }

  return (
    <div className="app">
      {sidebarOpen && (
        <button
          type="button"
          className="backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Icon name="spark" size={20} />
          </span>
          <div className="brand-copy">
            <strong>Local AI</strong>
            <span>Ollama · DeepSeek</span>
          </div>
          <button
            type="button"
            className="icon-btn sidebar-close"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <button type="button" className="new-btn" onClick={newChat}>
          <Icon name="plus" size={17} />
          New chat
        </button>

        <div className="search-box">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <Icon name="close" size={13} />
            </button>
          )}
        </div>

        <div className="list-head">
          <span>Recent</span>
          <span className="count">{conversations.length}</span>
        </div>

        <div className="conv-list">
          {filteredConversations.length === 0 ? (
            <div className="list-empty">No chats found</div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === active?.id;
              const count = c.messages?.length || 0;
              const confirming = confirmDelete === c.id;
              return (
                <div
                  className={`conv-row ${isActive ? 'active' : ''}`}
                  key={c.id}
                  onMouseLeave={() => {
                    if (confirming) setConfirmDelete(null);
                  }}
                >
                  <button
                    type="button"
                    className="conv-item"
                    onClick={() => selectConversation(c.id)}
                    title={c.title || 'New chat'}
                  >
                    <span className="conv-title">{c.title || 'New chat'}</span>
                    <span className="conv-meta">
                      {count} {count === 1 ? 'message' : 'messages'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`conv-delete ${confirming ? 'confirm' : ''}`}
                    aria-label={confirming ? 'Confirm delete chat' : 'Delete chat'}
                    title={confirming ? 'Click again to delete' : 'Delete chat'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirming) deleteConversation(c.id);
                      else setConfirmDelete(c.id);
                    }}
                  >
                    {confirming ? 'Delete?' : <Icon name="trash" size={14} />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="sidebar-footer">
          <div className="privacy-card">
            <Icon name="shield" size={18} />
            <div>
              <strong>Private by design</strong>
              <span>Chats stay here. No cloud keys; models unload on close.</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div className="header-left">
            <button
              type="button"
              className="icon-btn mobile-toggle"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <Icon name="menu" size={18} />
            </button>
            <div className="header-copy">
              <h1>{active?.title && active.title !== 'New chat' ? active.title : 'New chat'}</h1>
              <p>
                {activeMessages.length} {activeMessages.length === 1 ? 'message' : 'messages'} ·
                stored on this device
              </p>
            </div>
          </div>

          <div className="header-right">
            <div className="model-switcher" ref={modelMenuRef}>
              <button
                type="button"
                className={`model-trigger ${modelState}`}
                onClick={() => setModelMenuOpen((v) => !v)}
                title={
                  status.baseUrl
                    ? `${status.baseUrl} · switch model`
                    : 'Switch model'
                }
                aria-haspopup="menu"
                aria-expanded={modelMenuOpen}
                aria-live="polite"
              >
                <span className="status-dot" />
                <span className="model-trigger-copy">
                  <span className="status-model">{displayModel}</span>
                  <span className="status-label">{statusLabel}</span>
                </span>
                <Icon
                  name="chevron"
                  size={14}
                  className={`model-chevron ${modelMenuOpen ? 'open' : ''}`}
                />
              </button>

              {modelMenuOpen && (
                <div className="model-menu" role="menu">
                  <div className="model-menu-head">
                    <span>Choose model</span>
                    <button
                      type="button"
                      className="menu-refresh"
                      onClick={() => checkStatus()}
                      aria-label="Refresh models"
                      title="Refresh"
                    >
                      <Icon
                        name="refresh"
                        size={14}
                        className={status.state === 'checking' ? 'spinning' : ''}
                      />
                    </button>
                  </div>

                  <div className="model-options">
                    {status.models.length === 0 ? (
                      <div className="model-menu-empty">
                        {status.state === 'checking'
                          ? 'Checking Ollama…'
                          : 'No models configured. Add them to OLLAMA_MODELS.'}
                      </div>
                    ) : (
                      status.models.map((m) => {
                        const current = m.name === displayModel;
                        return (
                          <button
                            type="button"
                            key={m.name}
                            role="menuitemradio"
                            aria-checked={current}
                            className={`model-option ${current ? 'selected' : ''} ${
                              m.installed ? '' : 'missing'
                            }`}
                            onClick={() => chooseModel(m.name)}
                            disabled={isLoading}
                            title={
                              m.installed
                                ? m.name
                                : `Not installed. Run: ollama pull ${m.name}`
                            }
                          >
                            <span className="model-option-icon">
                              <Icon name="chip" size={16} />
                            </span>
                            <span className="model-option-copy">
                              <strong>{m.name}</strong>
                              <small>
                                {m.loaded
                                  ? 'Loaded in memory'
                                  : m.installed
                                    ? 'Ready · loads on next message'
                                    : `Not installed · ollama pull ${m.name}`}
                              </small>
                            </span>
                            {current && (
                              <Icon name="check" size={15} className="model-check" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="model-menu-actions">
                    <button
                      type="button"
                      className="menu-stop"
                      onClick={unloadAllModels}
                      disabled={stopping || isLoading}
                      title="Unload all models from memory"
                    >
                      <Icon name="stop" size={12} />
                      {stopping ? 'Unloading…' : 'Unload models from memory'}
                    </button>
                  </div>

                  <div className="model-menu-foot">
                    Closing this tab unloads the model. Switching unloads the previous one,
                    and the selected model loads on your next message.
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="messages">
          <div className="messages-inner">
            {activeMessages.length === 0 ? (
              <div className="empty">
                <div className="empty-mark">
                  <Icon name="spark" size={28} />
                </div>
                <h2>How can I help you today?</h2>
                <p className="empty-sub">
                  Ask anything. <span className="model-chip">{displayModel}</span> runs locally —
                  nothing leaves this machine.
                </p>

                <div className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button
                      type="button"
                      className="suggestion"
                      key={s.title}
                      onClick={() => sendMessage(s.prompt)}
                      disabled={isLoading}
                    >
                      <span className="suggestion-icon">
                        <Icon name={s.icon} size={17} />
                      </span>
                      <span className="suggestion-text">
                        <strong>{s.title}</strong>
                        <small>{s.text}</small>
                      </span>
                      <Icon name="arrow" size={15} className="suggestion-arrow" />
                    </button>
                  ))}
                </div>

                {modelState === 'offline' && (
                  <div className="setup-note">
                    <Icon name="alert" size={14} />
                    <span>
                      Ollama is not reachable. Start it with <code>ollama serve</code>, then
                      refresh the status above.
                    </span>
                  </div>
                )}
                {modelState === 'missing' && (
                  <div className="setup-note">
                    <Icon name="alert" size={14} />
                    <span>
                      Model not installed. Run <code>ollama pull {displayModel}</code>, or
                      switch models from the menu above.
                    </span>
                  </div>
                )}

                <div className="empty-note">
                  <Icon name="shield" size={14} />
                  Private &amp; offline · no API keys required
                </div>
              </div>
            ) : (
              activeMessages.map((m, i) => {
                const isUser = m.role === 'user';
                const isLast = i === activeMessages.length - 1;
                const key = `${active.id}-${i}`;
                return (
                  <div className={`message ${isUser ? 'user' : 'assistant'}`} key={key}>
                    <div className="avatar">
                      <Icon name={isUser ? 'user' : 'spark'} size={16} />
                    </div>
                    <div className="message-body">
                      <div className="message-meta">
                        <strong>{isUser ? 'You' : 'Assistant'}</strong>
                        {!isUser && m.model && (
                          <span className="message-model">{m.model}</span>
                        )}
                        {m.time && <time>{formatTime(m.time)}</time>}
                      </div>
                      <div className={`bubble ${isUser ? 'user' : 'ai'}`}>
                        {isUser ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
                      </div>
                      <div className="message-actions">
                        <button
                          type="button"
                          className={`action-btn ${copiedKey === key ? 'copied' : ''}`}
                          onClick={() => copyMessage(m.content, key)}
                          aria-label="Copy message"
                        >
                          <Icon name={copiedKey === key ? 'check' : 'copy'} size={13} />
                          {copiedKey === key ? 'Copied' : 'Copy'}
                        </button>
                        {isLast && !isLoading && (
                          <button
                            type="button"
                            className="action-btn"
                            onClick={regenerate}
                            aria-label={isUser ? 'Retry message' : 'Regenerate reply'}
                          >
                            <Icon name="refresh" size={13} />
                            {isUser ? 'Retry' : 'Regenerate'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="message assistant">
                <div className="avatar">
                  <Icon name="spark" size={16} />
                </div>
                <div className="message-body">
                  <div className="message-meta">
                    <strong>Assistant</strong>
                    <time>{elapsed}s</time>
                  </div>
                  <div className="bubble ai loading-bubble">
                    <span className="typing">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="loading-text">
                      Generating{elapsed > 0 ? ` · ${elapsed}s` : '…'}
                    </span>
                    <button type="button" className="stop-btn" onClick={stopRequest}>
                      Stop
                    </button>
                  </div>
                  <div className="loading-hint">
                    The first reply with {displayModel} can take a few minutes while the model
                    loads into memory.
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {error && (
          <div className="alert" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
            <button
              type="button"
              className="alert-close"
              aria-label="Dismiss error"
              onClick={() => setError('')}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        <div className="composer">
          <form className="composer-box" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${displayModel}…`}
              rows={1}
              maxLength={4000}
              aria-label="Message"
            />
            <div className="composer-row">
              <span className="composer-hint">
                Enter to send · Shift + Enter for a new line
              </span>
              <button
                type="submit"
                className="send-btn"
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                title="Send message"
              >
                <Icon name="send" size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

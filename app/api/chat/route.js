import { NextResponse } from 'next/server';

// POST /api/chat
// Body: { messages: [{ role: 'user'|'assistant'|'system', content: string }] }
// Server calls the local Ollama instance (default http://localhost:11434).
// No cloud API key is needed; the model runs on your machine.

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'deepseek-r1:14b';

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Remove inline chain-of-thought blocks some models emit (e.g.  thinking...<｜end▁of▁thinking｜>)
function stripThinking(text) {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<｜begin▁of▁thinking｜>[\s\S]*?<｜end▁of▁thinking｜>/g, '')
    .trim();
}

function ollamaErrorMessage(status, data, model) {
  const raw =
    typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string'
        ? data.message
        : '';

  if (status === 404) {
    return `Model "${model}" is not installed. Run: ollama pull ${model}`;
  }
  if (status === 401 || status === 403) {
    return 'Ollama rejected the request. Check OLLAMA_API_KEY if you use an authenticated proxy.';
  }
  if (status === 429) {
    return 'Ollama is busy (429). Wait a moment and try again.';
  }
  if (status >= 500) {
    return (
      raw.slice(0, 300) ||
      'Ollama failed to generate a reply. The model may be out of memory — try a smaller one.'
    );
  }
  return (raw || `Ollama request failed (${status}).`).slice(0, 300);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'Invalid request: messages array is required.' }, { status: 400 });
    }

    // Validate + trim messages, drop empties
    const messages = body.messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-20) // keep last 20 to limit context
      .map((m) => ({
        role: ['system', 'assistant', 'user'].includes(m.role) ? m.role : 'user',
        content: m.content.trim().slice(0, 4000) // per-message cap
      }));

    if (!messages.some((m) => m.role !== 'system')) {
      return NextResponse.json({ error: 'Please enter a message.' }, { status: 400 });
    }

    const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
    const apiKey = process.env.OLLAMA_API_KEY;
    const maxTokens = toNumber(process.env.OLLAMA_MAX_TOKENS, 512);
    const temperature = toNumber(process.env.OLLAMA_TEMPERATURE, 0.7);
    const keepAlive = process.env.OLLAMA_KEEP_ALIVE || '30m';
    const showThinking = process.env.OLLAMA_SHOW_THINKING === 'true';
    const systemPrompt =
      process.env.OLLAMA_SYSTEM_PROMPT || 'You are a helpful, concise AI assistant.';
    // Local CPU models can take a while to load and answer. 10 minutes by default.
    const timeoutMs = toNumber(process.env.OLLAMA_TIMEOUT_MS, 600000);

    const clientSystem = messages.filter((m) => m.role === 'system');
    const conversation = messages.filter((m) => m.role !== 'system');
    const requestMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...clientSystem,
      ...conversation
    ];

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let ollamaRes;
    try {
      ollamaRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: requestMessages,
          stream: false,
          think: showThinking,
          keep_alive: keepAlive,
          options: {
            temperature,
            num_predict: maxTokens
          }
        }),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err && err.name === 'AbortError') {
        return NextResponse.json(
          { error: `Ollama took longer than ${Math.round(timeoutMs / 1000)}s to reply. Try a shorter question or a smaller model.` },
          { status: 504 }
        );
      }
      return NextResponse.json(
        {
          error: `Cannot reach Ollama at ${baseUrl}. Make sure it is running: ollama serve`
        },
        { status: 503 }
      );
    }
    clearTimeout(timeout);

    const data = await ollamaRes.json().catch(() => null);

    if (!ollamaRes.ok) {
      return NextResponse.json(
        { error: ollamaErrorMessage(ollamaRes.status, data, model) },
        { status: ollamaRes.status }
      );
    }

    const thinking = typeof data?.message?.thinking === 'string' ? data.message.thinking.trim() : '';
    let reply =
      typeof data?.message?.content === 'string' ? data.message.content.trim() : '';

    if (!showThinking) {
      reply = stripThinking(reply);
    } else if (thinking) {
      reply = `**Reasoning**\n\n${thinking}\n\n---\n\n${reply}`;
    }

    if (!reply) {
      return NextResponse.json({ error: 'Ollama returned an empty reply. Please try again.' }, { status: 502 });
    }

    return NextResponse.json({ reply, model });
  } catch (err) {
    // Never log request contents or secrets; keep it to the error message.
    console.error('API /api/chat error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error. Please try again.' }, { status: 500 });
  }
}

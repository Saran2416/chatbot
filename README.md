# Local Chatbot — Next.js + Ollama (DeepSeek-R1)

Web-based AI chatbot that runs entirely on your machine. React UI → Next.js API route →
local Ollama server → `deepseek-r1:14b`. No cloud API key, no usage costs.

## 1. Prerequisites

- Node.js 18+ (`node -v`)
- npm (comes with Node)
- [Ollama](https://ollama.com) installed and running (`ollama --version`)
- The model pulled locally:

  ```bash
  ollama pull deepseek-r1:14b
  ```

  Check what you have:

  ```bash
  ollama list
  ```

## 2. Project structure

```
chatbot/
  package.json            # next, react, react-dom, react-markdown
  next.config.js
  .env.example            # committed template
  .env.local              # your local config (gitignored)
  app/
    layout.js             # root layout + page metadata
    globals.css           # all styles, responsive + mobile
    page.js               # 'use client' chat UI: sidebar, bubbles, history
    api/chat/route.js     # POST /api/chat → calls local Ollama
    api/status/route.js   # GET /api/status → Ollama/model health for the UI badge
```

Data flow:

```
Browser (app/page.js)
  → POST /api/chat (Next.js server)
    → http://localhost:11434/api/chat
      → deepseek-r1:14b (Ollama, local)
    → reply → browser
```

The browser never talks to Ollama directly, so the API stays server-side.

## 3. Setup

```bash
cd chatbot
ollama serve          # only if it is not already running as a service
ollama pull deepseek-r1:14b
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

The default `.env.local` is already configured for DeepSeek:

```dotenv
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:14b
```

Production check:

```bash
npm run build
npm start
```

## 4. Optional configuration

All values live in `.env.local`; restart `npm run dev` after changing them.

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama address (no `/v1` suffix) |
| `OLLAMA_MODEL` | `deepseek-r1:14b` | Model name as shown by `ollama list` |
| `OLLAMA_KEEP_ALIVE` | `30m` | Keep the model in RAM between requests |
| `OLLAMA_MAX_TOKENS` | `512` | Max generated tokens per reply |
| `OLLAMA_TEMPERATURE` | `0.7` | Response creativity |
| `OLLAMA_SHOW_THINKING` | `false` | Show DeepSeek-R1 reasoning before the answer |
| `OLLAMA_TIMEOUT_MS` | `600000` | Server wait before timeout (10 min) |
| `OLLAMA_SYSTEM_PROMPT` | helpful/concise | System prompt prepended to every chat |
| `OLLAMA_API_KEY` | unset | Only for an authenticated proxy in front of Ollama |

## 5. How to use / test

1. Open the app: you should see "How can I help you today?".
2. Type a message → Enter or Send → typing dots + elapsed timer → reply with Markdown.
   Shift + Enter adds a new line in the composer.
3. Use the suggestion cards on the empty screen for a quick start.
4. `+ New chat` creates a conversation; search, switch, or delete them in the sidebar.
5. Copy any message and regenerate the last assistant reply from the message actions.
6. The status badge shows whether Ollama is online and the model is installed; click it
   to re-check. It refreshes automatically every 30 seconds.
7. Reload → history persists in `localStorage`.
8. Mobile: ☰ opens the sidebar as an overlay.
9. API test without the browser:

   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Hello"}]}'
   ```

   Expect `{"reply":"...","model":"deepseek-r1:14b"}`.

10. Ollama test without Next.js:

   ```bash
   curl http://localhost:11434/api/chat \
     -d '{"model":"deepseek-r1:14b","messages":[{"role":"user","content":"Hello"}],"stream":false}'
   ```

## 6. Performance notes (CPU)

DeepSeek-R1 14B is a large model. On a CPU-only machine:

- The **first** request loads ~9 GB into RAM and can take **1–3 minutes**.
- Generation is roughly **1–2 tokens/second**, so long answers take minutes.
- `OLLAMA_KEEP_ALIVE=30m` avoids reloading the model between messages.
- The UI and API both wait up to ~10 minutes.

If that is too slow, use a smaller model (see below) or a machine with a supported GPU.

## 7. Switching models

Any model installed in Ollama works. Change one line and restart:

```dotenv
OLLAMA_MODEL=qwen2.5-coder:7b
# or
OLLAMA_MODEL=deepseek-r1:7b
```

No frontend change is needed — the model name is only read server-side.

## 8. Common errors and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot reach Ollama at http://localhost:11434` | Ollama is not running | `ollama serve` (or start the Ollama app) |
| `Model "..." is not installed` | model name typo / not pulled | `ollama pull deepseek-r1:14b`, check `ollama list` |
| Reply takes 2+ minutes on first message | cold model load | wait; keep `OLLAMA_KEEP_ALIVE=30m` |
| `Ollama took longer than 600s` | slow CPU / very long answer | shorter question, smaller model, raise `OLLAMA_TIMEOUT_MS` |
| `Ollama failed to generate... out of memory` | 14B does not fit in RAM | close apps or use a 7B model |
| Reply is cut off | `OLLAMA_MAX_TOKENS=512` | raise it (slower) |
| Blank/empty reply | generation stopped early | retry or raise `OLLAMA_MAX_TOKENS` |

Check the actual Ollama errors in the terminal running `ollama serve`.

## 9. Security notes

- No cloud credentials are used; messages stay on the machine.
- Ollama has **no authentication** by default. Keep `11434` bound to localhost and never
  expose it to the internet without a proxy/auth layer.
- `.env.local` is gitignored. Commit only `.env.example`.
- Input is validated server-side: non-empty, max 20 messages, 4000 chars each.
- The API route only contacts the configured `OLLAMA_BASE_URL`; the UI cannot choose it.

## 10. Deployment

This setup assumes Ollama runs on the same machine as Next.js.

- **Local / LAN VPS:** run `ollama serve` as a service, then `npm run build && npm start`.
- **Vercel/serverless:** not suitable for a local model. Use a GPU host that runs both
  Next.js and Ollama, or point `OLLAMA_BASE_URL` at an authenticated remote Ollama.
- Set the same env vars from `.env.local` in the deployment environment.

## 11. Future ideas

- Streaming replies (`stream: true` + SSE) so tokens appear as they are generated
- Auth + Postgres/Prisma for persistent history
- Model switcher dropdown (whitelist server-side)
- Voice in (Web Speech API) / TTS out
- File/PDF chat + RAG (embeddings)

# Local Chatbot — Next.js + Ollama (DeepSeek & Qwen)

Web-based AI chatbot that runs entirely on your machine. React UI → Next.js API route →
local Ollama server. Switch between `deepseek-r1:14b` and `qwen2.5-coder:7b` from the
header. No cloud API key, no usage costs.

## 1. Prerequisites

- Node.js 18+ (`node -v`)
- npm (comes with Node)
- [Ollama](https://ollama.com) installed and running (`ollama --version`)
- At least one of the two models pulled locally:

  ```bash
  ollama pull deepseek-r1:14b
  ollama pull qwen2.5-coder:7b
  ```

  Check what you have:

  ```bash
  ollama list
  ```

## 2. Project structure

```
chatbot/
  package.json                    # next, react, react-dom, react-markdown
  next.config.js
  .env.example                    # committed template
  .env.local                      # your local config (gitignored)
  scripts/next-with-unload.js     # unloads models when dev/start exits
  app/
    layout.js                     # root layout + page metadata
    globals.css                   # all styles, responsive + mobile
    page.js                       # 'use client' chat UI + model switcher
    lib/ollama.js                 # shared Ollama config (allowlist, base URL)
    api/chat/route.js             # POST /api/chat → calls the selected model
    api/status/route.js           # GET /api/status → online/installed/loaded models
    api/models/select/route.js    # POST /api/models/select → unloads other models
    api/models/stop/route.js      # POST /api/models/stop → unloads all models
```

Data flow:

```
Browser (app/page.js)
  → POST /api/chat { model, messages }
    → http://localhost:11434/api/chat
      → selected model (Ollama, local)
    → reply → browser
```

The browser never talks to Ollama directly, so the API stays server-side and the model
allowlist is enforced by the server.

## 3. Setup

```bash
cd chatbot
ollama serve          # only if it is not already running as a service
ollama pull deepseek-r1:14b
ollama pull qwen2.5-coder:7b
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

The default `.env.local` exposes both models in the switcher:

```dotenv
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:14b
OLLAMA_MODELS=deepseek-r1:14b,qwen2.5-coder:7b
```

`OLLAMA_MODEL` is the initial default. `OLLAMA_MODELS` is the list offered in the UI
(the default is always included).

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
| `OLLAMA_MODEL` | `deepseek-r1:14b` | Initial/default model |
| `OLLAMA_MODELS` | `deepseek-r1:14b,qwen2.5-coder:7b` | Comma-separated models offered in the switcher |
| `OLLAMA_KEEP_ALIVE` | `30m` | Idle fallback before Ollama unloads a model; the tab close also unloads it |
| `OLLAMA_MAX_TOKENS` | `512` | Max generated tokens per reply |
| `OLLAMA_TEMPERATURE` | `0.7` | Response creativity |
| `OLLAMA_SHOW_THINKING` | `false` | Show DeepSeek-R1 reasoning before the answer |
| `OLLAMA_TIMEOUT_MS` | `600000` | Server wait before timeout (10 min) |
| `OLLAMA_SYSTEM_PROMPT` | helpful/concise | System prompt prepended to every chat |
| `OLLAMA_API_KEY` | unset | Only for an authenticated proxy in front of Ollama |

Models not listed in `OLLAMA_MODELS` are rejected by the API — the UI cannot load an
arbitrary model.

## 5. How to use / test

1. Open the app: you should see "How can I help you today?".
2. Type a message → Enter or Send → typing dots + elapsed timer → reply with Markdown.
   Shift + Enter adds a new line in the composer.
3. Use the suggestion cards on the empty screen for a quick start.
4. Click the model badge in the header to switch models. The menu shows which model is
   installed and which is currently loaded. Use **Unload models from memory** there to
   free RAM immediately.
5. `+ New chat` creates a conversation; search, switch, or delete them in the sidebar.
6. Copy any message and regenerate the last assistant reply from the message actions.
7. The badge also shows connection state; open the menu and click refresh to re-check.
   It refreshes automatically every 30 seconds.
8. Reload → history and your model choice persist in `localStorage`.
9. Mobile: ☰ opens the sidebar as an overlay.
10. Close the tab or stop the dev server; the loaded model is unloaded automatically.

API examples:

```bash
# Chat with the default model
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# Chat with a specific model
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-coder:7b","messages":[{"role":"user","content":"Hello"}]}'

# Health, installed and loaded models
curl http://localhost:3000/api/status

# Select a model and unload all others
curl -X POST http://localhost:3000/api/models/select \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-coder:7b"}'

# Unload every model from memory
curl -X POST http://localhost:3000/api/models/stop
```

Expect chat replies shaped like `{"reply":"...","model":"qwen2.5-coder:7b"}`.

Ollama test without Next.js:

```bash
curl http://localhost:11434/api/chat \
  -d '{"model":"deepseek-r1:14b","messages":[{"role":"user","content":"Hello"}],"stream":false}'
```

## 6. How model switching and unloading work

- The UI sends the selected model with every chat request.
- Switching models calls `/api/models/select`, which unloads every other model with
  `keep_alive: 0`. This keeps only the selected model in memory.
- The selected model is **not preloaded**. Ollama loads it lazily on your next message,
  so browsing models does not consume RAM.
- Closing or leaving the tab sends `POST /api/models/stop` with `navigator.sendBeacon`,
  which unloads every model immediately. Back/forward-cache navigation is ignored.
- Stopping `npm run dev` or `npm start` (Ctrl+C / SIGTERM) also unloads every model:
  the npm script wraps Next.js and runs the cleanup after the server exits.
- The model menu also has **Unload models from memory** for a manual unload.
- If an unload request cannot be delivered (for example, the server is already gone),
  Ollama still releases the model after `OLLAMA_KEEP_ALIVE` (30 minutes by default).
- The switcher marks the loaded model and the status endpoint reports it via `/api/ps`.
- The model choice is stored in `localStorage`; reloading the page keeps it.

## 7. Performance notes (CPU)

DeepSeek-R1 14B is a large model. On a CPU-only machine:

- The **first** request loads ~9 GB into RAM and can take **1–3 minutes**.
- Generation is roughly **1–2 tokens/second**, so long answers take minutes.
- `qwen2.5-coder:7b` is much faster (~5 GB, better for coding tasks and quick chats).
- `OLLAMA_KEEP_ALIVE=30m` avoids reloading the selected model between messages.
- The UI and API both wait up to ~10 minutes.

If DeepSeek is too slow, switch to Qwen in the header or use a machine with a supported GPU.

## 8. Adding or changing models

Install the model, then add it to `OLLAMA_MODELS` and restart:

```bash
ollama pull deepseek-r1:7b
```

```dotenv
OLLAMA_MODELS=deepseek-r1:14b,qwen2.5-coder:7b,deepseek-r1:7b
```

To change the default selection:

```dotenv
OLLAMA_MODEL=qwen2.5-coder:7b
```

No frontend change is needed — the switcher reads the list from the server.

## 9. Common errors and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot reach Ollama at http://localhost:11434` | Ollama is not running | `ollama serve` (or start the Ollama app) |
| `Model "..." is not installed` | model not pulled | `ollama pull <model>`, check `ollama list` |
| `Model "..." is not enabled` | missing from allowlist | add it to `OLLAMA_MODELS`, restart |
| Model shows "Not installed" in the menu | not pulled locally | run the `ollama pull` command shown in the menu |
| Reply takes 2+ minutes on first message | cold model load | wait; the model is loaded lazily |
| Model still uses RAM after closing the tab | unload request did not reach the server | open the menu and click **Unload models from memory**, or wait for `OLLAMA_KEEP_ALIVE` |
| `Ollama took longer than 600s` | slow CPU / very long answer | shorter question, switch to Qwen, raise `OLLAMA_TIMEOUT_MS` |
| `Ollama failed to generate... out of memory` | 14B does not fit in RAM | switch to Qwen 7B or close other apps |
| Reply is cut off | `OLLAMA_MAX_TOKENS=512` | raise it (slower) |
| Blank/empty reply | generation stopped early | retry or raise `OLLAMA_MAX_TOKENS` |

Check the actual Ollama errors in the terminal running `ollama serve`.

## 10. Security notes

- No cloud credentials are used; messages stay on the machine.
- Ollama has **no authentication** by default. Keep `11434` bound to localhost and never
  expose it to the internet without a proxy/auth layer.
- `.env.local` is gitignored. Commit only `.env.example`.
- Input is validated server-side: non-empty, max 20 messages, 4000 chars each.
- The model name is validated against the `OLLAMA_MODELS` allowlist on every request.
- The API routes only contact the configured `OLLAMA_BASE_URL`; the UI cannot choose it.

## 11. Deployment

This setup assumes Ollama runs on the same machine as Next.js.

- **Local / LAN VPS:** run `ollama serve` as a service, then `npm run build && npm start`.
- **Vercel/serverless:** not suitable for a local model. Use a GPU host that runs both
  Next.js and Ollama, or point `OLLAMA_BASE_URL` at an authenticated remote Ollama.
- Set the same env vars from `.env.local` in the deployment environment.

## 12. Future ideas

- Streaming replies (`stream: true` + SSE) so tokens appear as they are generated
- Auth + Postgres/Prisma for persistent history
- Per-conversation model memory and model comparison view
- Voice in (Web Speech API) / TTS out
- File/PDF chat + RAG (embeddings)

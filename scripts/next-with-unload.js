#!/usr/bin/env node
// Runs Next.js and unloads every Ollama model when the server exits (Ctrl+C, SIGTERM,
// or a normal shutdown). This keeps models from lingering in RAM after quitting the app.
const { spawn } = require('node:child_process');

const command = process.argv[2] === 'dev' ? 'dev' : 'start';

const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), command], {
  stdio: 'inherit',
  env: process.env
});

function forwardSignal(signal) {
  try {
    child.kill(signal);
  } catch {}
}

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

async function unloadAllModels() {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(
    /\/+$/,
    ''
  );

  try {
    const ps = await fetch(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(4000) });
    if (!ps.ok) return;

    const data = await ps.json().catch(() => null);
    const names = Array.isArray(data?.models)
      ? data.models.map((m) => m?.name).filter((n) => typeof n === 'string')
      : [];

    await Promise.allSettled(
      names.map((name) =>
        fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: name, keep_alive: 0 }),
          signal: AbortSignal.timeout(4000)
        })
      )
    );
  } catch {
    // Ollama may already be stopped; nothing else to do.
  }
}

child.on('exit', async (code) => {
  await unloadAllModels();
  process.exit(typeof code === 'number' ? code : 1);
});

child.on('error', (error) => {
  console.error(`Could not start Next.js: ${error.message}`);
  process.exit(1);
});

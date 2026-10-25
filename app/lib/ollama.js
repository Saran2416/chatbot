export const DEFAULT_BASE_URL = 'http://localhost:11434';
export const DEFAULT_MODEL = 'deepseek-r1:14b';

// OLLAMA_MODEL is the default; OLLAMA_MODELS is the switchable allowlist.
export function getOllamaConfig() {
  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const defaultModel = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const list = (process.env.OLLAMA_MODELS || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  return {
    baseUrl,
    defaultModel,
    models: Array.from(new Set([defaultModel, ...list]))
  };
}

// True when `model` matches an installed/loaded name, with or without an explicit tag.
export function hasModel(names, model) {
  return names.some(
    (name) => name === model || (!model.includes(':') && name.split(':')[0] === model)
  );
}

export async function fetchOllamaJson(url, signal) {
  const res = await fetch(url, { cache: 'no-store', signal });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// Names of models currently held in memory, or null when Ollama cannot be reached.
export async function loadedModelNames(baseUrl, signal) {
  const data = await fetchOllamaJson(`${baseUrl}/api/ps`, signal);
  if (!data || !Array.isArray(data.models)) return null;
  return data.models.map((m) => m?.name).filter((n) => typeof n === 'string');
}

// Unload the given models (keep_alive: 0) and wait for /api/ps to reflect it.
export async function unloadModels(baseUrl, names, signal) {
  if (names.length > 0) {
    await Promise.allSettled(
      names.map((name) =>
        fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: name, keep_alive: 0 }),
          signal
        })
      )
    );
  }

  let remaining = (await loadedModelNames(baseUrl, signal)) ?? names;

  // Ollama's /api/ps can lag briefly behind the unload call; poll until it settles.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stillLoaded = names.some((name) =>
      remaining.some((loadedName) => hasModel([loadedName], name))
    );
    if (!stillLoaded) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
    remaining = (await loadedModelNames(baseUrl, signal)) ?? remaining;
  }

  const failed = names.filter((name) =>
    remaining.some((loadedName) => hasModel([loadedName], name))
  );

  return {
    unloaded: names.filter((name) => !failed.includes(name)),
    failed,
    loaded: remaining
  };
}

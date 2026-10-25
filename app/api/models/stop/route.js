import { NextResponse } from 'next/server';
import { getOllamaConfig, loadedModelNames, unloadModels } from '../../../lib/ollama';

// POST /api/models/stop
// Unloads every model Ollama currently holds in memory. Used when the tab/app is
// closed and by the "Unload models" control in the UI.
export const dynamic = 'force-dynamic';

export async function POST() {
  const { baseUrl } = getOllamaConfig();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const loaded = await loadedModelNames(baseUrl, controller.signal);

    if (!loaded) {
      return NextResponse.json(
        { error: 'Could not read loaded models from Ollama.' },
        { status: 502 }
      );
    }

    if (loaded.length === 0) {
      return NextResponse.json({ unloaded: [], failed: [], loaded: [] });
    }

    const result = await unloadModels(baseUrl, loaded, controller.signal);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: `Cannot reach Ollama at ${baseUrl}.` },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

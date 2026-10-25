import { NextResponse } from 'next/server';
import {
  getOllamaConfig,
  hasModel,
  loadedModelNames,
  unloadModels
} from '../../../lib/ollama';

// POST /api/models/select
// Body: { model: string }
// Unloads every model except the selected one so that only one stays in memory.
// The selected model itself is loaded lazily by the next /api/chat request.
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => null);
  const { baseUrl, defaultModel, models } = getOllamaConfig();
  const requested = typeof body?.model === 'string' ? body.model.trim() : '';
  const model = requested || defaultModel;

  if (!models.includes(model)) {
    return NextResponse.json(
      { error: `Model "${model}" is not enabled. Add it to OLLAMA_MODELS.` },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const loaded = await loadedModelNames(baseUrl, controller.signal);

    if (!loaded) {
      return NextResponse.json(
        { error: 'Could not read loaded models from Ollama.' },
        { status: 502 }
      );
    }

    const toUnload = loaded.filter((name) => !hasModel([name], model));
    const result = await unloadModels(baseUrl, toUnload, controller.signal);

    return NextResponse.json({ model, ...result });
  } catch {
    return NextResponse.json(
      { error: `Cannot reach Ollama at ${baseUrl}.` },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

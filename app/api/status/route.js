import { NextResponse } from 'next/server';
import { fetchOllamaJson, getOllamaConfig, hasModel } from '../../lib/ollama';

// GET /api/status
// Reports Ollama connectivity, switchable models, and which are installed/loaded.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { baseUrl, defaultModel, models: names } = getOllamaConfig();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    // /api/tags lists installed models; /api/ps lists loaded ones. Neither loads a model.
    const [tagsResult, runningResult] = await Promise.allSettled([
      fetchOllamaJson(`${baseUrl}/api/tags`, controller.signal),
      fetchOllamaJson(`${baseUrl}/api/ps`, controller.signal)
    ]);

    const tags = tagsResult.status === 'fulfilled' ? tagsResult.value : null;
    const running = runningResult.status === 'fulfilled' ? runningResult.value : null;

    if (!tags) {
      return NextResponse.json({
        online: false,
        installed: false,
        model: defaultModel,
        defaultModel,
        models: names.map((name) => ({ name, installed: false, loaded: false })),
        baseUrl
      });
    }

    const installedNames = Array.isArray(tags.models)
      ? tags.models.map((m) => m?.name).filter((n) => typeof n === 'string')
      : [];
    const loadedNames = Array.isArray(running?.models)
      ? running.models.map((m) => m?.name).filter((n) => typeof n === 'string')
      : [];

    const models = names.map((name) => ({
      name,
      installed: hasModel(installedNames, name),
      loaded: hasModel(loadedNames, name)
    }));

    const installed = models.some((m) => m.name === defaultModel && m.installed);

    return NextResponse.json({
      online: true,
      installed,
      model: defaultModel,
      defaultModel,
      models,
      baseUrl
    });
  } catch {
    return NextResponse.json({
      online: false,
      installed: false,
      model: defaultModel,
      defaultModel,
      models: names.map((name) => ({ name, installed: false, loaded: false })),
      baseUrl
    });
  } finally {
    clearTimeout(timeout);
  }
}

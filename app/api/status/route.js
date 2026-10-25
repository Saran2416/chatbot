import { NextResponse } from 'next/server';

// GET /api/status
// Reports whether Ollama is reachable and whether the configured model is installed.
const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'deepseek-r1:14b';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      cache: 'no-store',
      signal: controller.signal
    });

    if (!res.ok) {
      return NextResponse.json({ online: false, installed: false, model, baseUrl });
    }

    const data = await res.json().catch(() => null);
    const names = Array.isArray(data?.models)
      ? data.models.map((m) => m?.name).filter((n) => typeof n === 'string')
      : [];
    const installed =
      names.includes(model) || names.some((name) => name.split(':')[0] === model);

    return NextResponse.json({ online: true, installed, model, baseUrl });
  } catch {
    return NextResponse.json({ online: false, installed: false, model, baseUrl });
  } finally {
    clearTimeout(timeout);
  }
}

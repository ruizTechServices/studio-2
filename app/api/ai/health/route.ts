import { getOllamaModels, OllamaClientError } from '@/lib/ai/ollama-client'
import { logWarn } from '@/lib/logger/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  try {
    const models = await getOllamaModels()

    return Response.json({ ok: true, reachable: true, models })
  } catch (error) {
    const code =
      error instanceof OllamaClientError ? error.code : 'unexpected'

    await logWarn({
      message: 'Ollama health check failed',
      route: '/api/ai/health',
      context: { code },
    })

    return Response.json(
      {
        ok: false,
        reachable: false,
        models: [],
        error:
          code === 'config'
            ? 'AI service is not configured'
            : 'AI service is unavailable',
      },
      { status: code === 'config' ? 500 : 502 }
    )
  }
}

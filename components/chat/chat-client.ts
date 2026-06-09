import type { ChatApiResponse, ChatRequest, ChatResult } from './types'

export async function sendChat(
  endpoint: string,
  request: ChatRequest
): Promise<ChatResult> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  })
  const result = (await response.json()) as ChatApiResponse
  const responseContent = result.message?.content?.trim()

  if (!response.ok || !result.ok || !responseContent) {
    throw new Error(result.error ?? 'The AI service returned no response.')
  }

  return {
    content: responseContent,
    doneReason: result.done_reason ?? null,
  }
}

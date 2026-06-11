# Local Ollama API

The studio exposes a stateless Next.js backend API for the private Orin Nano
Ollama server. The browser must call the Next.js backend and must never call the
Nano directly.

## Environment

Add these server-side values to `.env.local`:

```env
OLLAMA_GPU_BASE_URL=http://100.86.175.53:11435
OLLAMA_DEFAULT_MODEL=qwen2.5:7b-instruct-q4_K_M
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=256
OLLAMA_RESERVED_RESPONSE_TOKENS=256
OLLAMA_CHAT_TIMEOUT_MS=120000
```

Neither variable should use a `NEXT_PUBLIC_` prefix.

The compact generation default keeps normal chat answers focused. The timeout
is longer than the generation target because local hardware can occasionally
need more than 60 seconds even for a bounded response.

## Endpoints

- `POST /api/ai/chat` validates structured conversation context, compiles a
  token-budgeted messages array, and forwards it to Ollama with `stream: false`.
- `GET /api/ai/health` reports reachability and available model names without
  exposing the configured private server URL.

The chat endpoint is stateless. It does not save messages or retain server
memory between requests. The client sends a permanent system prompt, rolling
summary, token-bounded recent messages, relevant project context, and the
current user message on every request.

The chat card displays only the latest five messages, but that display slice is
separate from the model context. The client keeps a larger token-bounded recent
conversation and deterministically moves older messages into a rolling summary.
This state currently lasts for the browser component lifetime and is reset on
page reload.

The context builder reserves response tokens before selecting input context. It
always includes the permanent system prompt and current message, then includes
the summary, relevant context in priority order, and as many newest recent
messages as fit.

Chat request lifecycle events are written through the centralized logger.
Logs include safe operational metadata such as message count, response length,
token usage, and duration. Prompt and response content are never logged.

Long messages are visually collapsed in the chat card and can be expanded with
`Show more`. This is display-only: the full response remains in client-owned
conversation context. If Ollama returns `done_reason: "length"`, the card shows
a separate warning because that indicates real provider-side truncation.

## Manual chat test

Run the app with `npm run dev`, then call the Next.js backend:

```bash
curl -sS http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  --data-raw '{"context":{"systemPrompt":"You are the local codebase intelligence assistant for ruizTechStudio.","summary":"The user is rebuilding studio-2 with strict TypeScript.","recentMessages":[{"role":"assistant","content":"The backend uses stateless App Router handlers."}],"relevantContext":["app/api/ai/chat/route.ts validates and compiles structured conversation context."],"currentMessage":{"role":"user","content":"What should we improve next?"}}}'
```

Check provider reachability with:

```bash
curl -sS http://localhost:3000/api/ai/health
```

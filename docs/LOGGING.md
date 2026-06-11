# Centralized Logging

The logger has separate server and browser entrypoints. Both use the shared
contracts, validation, and sanitizer in `lib/logger/`.

## Environment

Server-side logging requires:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

Never prefix the service-role key with `NEXT_PUBLIC_` or import the server
logger into a Client Component.

## Server usage

Use `lib/logger/server.ts` from Route Handlers, Server Actions, and Node.js
server code:

```ts
import { logInfo } from '@/lib/logger/server'

await logInfo({
  message: 'Repo import started',
  route: '/api/repos/import',
  user_id: userId ?? null,
  correlation_id: correlationId,
  context: {
    repoUrl,
    source: 'github',
  },
})
```

The helpers never throw. Use `void logInfo(...)` only when explicitly choosing
fire-and-forget behavior in a runtime that will keep the task alive. Route
Handlers can use Next.js `after()` for non-blocking work.

## Client usage

Use `lib/logger/client.ts` from Client Components. It sanitizes the payload and
POSTs it to `/api/log`; it never imports Supabase or server logger code.

```ts
import { logInfo } from '@/lib/logger/client'

void logInfo({
  message: 'Project intake opened',
  context: { entrypoint: 'sidebar' },
})
```

The API forces `source` to `client` and resolves the authenticated user ID
server-side when available.

## Safety and correlation IDs

Do not log passwords, tokens, API keys, cookies, authorization headers,
service-role keys, personal sensitive data, or full request objects. Sensitive
keys are recursively replaced with `[REDACTED]`, strings and collections are
bounded, and `Error` objects are normalized.

Pass the same UUID `correlation_id` through related operations to connect their
logs. If omitted, the server logger generates one before insertion.

Debug logs are skipped when `NODE_ENV=production`.

## Database setup

This repository did not have a configured Supabase migrations directory or
local Supabase CLI when logging was added. Apply:

```text
supabase/migrations/20260609000000_create_logs.sql
```

through the Supabase SQL Editor or the project's migration workflow. The
migration creates `public.logs`, enables RLS, grants no anon/authenticated
access, and permits service-role inserts.

## Retention

Supabase Cron uses `pg_cron`. After enabling Cron for the project, manually run:

```text
supabase/sql/enable_logs_retention.sql
```

It schedules a daily deletion of logs older than 30 days. Do not run that SQL
before confirming the Cron extension is enabled for the target project.

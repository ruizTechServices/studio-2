import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: [
        'lib/logger/**/*.ts',
        'lib/ai/**/*.ts',
        'lib/intake/**/*.ts',
        'app/api/log/route.ts',
        'app/api/ai/**/route.ts',
        'app/api/projects/**/route.ts',
        'app/api/scans/**/route.ts',
      ],
      exclude: ['**/*.test.ts'],
    },
  },
})

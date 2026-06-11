import { loadEnvConfig } from '@next/env'

import { getWorkerConfig } from '@/lib/intake/worker/config'
import { runWorkerOnce } from '@/lib/intake/worker/runner'
import { logInfo, logWarn } from '@/lib/logger/server'

loadEnvConfig(process.cwd())

const processOnce = process.argv.includes('--once')
let stopping = false

function requestStop(signal: string): void {
  stopping = true
  void logInfo({
    message: 'Intake worker shutdown requested',
    context: { signal },
  })
}

process.once('SIGINT', () => requestStop('SIGINT'))
process.once('SIGTERM', () => requestStop('SIGTERM'))

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function main(): Promise<void> {
  const config = getWorkerConfig()

  await logInfo({
    message: 'Intake worker started',
    context: {
      workerId: config.workerId,
      mode: processOnce ? 'once' : 'continuous',
      concurrency: 1,
    },
  })

  do {
    try {
      const result = await runWorkerOnce(config)

      if (processOnce || stopping) {
        break
      }

      if (result.outcome === 'idle') {
        await wait(config.pollMs)
      }
    } catch {
      await logWarn({
        message: 'Intake worker iteration failed safely',
        context: { workerId: config.workerId },
      })

      if (processOnce || stopping) {
        process.exitCode = 1
        break
      }

      await wait(config.pollMs)
    }
  } while (!stopping)

  await logInfo({
    message: 'Intake worker stopped',
    context: { workerId: config.workerId },
  })
}

void main()

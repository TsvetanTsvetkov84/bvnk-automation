import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export type RunPlaywrightOptions = {
  readonly cwd: string
  readonly env?: NodeJS.ProcessEnv
}

function getPlaywrightBinPath(): string {
  const bin = process.platform === 'win32' ? 'playwright.cmd' : 'playwright'
  const binUrl = new URL(`../../node_modules/.bin/${bin}`, import.meta.url)
  return fileURLToPath(binUrl)
}

export async function runPlaywright(
  args: readonly string[],
  options: RunPlaywrightOptions
): Promise<number> {
  const binPath = getPlaywrightBinPath()

  return new Promise<number>((resolve, reject) => {
    const child = spawn(binPath, args, {
      cwd: options.cwd,
      // eslint-disable-next-line no-restricted-properties
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: 'inherit',
      windowsHide: true,
    })

    child.once('error', (err) => {
      console.error('❌ Failed to start Playwright process:', err)
      reject(err) // real failure (e.g. binary missing)
    })

    child.once('close', (code, signal) => {
      if (code !== 0) {
        console.error(
          `⚠️ Playwright finished with failures (code: ${code}, signal: ${signal ?? 'none'})`
        )
      } else {
        console.log('✅ Playwright finished successfully')
      }

      // ALWAYS resolve → allow reporters to finish
      resolve(code ?? 1)
    })
  })
}

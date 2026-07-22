import process from 'node:process'
import 'dotenv/config'
import { SUITES } from '../../configs/suites/suites.js'
import { runPlaywright } from '../lib/playwright-runner.js'
import { parseSuiteName } from './parse-suite-name.js'

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  const suiteName = parseSuiteName(args[0])
  const suite = SUITES[suiteName]

  const project = args[1]

  const projectLabel = project ? ` --project=${project}` : ''
  process.stdout.write(
    `▶ Running suite "${suiteName}" (config: ${suite.playwrightConfig}${projectLabel})\n`
  )

  const playwrightArgs = ['test', `--config=${suite.playwrightConfig}`]
  if (project) playwrightArgs.push(`--project=${project}`)

  let exitCode: number

  try {
    exitCode = await runPlaywright(playwrightArgs, {
      cwd: process.cwd(),
      // eslint-disable-next-line no-restricted-properties
      env: process.env,
    })
  } catch (err) {
    console.error('Playwright execution failed:', err)
    exitCode = 1
  }

  process.exit(exitCode)
}

await main()

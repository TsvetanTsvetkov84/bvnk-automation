import { type SuiteName, SUITES } from '../../configs/suites/suites.js'

// function to validate CLI input to match the suite names
export function parseSuiteName(name: string | undefined): SuiteName {
  if (!name || !(name in SUITES)) {
    const valid = Object.keys(SUITES).join(', ')
    process.stderr.write(`Usage: tsx scripts/cli/test.ts <${valid}>\n`)
    process.exit(1)
  }
  return name as SuiteName
}

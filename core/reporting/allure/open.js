import allure from 'allure-commandline'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve paths from the repo root (three levels up from this file), NOT from process.cwd() —
// IDE run configurations often use a different working directory.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const DEFAULT_RESULTS_DIR = 'out/allure-results'

const resultsDirName = process.env.ALLURE_RESULTS_DIR ?? DEFAULT_RESULTS_DIR
if (!process.env.ALLURE_RESULTS_DIR) {
  console.warn(`⚠️ ALLURE_RESULTS_DIR not set — defaulting to "${DEFAULT_RESULTS_DIR}"`)
}

const resultsDir = path.isAbsolute(resultsDirName)
  ? resultsDirName
  : path.resolve(REPO_ROOT, resultsDirName)

// Sanity check — an empty/missing dir would silently serve a report with 0 test cases.
const resultFiles = fs.existsSync(resultsDir)
  ? fs.readdirSync(resultsDir).filter((f) => f.endsWith('-result.json'))
  : []
if (resultFiles.length === 0) {
  console.warn(
    `⚠️ No test results found in "${resultsDir}" — the report will be empty. Run "yarn test:api" first.`
  )
} else {
  console.log(`Serving Allure report for ${resultFiles.length} test result(s) from: ${resultsDir}`)
}

const serve = allure(['serve', resultsDir])

serve.on('exit', (exitCode) => {
  console.log('Allure report serving finished:', exitCode)
})

import allure from 'allure-commandline'
import path from 'node:path'

const resultsDirName = process.env.ALLURE_RESULTS_DIR
if (!resultsDirName) {
  throw new Error('ALLURE_RESULTS_DIR environment variable is not set')
}

const resultsDir = path.isAbsolute(resultsDirName)
  ? resultsDirName
  : path.resolve(process.cwd(), resultsDirName)

const serve = allure(['serve', resultsDir])

serve.on('exit', (exitCode) => {
  console.log('Allure report serving finished:', exitCode)
})

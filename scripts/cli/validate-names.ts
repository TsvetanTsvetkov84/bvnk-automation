import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const SKIP_DIR_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  '.idea',
  '.aiassistant',
  'out',
  'test-results',
  'dist',
  'build',
  'coverage',
])

// Kebab-case directory names only:
// - lowercase letters/digits separated by single hyphens
// - no leading/trailing hyphen, no consecutive hyphens
// Examples: "core", "ui-tests", "v2"; disallow: "UI", "ui_tests", "ui--tests", UiTests
const ALLOWED_DIR_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Allows: vault.client, login.page, sample.test, http-client, global.d
const ALLOWED_TS_BASENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/

const ALLOWED_TS_EXACT_NAMES: ReadonlySet<string> = new Set(['index.ts', 'README.md'])

type Violation = {
  readonly filePath: string
  readonly reason: string
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function isTsLikeFileName(fileName: string): boolean {
  return fileName.endsWith('.ts') || fileName.endsWith('.tsx')
}

function isAllowedTsFileName(fileName: string): boolean {
  if (ALLOWED_TS_EXACT_NAMES.has(fileName)) return true
  if (!isTsLikeFileName(fileName)) return true

  const ext = path.extname(fileName) // .ts or .tsx
  const base = fileName.slice(0, -ext.length)

  return ALLOWED_TS_BASENAME.test(base)
}

async function walk(currentDirAbs: string, rootAbs: string, out: Violation[]): Promise<void> {
  const entries = await fs.readdir(currentDirAbs, { withFileTypes: true })

  for (const entry of entries) {
    const entryAbs = path.join(currentDirAbs, entry.name)
    const rel = path.relative(rootAbs, entryAbs)

    if (entry.isDirectory()) {
      // Skip hidden dirs (.git, .github, .claude, ...) and known build/vendor dirs
      if (entry.name.startsWith('.') || SKIP_DIR_NAMES.has(entry.name)) continue

      if (!ALLOWED_DIR_NAME.test(entry.name)) {
        out.push({
          filePath: rel,
          reason: `Directory name must be kebab-case: "${entry.name}"`,
        })
      }

      await walk(entryAbs, rootAbs, out)
      continue
    }

    if (!entry.isFile()) continue
    if (!isTsLikeFileName(entry.name)) continue

    if (!isAllowedTsFileName(entry.name)) {
      out.push({
        filePath: rel,
        reason: `TS file name must be kebab-case (dots allowed for suffixes like *.client.ts): "${entry.name}"`,
      })
    }
  }
}

async function main(): Promise<void> {
  const rootAbs = process.cwd()

  // fail fast if executed outside repo root by mistake
  if (!(await exists(path.join(rootAbs, 'package.json')))) {
    throw new Error(`Expected to run from repo root (package.json not found in: ${rootAbs})`)
  }

  const violations: Violation[] = []
  await walk(rootAbs, rootAbs, violations)

  if (violations.length === 0) {
    process.stdout.write('✅ Dir & Filename check passed (kebab-case)\n')
    return
  }

  process.stderr.write(`❌ Filename check failed (${violations.length} issue(s)):\n`)
  for (const v of violations) {
    process.stderr.write(`- ${v.filePath}\n  ${v.reason}\n`)
  }
  process.exitCode = 1
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`❌ Filename check crashed: ${message}\n`)
  process.exitCode = 1
})

export type Suite = {
  readonly playwrightConfig: string
}

export const SUITES = {
  api: {
    playwrightConfig: 'configs/playwright.api.config.ts',
  },
} as const satisfies Record<string, Suite>

export type SuiteName = keyof typeof SUITES

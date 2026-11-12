import { defineConfig, devices } from '@playwright/test'
import { oidcTestConfig, oidcTestCookies } from './e2e/oidc-test-session'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    // Browser E2E uses a dedicated fake account and a test-only signing key.
    storageState: { cookies: oidcTestCookies(['studio', 'rr_operator']), origins: [] },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node e2e/fixtures/core-catalog-server.mjs',
      url: 'http://127.0.0.1:3199/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
    command: 'pnpm start --hostname 127.0.0.1',
    env: {
      QDIP_PLAYWRIGHT_LEGACY_CATALOG: '1',
      DIP_API_BASE_URL: 'http://127.0.0.1:3199',
      DIP_ADMIN_API_KEY: 'playwright-catalog-only',
      ZITADEL_ISSUER: oidcTestConfig.issuer,
      ZITADEL_CLIENT_ID: oidcTestConfig.clientId,
      ZITADEL_QDIP_PROJECT_ID: oidcTestConfig.projectId,
      ZITADEL_QDIP_ORGANIZATION_ID: oidcTestConfig.organizationId,
      QDIP_AUTH_COOKIE_SECRET: oidcTestConfig.signingSecret,
    },
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    },
  ],
})

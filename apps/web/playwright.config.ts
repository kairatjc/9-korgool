import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    deviceScaleFactor: 1,
    // Google Fonts may come through a TLS-intercepting proxy (cloud sandboxes); the pages themselves are local.
    ignoreHTTPSErrors: true,
  },
  webServer: [
    {
      command: 'pnpm exec vite --port 5173 --strictPort',
      url: 'http://localhost:5173/__handoff/index.html',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    // The game server for online games (Vite proxies /socket.io to it).
    {
      command: 'pnpm --filter @korgool/server exec tsx src/main.ts',
      url: 'http://localhost:3000/health',
      env: { PORT: '3000', HOST: '127.0.0.1' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});

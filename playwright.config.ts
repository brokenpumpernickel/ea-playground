import { defineConfig } from '@playwright/test';

// Uses the Edge that ships with Windows so no browser download is needed.
// Override with PW_CHANNEL=chrome (or set PW_CHANNEL= to use Playwright's own Chromium after `npx playwright install chromium`).
const channel = process.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: 'e2e',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  outputDir: 'test-results',
  reporter: 'list',
  use: {
    channel: channel || undefined,
    viewport: { width: 1920, height: 1080 },
  },
});

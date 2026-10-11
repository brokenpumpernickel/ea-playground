import { defineConfig } from '@playwright/test';

// Uses the Edge that ships with Windows so no browser download is needed.
// Override with PW_CHANNEL=chrome (or set PW_CHANNEL= to use Playwright's own Chromium after `npx playwright install chromium`).
const channel = process.env.PW_CHANNEL ?? 'msedge';

// Each worker is a whole Edge window at 1920×1080. By default Playwright starts half of the machine's cores' worth, which
// leaves a laptop unusable while the suite runs, so use a few. Override with PW_WORKERS=8 where the machine can take it.
const workers = Number(process.env.PW_WORKERS ?? 3);

export default defineConfig({
  testDir: 'e2e',
  workers,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  outputDir: 'test-results',
  reporter: 'list',
  use: {
    channel: channel || undefined,
    viewport: { width: 1920, height: 1080 },
  },
});

import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Opens the production build straight from disk (no server), as the app is meant to be usable offline.
test('app shell opens from the build folder without a server', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  await page.goto(pathToFileURL(resolve('dist/index.html')).href);

  await expect(page.getByRole('heading', { name: 'Evolutionary Algorithms Playground' })).toBeVisible();
  expect(requests.filter((u) => !u.startsWith('file:'))).toEqual([]);
});

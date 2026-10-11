import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('dist/index.html')).href;
const marks = (page: Page) => page.locator('[data-plot="function"] [data-mark]').evaluateAll((els) => els.map((el) => [Number(el.getAttribute('data-x')), Number(el.getAttribute('data-fitness')), Number(el.getAttribute('data-count'))]));
const tableXs = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-col="x"]').allTextContents();

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('the button and the F key switch between diversity and gene shares and the function plot', async ({ page }) => {
  await expect(page.locator('[data-plot="function"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Diversity' })).toBeVisible();
  await page.getByTestId('show-function').click();
  await expect(page.getByRole('heading', { name: 'Function' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Diversity' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Share of 1s per gene' })).toHaveCount(0);
  await page.getByTestId('show-metrics').click();
  await expect(page.getByRole('heading', { name: 'Share of 1s per gene' })).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.locator('[data-plot="function"]')).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.locator('[data-plot="function"]')).toHaveCount(0);
});

test('the individuals on the curve are the ones in the population table, and follow the cursor', async ({ page }) => {
  await page.keyboard.press('f');
  const check = async () => {
    const xs = (await tableXs(page)).map(Number);
    const got = await marks(page);
    const distinct = [...new Set(xs)].sort((a, b) => a - b);
    expect(got.map((m) => m[0])).toEqual(distinct);
    for (const [x, fitness, count] of got) {
      expect(fitness).toBe(x * x);
      expect(count).toBe(xs.filter((v) => v === x).length);
    }
  };
  await check(); // generation 0
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await check(); // generation 2
  await page.getByTestId('scrub').focus();
  await page.keyboard.press('PageUp');
  await check(); // scrubbed back
  await page.keyboard.press('Home');
  await check();
});

test('the shortcut is written on the button and does not fire while typing', async ({ page }) => {
  await expect(page.getByTestId('show-function').locator('kbd')).toHaveText('F');
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#crossover-probability').click();
  await page.keyboard.type('f');
  await expect(page.locator('[data-plot="function"]')).toHaveCount(0);
});

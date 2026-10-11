import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, metricsOf } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { matchRates } from '../src/ui/match-rate-model';

const url = pathToFileURL(resolve('dist/index.html')).href;

const switchToStrings = async (page: Page) => {
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
};
const shown = (page: Page) => page.locator('.matchbar [data-share]').evaluateAll((els) => els.map((el) => [Number(el.getAttribute('data-position')), Number(el.getAttribute('data-share'))]));

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('for the target string the panel is “Match rate per position”, with the target’s letters, and equals the engine’s rates at every generation', async ({ page }) => {
  await switchToStrings(page);
  await expect(page.getByRole('heading', { name: 'Match rate per position' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Share of 1s per gene' })).toHaveCount(0);
  await expect(page.locator('.matchbar [data-share] span')).toHaveText(['H', 'E', 'L', 'L', 'O']);

  const entry = entryOf('target-string')!;
  const options = entry.defaultOptions()!;
  const problem = entry.create(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init: entry.defaults.init }, params: entry.defaults.params, seed: entry.defaults.seed });
  const expected = (generation: number) =>
    matchRates(metricsOf(run.snapshot(generation).state, problem.alphabet.length), options.target, problem.alphabet).map((r) => [r.position, r.share]);

  expect(await shown(page)).toEqual(expected(0));
  for (let g = 1; g <= 6; g++) {
    run.forwardCycle();
    await page.keyboard.press('g');
    expect(await shown(page)).toEqual(expected(g));
  }
  // scrubbing back shows the earlier generation's rates
  await page.getByTestId('scrub').focus();
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  expect(await shown(page)).toEqual(expected(4));
});

test('the percentages are printed and the strip describes itself', async ({ page }) => {
  await switchToStrings(page);
  await page.keyboard.press('g');
  const strip = page.locator('.matchbar');
  await expect(strip).toHaveAttribute('role', 'img');
  await expect(strip).toHaveAttribute('aria-label', /^Share of individuals with the target's letter at each position: position 1, H, \d+ percent;/);
  const percents = await strip.locator('b').allTextContents();
  expect(percents).toHaveLength(5);
  expect(percents.every((p) => /^\d+%$/.test(p))).toBe(true);
});

test('the diversity plot says what it measures for strings, and the function toggle is not offered', async ({ page }) => {
  await expect(page.getByTestId('show-function')).toBeVisible(); // Goldberg has a curve
  await switchToStrings(page);
  await expect(page.locator('section[aria-labelledby="diversity-heading"]')).toContainText('mean pairwise mismatch, 0–1');
  await expect(page.getByTestId('show-function')).toHaveCount(0);
  await page.keyboard.press('f'); // nothing to show
  await expect(page.locator('[data-plot="function"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Diversity' })).toBeVisible();
});

test('Goldberg’s bottom strip is as it was', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Share of 1s per gene' })).toBeVisible();
  await expect(page.locator('.allele [data-share]')).toHaveCount(5);
  await expect(page.locator('.matchbar')).toHaveCount(0);
  await expect(page.locator('section[aria-labelledby="diversity-heading"]')).toContainText('mean pairwise Hamming, 0–1');
});

test('switching back to Goldberg brings its panel back', async ({ page }) => {
  await switchToStrings(page);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByRole('heading', { name: 'Share of 1s per gene' })).toBeVisible();
});

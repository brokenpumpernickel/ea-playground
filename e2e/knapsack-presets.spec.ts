import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, type GaParams, type GaSetup, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;

interface Loaded { file: string; name: string; lesson: string; lookFor: string; seed: number; options: KnapsackOptions; params: GaParams; setup: GaSetup }
const readPreset = (file: string): Loaded => {
  const data = JSON.parse(readFileSync(resolve('src/ui/presets', file), 'utf8'));
  return { file, name: data.name, lesson: data.lesson, lookFor: data.lookFor, seed: data.seed, options: data.options, params: data.params, setup: { problem: entry.create(data.options), init: data.setup.init } };
};
const files = readdirSync(resolve('src/ui/presets')).filter((f) => f.endsWith('.json')).sort();
const knapsackFiles = files.filter((f) => JSON.parse(readFileSync(resolve('src/ui/presets', f), 'utf8')).problem === 'knapsack');
const preset = (suffix: string) => readPreset(knapsackFiles.find((f) => f.includes(suffix))!);

const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')!));
const series = (page: Page, name: string) => page.locator(`[data-plot="fitness"] [data-series="${name}"][data-gen]`).evaluateAll((els) => els.map((el) => [Number(el.getAttribute('data-gen')), Number(el.getAttribute('data-value'))]));
const openKnapsack = async (page: Page) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Knapsack/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
};
const load = async (page: Page, name: string) => {
  if (!(await page.getByTestId('drawer').count())) await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: name });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
};
const generations = async (page: Page, n: number) => {
  for (let g = 0; g < n; g++) await page.keyboard.press('g');
};
const engine = (p: Loaded) => createRun(gaAlgorithm, { setup: p.setup, params: p.params, seed: p.seed });
const shown = (p: Loaded, run: ReturnType<typeof engine>, g: number) => run.snapshot(g).state.population.map((i) => formatGenes(i.chromosome, p.setup.problem.alphabet));

test.beforeEach(async ({ page }) => {
  await openKnapsack(page);
});

test('the menu lists the five knapsack presets with their lesson and what to look for, and none of the other problems’', async ({ page }) => {
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Evolve a bag', 'Penalty too small', 'Penalty too large', 'Repair: Lamarckian', 'Repair: Baldwinian']);
  for (const file of knapsackFiles) {
    const p = readPreset(file);
    await page.locator('#preset').selectOption({ label: p.name });
    await expect(page.getByTestId('preset-lesson')).toHaveText(p.lesson);
    await expect(page.getByTestId('preset-lookfor')).toHaveText(`Look for: ${p.lookFor}`);
    await expect(page.getByText(`with this configuration and seed ${p.seed}.`)).toBeVisible();
  }
});

test('Evolve a bag: loading it restarts with seed 42, the run is the engine’s, and the optimum bag B, C, D, F, G, H, K is found in generation 26', async ({ page }) => {
  const p = preset('bag-evolve');
  await page.keyboard.press('g');
  await load(page, 'Evolve a bag');
  await expect(page.locator('#brand')).toContainText('preset: Evolve a bag');
  await expect(page.getByTestId('seed')).toHaveText('42');
  const run = engine(p);
  expect(await rows(page)).toEqual(shown(p, run, 0));
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#pop-heading')).toHaveText(/generation 26$/);
  for (let g = 0; g < 26; g++) run.forwardCycle();
  expect(await rows(page)).toEqual(shown(p, run, 26));
  // with the decoder a gene can be 1 without the item being packed, so look for the bag, not for one chromosome: weight 47, value 123
  const bags = await page.getByRole('table', { name: /^Population · generation 26$/ }).locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [tr.querySelector('[data-col="bag weight"]')!.textContent!.trim(), tr.querySelector('[data-col="value"]')!.textContent!.trim()]));
  expect(bags).toContainEqual(['47/48 ✓', '123']);
  await expect(page.getByTestId('summary')).toContainText('best so far 123');
});

test('Penalty too small: the best fitness passes the optimum line, the best feasible stays at 122, and every bag is overweight in the end', async ({ page }) => {
  const p = preset('too-small');
  await load(page, 'Penalty too small');
  await generations(page, 100);
  const best = await series(page, 'best');
  expect(Math.max(...best.map(([, v]) => v!))).toBe(135);
  const feasible = await series(page, 'feasibleBestSoFar');
  expect(feasible[feasible.length - 1]).toEqual([100, 122]);
  expect(Math.max(...feasible.map(([, v]) => v!))).toBe(122);
  const weights = await page.getByRole('table', { name: /^Population · generation 100$/ }).locator('tbody tr [data-col="bag weight"]').allTextContents();
  expect(weights).toHaveLength(8);
  expect(weights.every((w) => /✗/.test(w))).toBe(true);
  await expect(page.getByTestId('summary')).toContainText('feasible 0 of 8');
  const run = engine(p);
  for (let g = 0; g < 100; g++) run.forwardCycle();
  expect(await rows(page)).toEqual(shown(p, run, 100));
  await expect(page.getByRole('status')).not.toContainText('target');
});

test('Penalty too large: after 100 generations the best bag that fits is worth 116 and 6 of the 8 bags fit', async ({ page }) => {
  await load(page, 'Penalty too large');
  await generations(page, 100);
  const feasible = await series(page, 'feasibleBestSoFar');
  expect(feasible[feasible.length - 1]).toEqual([100, 116]);
  await expect(page.getByTestId('summary')).toContainText('feasible 6 of 8');
  await expect(page.getByTestId('summary')).toContainText('best so far 116');
});

test('the two repairs, same seed: Lamarckian finds the optimum in generation 25 and Baldwinian in generation 5, and only Baldwinian chromosomes drift past what fits', async ({ page }) => {
  await load(page, 'Repair: Lamarckian');
  await generations(page, 10);
  let cells = page.getByRole('table', { name: /^Population · generation 10$/ }).locator('tbody tr');
  await expect(cells).toHaveCount(8);
  await expect(page.locator('.bit.skip')).toHaveCount(0); // every chromosome fits, so nothing is "not in the bag"
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#pop-heading')).toHaveText(/generation 25$/);

  await load(page, 'Repair: Baldwinian');
  await generations(page, 10);
  cells = page.getByRole('table', { name: /^Population · generation 10$/ }).locator('tbody tr');
  await expect(cells).toHaveCount(8);
  for (let k = 0; k < 8; k++) expect(await cells.nth(k).locator('.bit.skip').count()).toBeGreaterThan(0); // all 8 carry more genes than fit
  await load(page, 'Repair: Baldwinian');
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#pop-heading')).toHaveText(/generation 5$/);
});

test('the other problems’ presets are unchanged, and each keeps to its own problem', async ({ page }) => {
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
  await page.keyboard.press('Escape');
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Evolve a word', 'No mutation', 'Mutation too high']);
});

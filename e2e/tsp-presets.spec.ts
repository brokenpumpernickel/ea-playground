import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, metricsOfProblem, tspProblem, type GaParams, type TspOptions } from '../src/engine';
import { createRun } from '../src/run';
import { tourInfoOf, tourStatsLines } from '../src/ui/tour-cells';

const url = pathToFileURL(resolve('dist/index.html')).href;
interface Loaded { name: string; lesson: string; lookFor: string; seed: number; options: TspOptions; params: GaParams; size: number }
const files = readdirSync(resolve('src/ui/presets')).filter((f) => f.endsWith('.json')).sort();
const presets: Loaded[] = files
  .map((f) => JSON.parse(readFileSync(resolve('src/ui/presets', f), 'utf8')))
  .filter((d) => d.problem === 'tsp')
  .map((d) => ({ name: d.name, lesson: d.lesson, lookFor: d.lookFor, seed: d.seed, options: d.options, params: d.params, size: d.setup.init.size }));

const openTsp = async (page: Page) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: 'TSP' }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
};
const load = async (page: Page, name: string) => {
  if (!(await page.getByTestId('drawer').count())) await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: name });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
};
const engineRun = (p: Loaded) => createRun(gaAlgorithm, { setup: { problem: tspProblem(p.options), init: { kind: 'random', size: p.size } }, params: p.params, seed: p.seed }, { eventCacheSize: 0 });
const engineSummary = (p: Loaded, run: ReturnType<typeof engineRun>, g: number) => {
  const problem = tspProblem(p.options);
  return tourStatsLines(tourInfoOf(problem), metricsOfProblem(run.snapshot(g).state, problem)).join('');
};
const summary = async (page: Page) => (await page.getByTestId('summary').innerText()).replace(/\s*\n\s*/g, '');
const stopOf = (p: Loaded): number => {
  const run = engineRun(p);
  for (let g = 1; g <= 500; g++) {
    run.forwardCycle();
    if (run.snapshot(g).stops.length > 0) return g;
  }
  throw new Error('no stop');
};

test('the menu lists the nine TSP presets with their lesson and what to look for, and none of the other problems’', async ({ page }) => {
  await openTsp(page);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(presets.map((p) => p.name));
  expect(presets).toHaveLength(9);
  for (const p of presets) {
    await page.locator('#preset').selectOption({ label: p.name });
    await expect(page.getByTestId('preset-lesson')).toHaveText(p.lesson);
    await expect(page.getByTestId('preset-lookfor')).toHaveText(`Look for: ${p.lookFor}`);
    await expect(page.getByText(`with this configuration and seed ${p.seed}.`)).toBeVisible();
  }
});

for (const p of presets) {
  test(`loading “${p.name}” restarts with its seed and its instance, the run is the engine’s, and its link opens the same run in a fresh page`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openTsp(page);
    await page.keyboard.press('g');
    await load(page, p.name);
    await expect(page.locator('#brand')).toContainText(`preset: ${p.name}`);
    await expect(page.getByTestId('seed')).toHaveText(String(p.seed));
    await expect(page.getByTestId('problem-chip')).toContainText(p.options.instance === 'circle' ? 'Circle' : p.options.instance === 'clusters' ? 'Two clusters' : p.options.instance);
    const run = engineRun(p);
    expect(await summary(page)).toBe(engineSummary(p, run, 0));
    for (let g = 1; g <= 3; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    await expect(page.locator('#pop-heading')).toContainText('generation 3');
    expect(await summary(page)).toBe(engineSummary(p, run, 3));
    // the link of the run opens the same run in a fresh page
    await page.getByRole('button', { name: /Parameters/ }).click();
    await page.getByTestId('copy-link').click();
    await expect(page.getByTestId('share-status')).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const fresh = await context.newPage();
    await fresh.goto(link);
    await expect(fresh.getByTestId('problem-button')).toHaveText(/TSP/);
    expect(await summary(fresh)).toBe(engineSummary(p, engineRun(p), 0));
    for (let g = 1; g <= 3; g++) await fresh.keyboard.press('g');
    expect(await summary(fresh)).toBe(engineSummary(p, run, 3));
  });
}

test('Run until stop pauses where each text says: generation 99 and 126 for stagnation and 46 within ε, and at the limit, 500, for the six that run to it', async ({ page }) => {
  const stops = presets.map(stopOf);
  expect(stops).toEqual([500, 500, 500, 500, 500, 500, 99, 46, 126]);
  await openTsp(page);
  for (const p of presets.filter((_, k) => [6, 7, 8].includes(k))) {
    await load(page, p.name);
    await page.getByRole('button', { name: 'Run until stop' }).click();
    await expect(page.locator('#pop-heading'), p.name).toContainText(`generation ${stopOf(p)}`, { timeout: 15_000 });
  }
});

test('the other problems’ presets are unchanged, and each keeps to its own problem', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
});

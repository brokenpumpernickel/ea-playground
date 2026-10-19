import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeProblem, metricsOfProblem, type GaParams, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { statsLines } from '../src/ui/spread-model';

const url = pathToFileURL(resolve('dist/index.html')).href;
interface Loaded { name: string; lesson: string; lookFor: string; seed: number; options: LandscapeOptions; params: GaParams; size: number }
const files = readdirSync(resolve('src/ui/presets')).filter((f) => f.endsWith('.json')).sort();
const presets: Loaded[] = files
  .map((f) => JSON.parse(readFileSync(resolve('src/ui/presets', f), 'utf8')))
  .filter((d) => d.problem === 'landscape')
  .map((d) => ({ name: d.name, lesson: d.lesson, lookFor: d.lookFor, seed: d.seed, options: d.options, params: d.params, size: d.setup.init.size }));

const openLandscape = async (page: Page) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Landscape/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
};
const load = async (page: Page, name: string) => {
  if (!(await page.getByTestId('drawer').count())) await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: name });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
};
const engineRun = (p: Loaded) => createRun(gaAlgorithm, { setup: { problem: landscapeProblem(p.options), init: { kind: 'random', size: p.size } }, params: p.params, seed: p.seed }, { eventCacheSize: 0 });
const summaryLine = async (page: Page) => (await page.getByTestId('summary').innerText()).split('\n')[0]!.trim();
const numberPattern = /-?\d+(\.\d+)?(e-?\d+)?/g;
/** The page's first summary line is the engine's: the same words, the numbers equal to the three decimals it shows. */
const expectSummary = async (page: Page, expected: string) => {
  const got = await summaryLine(page);
  expect(got.replace(numberPattern, '#')).toBe(expected.replace(numberPattern, '#'));
  const want = expected.match(numberPattern)!.map(Number);
  got.match(numberPattern)!.map(Number).forEach((value, k) => expect(value).toBeCloseTo(want[k]!, 2));
};
const engineSummary = (p: Loaded, run: ReturnType<typeof engineRun>, g: number) => statsLines(metricsOfProblem(run.snapshot(g).state, landscapeProblem(p.options)))[0];
const stopOf = (run: ReturnType<typeof engineRun>): number => {
  for (let g = 1; g <= 300; g++) {
    run.forwardCycle();
    if (run.snapshot(g).stops.length > 0) return g;
  }
  throw new Error('no stop');
};

test('the menu lists the twelve landscape presets with their lesson and what to look for, and none of the other problems’', async ({ page }) => {
  await openLandscape(page);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(presets.map((p) => p.name));
  expect(presets).toHaveLength(12);
  for (const p of presets) {
    await page.locator('#preset').selectOption({ label: p.name });
    await expect(page.getByTestId('preset-lesson')).toHaveText(p.lesson);
    await expect(page.getByTestId('preset-lookfor')).toHaveText(`Look for: ${p.lookFor}`);
    await expect(page.getByText(`with this configuration and seed ${p.seed}.`)).toBeVisible();
  }
});

for (const p of presets) {
  test(`loading “${p.name}” restarts with its seed and its landscape, the run is the engine’s, and its link opens the same run in a fresh page`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openLandscape(page);
    await page.keyboard.press('g');
    await load(page, p.name);
    await expect(page.locator('#brand')).toContainText(`preset: ${p.name}`);
    await expect(page.getByTestId('seed')).toHaveText(String(p.seed));
    await expect(page.getByTestId('problem-chip')).toContainText(p.options.representation === 'real' ? 'real-valued' : p.options.representation === 'gray' ? 'Gray-coded · 10 bits' : 'binary-coded · 10 bits');
    const run = engineRun(p);
    await expectSummary(page, engineSummary(p, run, 0));
    for (let g = 1; g <= 3; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    await expect(page.locator('#pop-heading')).toContainText('generation 3');
    await expectSummary(page, engineSummary(p, run, 3));
    // the link of the run opens the same run in a fresh page
    await page.getByRole('button', { name: /Parameters/ }).click();
    await page.getByTestId('copy-link').click();
    await expect(page.getByTestId('share-status')).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const fresh = await context.newPage();
    await fresh.goto(link);
    await expect(fresh.getByTestId('problem-button')).toHaveText(/Landscape/);
    await expectSummary(fresh, engineSummary(p, engineRun(p), 0));
    for (let g = 1; g <= 3; g++) await fresh.keyboard.press('g');
    await expectSummary(fresh, engineSummary(p, run, 3));
  });
}

test('Run until stop pauses where each preset’s text says: generation 10 and 8 at the target, 56 and 79 and 75 for stagnation, 24 and 139 for the niching presets, 100 at the limit', async ({ page }) => {
  await openLandscape(page);
  for (const p of presets) {
    const expected = stopOf(engineRun(p));
    await load(page, p.name);
    await page.getByRole('button', { name: 'Run until stop' }).click();
    await expect(page.locator('#pop-heading'), p.name).toContainText(`generation ${expected}`);
  }
  expect(presets.map((p) => stopOf(engineRun(p)))).toEqual([10, 100, 100, 8, 100, 56, 79, 6, 75, 39, 24, 139]);
});

test('the other problems’ presets are unchanged, and each keeps to its own problem', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
});

test('the niching presets set the drawer’s Niching section, and their long texts are whole inside the drawer at both sizes and in projector mode', async ({ page }) => {
  await openLandscape(page);
  for (const [name, method, sigma] of [['Two peaks: fitness sharing', 'sharing', '3'], ['Two peaks: deterministic crowding', 'crowding', '']] as const) {
    for (const [w, h, projector] of [[1920, 1080, false], [1366, 768, false], [1366, 768, true]] as const) {
      await page.setViewportSize({ width: w, height: h });
      if (projector !== (await page.locator('body.projector, .projector').count() > 0)) await page.getByRole('button', { name: 'Projector mode' }).click();
      await load(page, name);
      await page.getByRole('button', { name: /Parameters/ }).click();
      await expect(page.locator('#niching-method')).toHaveValue(method);
      if (method === 'sharing') await expect(page.locator('#niching-sigma')).toHaveValue(sigma);
      else await expect(page.locator('#niching-sigma')).toHaveCount(0);
      await page.locator('#preset').selectOption({ label: name });
      const look = page.getByTestId('preset-lookfor');
      await look.scrollIntoViewIfNeeded();
      const box = await look.boundingBox();
      const drawer = await page.getByTestId('drawer').boundingBox();
      expect(box!.x + box!.width, `${name} ${w}×${h}`).toBeLessThanOrEqual(drawer!.x + drawer!.width + 1);
      expect(await look.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
    }
  }
});

import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeFunctionInfo, landscapeProblem, type GaParams, type LandscapeFunction, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const optionsOf = (fn: LandscapeFunction, representation: LandscapeOptions['representation'] = 'real'): LandscapeOptions => ({ function: fn, representation, bitsPerVariable: 8 });
const paramsOf = (options: LandscapeOptions): GaParams => ({ ...defaultsOf(entry, options).params, elites: 2 });
const SIZE = 30;
const open = async (page: Page, options: LandscapeOptions, projector = false) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size: SIZE } }, paramsOf(options), 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
/** What the engine says for the population at the end of generation g: a recount of the decoded points near each peak. */
const expected = (options: LandscapeOptions, generations: number) => {
  const problem = landscapeProblem(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: SIZE } }, params: paramsOf(options), seed: 7 });
  const peaks = landscapeFunctionInfo[options.function].peaks!;
  const out: { name: string; count: number }[][] = [];
  for (let g = 0; g <= generations; g++) {
    if (g > 0) run.forwardCycle();
    const points = run.snapshot(g).state.population.map((i) => problem.pointOf(i.chromosome));
    out.push(peaks.map((p) => ({ name: p.name, count: points.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) <= 1.5).length })));
  }
  return out;
};
const readTable = (page: Page) =>
  page.locator('[data-testid="peaks-table"] tbody tr').evaluateAll((rows) => rows.map((r) => ({ name: r.getAttribute('data-peak')!, count: Number(r.querySelectorAll('td')[2]!.textContent) })));
const readSummary = (page: Page) => page.getByTestId('peak-readout').evaluate((e) => e.textContent!);
const line = (rows: { name: string; count: number }[]) => 'within 1.5 of a peak: ' + rows.map((r) => `${r.name} ${r.count}`).join(' · ');
const short = (rows: { name: string; count: number }[]) => 'near: ' + rows.map((r) => `${r.name} ${r.count}`).join(' · ');
const toGeneration = async (page: Page, g: number) => {
  for (let k = 0; k < g; k++) await page.keyboard.press('g');
};

for (const [fn, rep] of [['two-peaks', 'real'], ['two-peaks', 'gray'], ['himmelblau', 'real'], ['single-peak', 'plain']] as const) {
  test(`${fn} (${rep}): the readout, its table and its sentence equal a recount from the engine's population at every generation`, async ({ page }) => {
    const options = optionsOf(fn, rep);
    const want = expected(options, 6);
    await open(page, options);
    for (let g = 0; g <= 6; g++) {
      if (g > 0) await page.keyboard.press('g');
      await expect(page.getByTestId('peak-readout')).toHaveText(short(want[g]!));
      expect(await readTable(page), `generation ${g}`).toEqual(want[g]);
      const rest = SIZE - want[g]!.reduce((n, r) => n + r.count, 0);
      await expect(page.getByTestId('peak-sentence')).toHaveText(`Within 1.5 of a peak: ${want[g]!.map((r) => `${r.name} ${r.count}`).join(', ')}; elsewhere ${rest} of ${SIZE}.`);
    }
  });
}

test('Rastrigin has too many hills to name: no readout, table or sentence', async ({ page }) => {
  await open(page, optionsOf('rastrigin'));
  await expect(page.getByTestId('peak-readout')).toHaveCount(0);
  await expect(page.getByTestId('peaks-table')).toHaveCount(0);
  await expect(page.getByTestId('peak-sentence')).toHaveCount(0);
});

test('other problems have no readout', async ({ page }) => {
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByTestId('peak-readout')).toHaveCount(0);
});

test('the readout follows the cursor back through the history', async ({ page }) => {
  const options = optionsOf('two-peaks');
  const want = expected(options, 5);
  await open(page, options);
  await toGeneration(page, 5);
  await expect(page.getByTestId('peak-readout')).toHaveText(short(want[5]!));
  await page.getByTestId('scrub').focus();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('peak-readout')).toHaveText(short(want[0]!));
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  // the cursor is at the start of generation 2, where the table shows the parents: generation 1's population
  await expect(page.getByTestId('peak-readout')).toHaveText(short(want[1]!));
});

test('the focus view\'s information box says the same, and is whole at both sizes and in projector mode', async ({ page }) => {
  const options = optionsOf('two-peaks');
  const want = expected(options, 3);
  for (const [w, h, projector] of [[1920, 1080, false], [1366, 768, false], [1920, 1080, true], [1366, 768, true]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await open(page, options, projector);
    await toGeneration(page, 3);
    await page.getByTestId('show-landscape').click();
    await page.getByTestId('focus-toggle').click();
    const card = page.getByTestId('focus-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('focus-peaks')).toHaveText(line(want[3]!));
    expect(await card.evaluate((e) => e.scrollHeight - e.clientHeight), `${w}×${h}${projector ? ' projector' : ''}`).toBeLessThanOrEqual(1);
    const box = await card.boundingBox();
    const view = await page.getByTestId('landscape-view').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(view!.x - 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(view!.x + view!.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(view!.y + view!.height + 1);
  }
});

test('the readout in the metrics stays inside its panel at both sizes and in projector mode', async ({ page }) => {
  for (const [w, h, projector] of [[1920, 1080, false], [1366, 768, false], [1920, 1080, true], [1366, 768, true]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await open(page, optionsOf('himmelblau'), projector);
    await toGeneration(page, 2);
    const bad = await page.evaluate(() => {
      const summary = document.querySelector('[data-testid="summary"]')!;
      const panel = summary.closest('.panel')!.getBoundingClientRect();
      const readout = document.querySelector('[data-testid="peak-readout"]')!.getBoundingClientRect();
      return { overBottom: readout.bottom - panel.bottom, overRight: readout.right - panel.right, scroll: summary.closest('.panel')!.scrollHeight - summary.closest('.panel')!.clientHeight };
    });
    expect(bad.overBottom, `${w}×${h}${projector ? ' projector' : ''}`).toBeLessThanOrEqual(0.5);
    expect(bad.overRight).toBeLessThanOrEqual(0.5);
    expect(bad.scroll).toBeLessThanOrEqual(1);
  }
});

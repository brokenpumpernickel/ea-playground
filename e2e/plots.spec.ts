import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, metricsOf } from '../src/engine';
import { createRun } from '../src/run';
import { defaultParams, defaultSeed, defaultSetup } from '../src/ui/config';

const url = pathToFileURL(resolve('dist/index.html')).href;

/** The engine's own metrics for generations 0..n of the default configuration. */
const engine = (n: number, seed = defaultSeed) => {
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed });
  for (let g = 0; g < n; g++) run.forwardCycle();
  return Array.from({ length: n + 1 }, (_, g) => metricsOf(run.snapshot(g).state));
};

type Marker = readonly [generation: number, value: number, future: boolean];
const series = (page: Page, plot: 'fitness' | 'diversity', name: string): Promise<Marker[]> =>
  page.locator(`[data-plot="${plot}"] [data-series="${name}"][data-gen]`).evaluateAll((els) =>
    els.map((el) => [Number(el.getAttribute('data-gen')), Number(el.getAttribute('data-value')), el.getAttribute('data-future') === 'true'] as const),
  );

const generation = (page: Page) => page.getByRole('button', { name: /^Generation/ });
const generations = async (page: Page, n: number) => {
  for (let k = 0; k < n; k++) await generation(page).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('the fitness and diversity plots show the engine’s metrics for every generation so far', async ({ page }) => {
  await generations(page, 6);
  const metrics = engine(6);
  for (const [name, pick] of [
    ['average', (m: (typeof metrics)[number]) => m.average],
    ['best', (m) => m.best],
    ['bestSoFar', (m) => m.bestSoFar],
  ] as const) {
    const plotted = await series(page, 'fitness', name);
    expect(plotted.map((p) => p[0])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    plotted.forEach(([g, value]) => expect(value).toBeCloseTo(pick(metrics[g]!), 9));
  }
  const diversity = await series(page, 'diversity', 'diversity');
  diversity.forEach(([g, value]) => expect(value).toBeCloseTo(metrics[g]!.diversity, 9));
  expect(diversity).toHaveLength(7);
});

test('the scale is fixed and labelled, with the known optimum marked', async ({ page }) => {
  const fitness = page.locator('[data-plot="fitness"]');
  await expect(fitness).toContainText('optimum 961');
  await expect(fitness).toContainText('1000');
  await expect(fitness).toContainText('generation');
  const before = await fitness.locator('[data-optimum]').getAttribute('y1');
  await generations(page, 4);
  expect(await fitness.locator('[data-optimum]').getAttribute('y1')).toBe(before);
});

test('mid-generation, the plots mark the last complete generation as now and keep later ones dimmed instead of removing them', async ({ page }) => {
  await generations(page, 4);
  await page.getByRole('button', { name: /^Back/ }).click(); // back inside generation 4: the table shows generation 3's parents
  await expect(page.locator('[data-plot="fitness"]')).toHaveAttribute('data-now', '3');
  const best = await series(page, 'fitness', 'best');
  expect(best).toHaveLength(5);
  expect(best.filter((p) => p[2]).map((p) => p[0])).toEqual([4]);
  expect(best.filter((p) => !p[2]).map((p) => p[0])).toEqual([0, 1, 2, 3]);
});

test('over several seeds a generation whose best is below best so far is plotted as such', async ({ page }) => {
  let seen = false;
  for (let attempt = 0; attempt < 8 && !seen; attempt++) {
    await page.getByRole('button', { name: 'New seed' }).click();
    const seed = Number(await page.getByTestId('seed').textContent());
    await generations(page, 12);
    const metrics = engine(12, seed);
    const best = await series(page, 'fitness', 'best');
    const soFar = await series(page, 'fitness', 'bestSoFar');
    best.forEach(([g, value]) => expect(value).toBe(metrics[g]!.best));
    soFar.forEach(([g, value]) => expect(value).toBe(metrics[g]!.bestSoFar));
    seen = metrics.some((m) => m.best < m.bestSoFar);
    if (seen) {
      const dip = metrics.findIndex((m) => m.best < m.bestSoFar);
      expect(best[dip]![1]).toBeLessThan(soFar[dip]![1]);
    }
  }
  expect(seen).toBe(true);
});

test('the share of 1s per gene and the summary numbers describe the generation on screen', async ({ page }) => {
  await generations(page, 3);
  const m = engine(3)[3]!;
  const shares = await page.locator('.allele [data-share]').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-share'))));
  expect(shares).toEqual([...m.alleleFrequencies]);
  await expect(page.getByTestId('summary')).toContainText(`generation 3 · best now ${m.best} · best so far ${m.bestSoFar}`);
  await expect(page.getByTestId('summary')).toContainText(`evaluations ${m.evaluations}`);
  await expect(page.getByTestId('distinct')).toHaveText(`${m.distinct} of 6 distinct`);
});

test('the same numbers are available as a table for anyone who cannot read the charts', async ({ page }) => {
  await generations(page, 2);
  const rows = page.getByTestId('metrics-table').locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(2).locator('td').nth(3)).toHaveText(String(engine(2)[2]!.best));
});

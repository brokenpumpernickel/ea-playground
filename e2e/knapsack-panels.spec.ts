import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, handlings, metricsOf, type GaParams, type Handling, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;

const setupOf = (handling: Handling, o: { rho?: number; seed?: number; params?: GaParams; options?: Partial<KnapsackOptions>; init?: { kind: 'random'; size: number } } = {}) => {
  const options = { ...(entry.defaultOptions() as KnapsackOptions), handling, ...(o.rho !== undefined ? { rho: o.rho } : {}), ...o.options };
  const problem = entry.create(options);
  const setup = { problem, init: o.init ?? entry.defaults.init };
  return { options, problem, setup, params: o.params ?? entry.defaults.params, seed: o.seed ?? 42 };
};
const open = async (page: Page, s: ReturnType<typeof setupOf>, projector = false) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf(s.setup, s.params, s.seed, 'knapsack', s.options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Knapsack/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const series = (page: Page, name: string) =>
  page.locator(`[data-plot="fitness"] [data-series="${name}"][data-gen]`).evaluateAll((els) => els.map((el) => [Number(el.getAttribute('data-gen')), Number(el.getAttribute('data-value'))]));

for (const handling of handlings) {
  test(`${handling}: “Chosen per item” shows, for every item, the share of the population that packs it, at every generation`, async ({ page }) => {
    const s = setupOf(handling);
    await open(page, s);
    await expect(page.getByRole('heading', { name: 'Chosen per item' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Share of 1s per gene' })).toHaveCount(0);
    const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed: s.seed });
    for (let g = 0; g <= 4; g++) {
      if (g > 0) {
        await page.keyboard.press('g');
        run.forwardCycle();
      }
      const shown = await page.locator('.matchbar.chosen [data-item]').evaluateAll((els) => els.map((el) => [el.getAttribute('data-item'), Number(el.getAttribute('data-share'))]));
      const population = run.snapshot(g).state.population;
      expect(shown).toEqual('ABCDEFGHIJKL'.split('').map((letter, k) => [letter, population.filter((i) => i.chromosome[k] === 1).length / population.length]));
      const percents = await page.locator('.matchbar.chosen .gene b').allTextContents();
      expect(percents).toEqual(shown.map(([, share]) => `${Math.round((share as number) * 100)}%`));
    }
    await expect(page.locator('.matchbar.chosen')).toHaveAttribute('aria-label', /^Share of the population that packs each item: item A, \d+ percent; item B/);
  });
}

test('the stats line says how many of the individuals are feasible, as the metrics count them', async ({ page }) => {
  for (const handling of ['penalty', 'decoder'] as const) {
    const s = setupOf(handling);
    await open(page, s);
    const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed: s.seed });
    for (let g = 0; g <= 3; g++) {
      if (g > 0) {
        await page.keyboard.press('g');
        run.forwardCycle();
      }
      const m = metricsOf(run.snapshot(g).state);
      await expect(page.getByTestId('summary')).toContainText(`feasible ${m.feasible!.count} of 8`);
    }
    if (handling === 'decoder') await expect(page.getByTestId('summary')).toContainText('feasible 8 of 8');
  }
});

test('penalty: the best feasible so far has a line of its own, equal to the metrics, named in the legend', async ({ page }) => {
  const s = setupOf('penalty');
  await open(page, s);
  const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed: s.seed });
  for (let g = 0; g < 5; g++) {
    await page.keyboard.press('g');
    run.forwardCycle();
  }
  const shown = await series(page, 'feasibleBestSoFar');
  const expected = Array.from({ length: 6 }, (_, g) => [g, metricsOf(run.snapshot(g).state).feasible!.bestSoFar] as const).filter(([, v]) => v !== null);
  expect(shown).toEqual(expected);
  await expect(page.locator('#fitness-heading + .legend, .legend').first()).toContainText('best feasible so far');
  await expect(page.locator('[data-plot="fitness"]')).toHaveAttribute('aria-label', /best feasible so far \d+/);
});

test('a penalty that is too small: the best fitness climbs above the optimum line and the best feasible stays below it', async ({ page }) => {
  const s = setupOf('penalty', { rho: 0, params: { ...entry.defaults.params, elites: 1, stop: { generationLimit: 60, targetFitness: 123 } } });
  await open(page, s);
  for (let g = 0; g < 15; g++) await page.keyboard.press('g');
  const best = await series(page, 'best');
  const feasible = await series(page, 'feasibleBestSoFar');
  expect(Math.max(...best.map(([, v]) => v!))).toBeGreaterThan(123);
  expect(Math.max(...feasible.map(([, v]) => v!))).toBeLessThanOrEqual(123);
  await expect(page.locator('[data-optimum="123"]')).toHaveCount(1);
  await expect(page.getByRole('status')).not.toContainText('target');
});

test('the other methods and problems have no such line, and Goldberg keeps its own panel', async ({ page }) => {
  await open(page, setupOf('decoder'));
  await page.keyboard.press('g');
  await expect(page.locator('[data-series="feasibleBestSoFar"]')).toHaveCount(0);
  await expect(page.locator('.legend', { hasText: 'best feasible' })).toHaveCount(0);
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Share of 1s per gene' })).toBeVisible();
  await expect(page.getByTestId('summary')).not.toContainText('feasible');
});

for (const items of [12, 20]) {
  test(`${items} items: the bars of “Chosen per item” and the stats line stay inside their panel, in normal and projector mode`, async ({ page }) => {
    const base = (entry.defaultOptions() as KnapsackOptions).items;
    const list = Array.from({ length: items }, (_, k) => base[k % 12]!);
    const total = list.reduce((t, i) => t + i.weight, 0);
    for (const projector of [false, true]) {
      await open(page, setupOf('decoder', { options: { items: list, capacity: Math.floor(total / 2) } }), projector);
      await page.keyboard.press('g');
      const fits = await page.locator('section[aria-labelledby="allele-heading"]').evaluate((el) => {
        const panel = el.getBoundingClientRect();
        const bad = [...el.querySelectorAll('.matchbar .gene, .summary')].filter((c) => c.getBoundingClientRect().right > panel.right + 1 || c.scrollWidth > c.clientWidth + 1);
        return bad.length;
      });
      expect(fits).toBe(0);
    }
  });
}

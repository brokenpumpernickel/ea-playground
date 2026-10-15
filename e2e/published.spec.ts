import { expect, test } from '@playwright/test';
import { formatGenes, formatTour, gaAlgorithm, landscapeDefaults, metricsOfProblem, trapProblem, tspDefaults, tspProblem, type GaParams, type KnapsackOptions, type LandscapeOptions, type TrapOptions, type TspOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { statsLines } from '../src/ui/spread-model';
import { tourInfoOf, tourStatsLines } from '../src/ui/tour-cells';

// Run against the deployed site: PUBLISHED_URL=https://brokenpumpernickel.github.io/ea-playground/ npx playwright test e2e/published.spec.ts
const published = process.env.PUBLISHED_URL;
test.skip(!published, 'set PUBLISHED_URL to check the deployed site');

const entry = entryOf('knapsack')!;
const base = entry.defaultOptions() as KnapsackOptions;

for (const handling of ['decoder', 'penalty', 'repair-lamarckian', 'repair-baldwinian'] as const) {
  test(`the published site opens a ${handling} knapsack link (9 items, capacity 30) as the same run`, async ({ page }) => {
    const options: KnapsackOptions = { items: base.items.slice(0, 9), capacity: 30, handling, rho: 3.5 };
    const params: GaParams = { ...entry.defaults.params, mutation: { enabled: true, mode: 'per-gene', probability: 0.1 }, elites: 1 };
    const setup = { problem: entry.create(options), init: { kind: 'random' as const, size: 8 } };
    await page.goto(published! + encodeConfig(configOf(setup, params, 31, 'knapsack', options)));
    await expect(page.getByTestId('link-notice')).toHaveCount(0);
    await expect(page.locator('#brand .s')).toHaveText(/^9 items · capacity 30 · optimum \d+$/);
    const run = createRun(gaAlgorithm, { setup, params, seed: 31 });
    const rows = () => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
    const shown = (g: number) => run.snapshot(g).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet));
    expect(await rows()).toEqual(shown(0));
    for (let g = 1; g <= 4; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 4');
    expect(await rows()).toEqual(shown(4));
  });
}

const trap = entryOf('trap')!;
for (const linkage of ['tight', 'loose'] as const) {
  test(`the published site opens a ${linkage} trap link (3 blocks of 5, a hand-edited population) as the same run`, async ({ page }) => {
    const options: TrapOptions = { blockSize: 5, blocks: 3, linkage };
    const params: GaParams = { ...trap.defaults.params, mutation: { enabled: true, mode: 'per-gene', probability: 0.1 }, elites: 1 };
    const chromosomes = ['111111111111111', '000000000000000', '110101010011001', '000111000111000'];
    const setup = { problem: trapProblem(options), init: { kind: 'explicit' as const, chromosomes } };
    await page.goto(published! + encodeConfig(configOf(setup, params, 31, 'trap', options)));
    await expect(page.getByTestId('link-notice')).toHaveCount(0);
    await expect(page.locator('#brand .s')).toHaveText(`3 blocks of 5 · ${linkage} · optimum 15`);
    const run = createRun(gaAlgorithm, { setup, params, seed: 31 });
    const rows = () => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
    const shown = (g: number) => run.snapshot(g).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet));
    expect(await rows()).toEqual(shown(0));
    for (let g = 1; g <= 4; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 4');
    expect(await rows()).toEqual(shown(4));
    await expect(page.getByTestId('block-states')).toBeVisible();
  });
}

const landscape = entryOf('landscape')!;
for (const options of [
  { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 },
  { function: 'rastrigin', representation: 'gray', bitsPerVariable: 8 },
  { function: 'two-peaks', representation: 'plain', bitsPerVariable: 6 },
] as const satisfies readonly LandscapeOptions[]) {
  test(`the published site opens a ${options.function} landscape link (${options.representation}, a hand-edited population) as the same run`, async ({ page }) => {
    const defaults = landscapeDefaults(options);
    const params: GaParams = { ...defaults.params, elites: 2 };
    const chromosomes = options.representation === 'real' ? ['-5 -5', '5 5', '0 0', '2.5 -3.75', '-1 1', '3 2'] : ['0'.repeat(2 * options.bitsPerVariable), '1'.repeat(2 * options.bitsPerVariable), '10'.repeat(options.bitsPerVariable), '01'.repeat(options.bitsPerVariable)];
    const setup = { problem: landscape.create(options), init: { kind: 'explicit' as const, chromosomes } };
    await page.goto(published! + encodeConfig(configOf(setup, params, 31, 'landscape', options)));
    await expect(page.getByTestId('link-notice')).toHaveCount(0);
    await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
    const run = createRun(gaAlgorithm, { setup, params, seed: 31 });
    const summary = async () => (await page.getByTestId('summary').innerText()).split('\n')[0]!.trim();
    const numbers = /-?\d+(\.\d+)?(e-?\d+)?/g;
    const expectSame = async (g: number) => {
      const want = statsLines(metricsOfProblem(run.snapshot(g).state, setup.problem))[0];
      const got = await summary();
      expect(got.replace(numbers, '#')).toBe(want.replace(numbers, '#'));
      got.match(numbers)!.map(Number).forEach((v, k) => expect(v).toBeCloseTo(want.match(numbers)!.map(Number)[k]!, 2));
    };
    await expectSame(0);
    for (let g = 1; g <= 4; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 4');
    await expectSame(4);
    await page.getByTestId('show-landscape').click();
    await expect(page.getByTestId('heat-marks')).toBeVisible();
    await expect(page.getByTestId('heatmap')).toBeVisible();
    await expect(page.getByTestId('surface')).toBeVisible();
  });
}

const tsp = entryOf('tsp')!;
for (const [label, options, size] of [
  ['berlin52 (a TSPLIB instance, EUC_2D)', { instance: 'berlin52', n: 10, seed: 1 }, 20],
  ['ulysses16 (GEO)', { instance: 'ulysses16', n: 10, seed: 1 }, 12],
  ['a circle of 9 cities with a hand-edited population', { instance: 'circle', n: 9, seed: 1 }, 0],
  ['a random instance of 12 cities', { instance: 'random', n: 12, seed: 5 }, 16],
] as [string, TspOptions, number][]) {
  test(`the published site opens a TSP link for ${label} as the same run`, async ({ page }) => {
    const defaults = tspDefaults(options);
    const params: GaParams = { ...defaults.params, crossover: { ...defaults.params.crossover, operator: 'pmx' }, mutation: { ...defaults.params.mutation, operator: 'insertion' }, elites: 1 };
    const init = size === 0 ? { kind: 'explicit' as const, chromosomes: ['1 2 3 4 5 6 7 8 9', '9 8 7 6 5 4 3 2 1', '3 1 2 4 5 6 9 7 8', '1 3 5 7 9 2 4 6 8'] } : { kind: 'random' as const, size };
    const setup = { problem: tspProblem(options), init };
    await page.goto(published! + encodeConfig(configOf(setup, params, 31, 'tsp', options)));
    await expect(page.getByTestId('link-notice')).toHaveCount(0);
    await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
    const run = createRun(gaAlgorithm, { setup, params, seed: 31 });
    const info = tourInfoOf(setup.problem);
    const summary = async () => (await page.getByTestId('summary').innerText()).replace(/\s*\n\s*/g, '');
    const rows = () => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
    const same = async (g: number) => {
      expect(await summary()).toBe(tourStatsLines(info, metricsOfProblem(run.snapshot(g).state, setup.problem)).join(''));
      expect(await rows()).toEqual(run.snapshot(g).state.population.map((i) => formatTour(i.chromosome)));
    };
    await same(0);
    for (let g = 1; g <= 4; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 4');
    await same(4);
    await page.getByTestId('show-map').click();
    await expect(page.getByTestId('route-map')).toBeVisible();
    await expect(page.getByTestId('route-sentence')).toContainText(`${options.instance === 'berlin52' ? 'berlin52' : ''}`);
    await expect(page.locator('svg[data-plot="fitness"] text[data-label="nearest"]')).toBeVisible();
  });
}

test('the published site gives the route map the whole centre (E), zooms it with the wheel and leaves with Esc', async ({ page }) => {
  const options: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
  const defaults = tspDefaults(options);
  const setup = { problem: tspProblem(options), init: { kind: 'random' as const, size: 20 } };
  await page.goto(published! + encodeConfig(configOf(setup, defaults.params, 31, 'tsp', options)));
  await page.getByTestId('show-map').click();
  await page.keyboard.press('e');
  await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  await expect(page.locator('svg[data-plot="fitness-mini"]')).toBeVisible();
  await expect(page.getByTestId('focus-card')).toContainText('Generation 0');
  const box = (await page.getByTestId('route-map').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  expect(Number(await page.getByTestId('route-map').getAttribute('data-zoom'))).toBeGreaterThan(2);
  await page.keyboard.press('g');
  await expect(page.locator('svg[data-plot="fitness-mini"]')).toHaveAttribute('data-now', '1');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
});

test('the published site gives the landscape the whole centre and zooms the heatmap and the surface', async ({ page }) => {
  const options: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 };
  const defaults = landscapeDefaults(options);
  const setup = { problem: landscape.create(options), init: { kind: 'random' as const, size: 12 } };
  await page.goto(published! + encodeConfig(configOf(setup, defaults.params, 31, 'landscape', options)));
  await page.getByTestId('show-landscape').click();
  await page.keyboard.press('e');
  await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  const heat = (await page.getByTestId('heatmap').boundingBox())!;
  await page.mouse.move(heat.x + heat.width / 2, heat.y + heat.height / 2);
  await page.mouse.wheel(0, -300);
  expect(Number(await page.getByTestId('heatmap').getAttribute('data-zoom'))).toBeGreaterThan(1);
  const surface = (await page.getByTestId('surface').boundingBox())!;
  await page.mouse.move(surface.x + surface.width / 2, surface.y + surface.height / 2);
  await page.mouse.wheel(0, -300);
  expect(Number(await page.getByTestId('surface').getAttribute('data-zoom'))).toBeGreaterThan(1);
  await page.getByTestId('reset-view').click();
  await expect(page.getByTestId('heatmap')).toHaveAttribute('data-region', '-5,5,-5,5');
});

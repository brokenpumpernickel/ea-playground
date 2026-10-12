import { expect, test } from '@playwright/test';
import { formatGenes, gaAlgorithm, landscapeDefaults, metricsOfProblem, trapProblem, type GaParams, type KnapsackOptions, type LandscapeOptions, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { statsLines } from '../src/ui/spread-model';

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

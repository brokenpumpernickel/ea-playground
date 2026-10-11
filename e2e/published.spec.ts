import { expect, test } from '@playwright/test';
import { formatGenes, gaAlgorithm, trapProblem, type GaParams, type KnapsackOptions, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

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

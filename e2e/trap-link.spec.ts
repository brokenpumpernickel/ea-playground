import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, linkages, type GaParams, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const base = entry.defaultOptions() as TrapOptions;
const b64url = (value: unknown) => `#v1.${Buffer.from(JSON.stringify(value)).toString('base64url')}`;
const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));

const good = configOf({ problem: entry.create(base), init: entry.defaults.init }, entry.defaults.params, 5, 'trap', base);
const bad = (change: (c: Record<string, any>) => void) => {
  const copy = JSON.parse(JSON.stringify(good));
  change(copy);
  return b64url(copy);
};

test('the problem menu lists Trap fourth (and the landscape fifth), and choosing it restarts as the trap: the brand line, the population and the run are the engine’s', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await expect(page.getByRole('menuitemradio')).toHaveText([/Goldberg/, /Target string/, /Knapsack/, /Trap/, /Landscape/, /TSP/]);
  await page.getByRole('menuitemradio', { name: /Trap/ }).click();
  await expect(page.getByTestId('reset-notice')).toContainText('Switching to the problem Trap restarts the run from generation 0');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
  await expect(page.locator('#brand .s')).toHaveText('5 blocks of 4 · tight · optimum 20');
  await expect(page.locator('#brand .logo')).toHaveText('Tr');
  await expect(page.getByTestId('seed')).toHaveText('42');
  const setup = { problem: entry.create(base), init: entry.defaults.init };
  const run = createRun(gaAlgorithm, { setup, params: entry.defaults.params, seed: 42 });
  const shown = (g: number) => run.snapshot(g).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet));
  expect(await rows(page)).toEqual(shown(0));
  expect((await rows(page)).every((r) => r!.length === 20)).toBe(true);
  for (let g = 1; g <= 3; g++) {
    await page.keyboard.press('g');
    run.forwardCycle();
  }
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 3');
  expect(await rows(page)).toEqual(shown(3));
  await expect(page.getByTestId('summary')).toContainText('best');
});

for (const linkage of linkages) {
  test(`${linkage}: the link of a configured trap run opens as the same run in a fresh page, with its options and hand-edited population`, async ({ page }) => {
    const options: TrapOptions = { blockSize: 3, blocks: 4, linkage };
    const params: GaParams = { ...entry.defaults.params, crossover: { enabled: true, operator: 'two-point', probability: 0.6 }, mutation: { enabled: true, mode: 'per-individual', probability: 0.5 }, stop: { generationLimit: 30 } };
    const chromosomes = ['111111111111', '000000000000', '110100110100'];
    const setup = { problem: entry.create(options), init: { kind: 'explicit' as const, chromosomes } };
    await page.goto(url + encodeConfig(configOf(setup, params, 77, 'trap', options)));
    await expect(page.getByTestId('link-notice')).toHaveCount(0);
    await expect(page.locator('#brand .s')).toHaveText(`4 blocks of 3 · ${linkage} · optimum 12`);
    expect(page.url()).toBe(url);
    const run = createRun(gaAlgorithm, { setup, params, seed: 77 });
    const shown = (g: number) => run.snapshot(g).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet));
    expect(await rows(page)).toEqual(shown(0));
    for (let g = 1; g <= 3; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    expect(await rows(page)).toEqual(shown(3));
  });
}

for (const [name, hash, words] of [
  ['a block size of 1', bad((c) => (c.options.blockSize = 1)), 'Block size must be a whole number from 2 to 8 (it is 1).'],
  ['11 blocks', bad((c) => (c.options.blocks = 11)), 'The number of blocks must be a whole number from 1 to 10 (it is 11).'],
  ['more than 30 genes', bad((c) => ((c.options.blockSize = 8), (c.options.blocks = 6))), 'Block size × blocks: at most 30 genes in all (8 × 6 = 48).'],
  ['an unknown linkage', bad((c) => (c.options.linkage = 'random')), 'Linkage must be one of tight, loose.'],
  ['a block size given as text', bad((c) => (c.options.blockSize = '4')), '"options.blockSize" must be a number.'],
  ['no options at all', bad((c) => delete c.options), '"configuration" is missing "options", which Trap needs.'],
  ['a hand-edited population of the wrong length', bad((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['0101'] })), 'Chromosome 1 has 4 genes, but this problem needs 20.'],
] as const) {
  test(`a bad link (${name}) opens the default configuration with the drawer’s own message, applies nothing of it, and clears the address`, async ({ page }) => {
    await page.goto(url + hash);
    const notice = page.getByTestId('link-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'alert');
    await expect(notice).toContainText('default configuration is open instead');
    await expect(notice).toContainText(words);
    await expect(page.getByTestId('problem-button')).toHaveText(/Goldberg/);
    await expect(page.getByTestId('seed')).toHaveText('42');
    expect(page.url()).toBe(url);
  });
}

test('applying another parameter in the drawer keeps the trap and its options (a link with 3 blocks of 5, loose, survives a restart with a new seed)', async ({ page }) => {
  const options: TrapOptions = { blockSize: 5, blocks: 3, linkage: 'loose' };
  const setup = { problem: entry.create(options), init: entry.defaults.init };
  await page.goto(url + encodeConfig(configOf(setup, entry.defaults.params, 5, 'trap', options)));
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#seed').fill('11');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#brand .s')).toHaveText('3 blocks of 5 · loose · optimum 15');
  const run = createRun(gaAlgorithm, { setup, params: entry.defaults.params, seed: 11 });
  expect(await rows(page)).toEqual(run.snapshot(0).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet)));
});

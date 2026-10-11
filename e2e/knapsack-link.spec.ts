import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, handlings, type GaParams, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;
const base = entry.defaultOptions() as KnapsackOptions;
const b64url = (value: unknown) => `#v1.${Buffer.from(JSON.stringify(value)).toString('base64url')}`;
const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));

const good = configOf({ problem: entry.create(base), init: entry.defaults.init }, entry.defaults.params, 5, 'knapsack', base);
const bad = (change: (c: Record<string, any>) => void) => {
  const copy = JSON.parse(JSON.stringify(good));
  change(copy);
  return b64url(copy);
};

for (const [name, hash, words] of [
  ['an item with weight 0', bad((c) => (c.options.items[5].weight = 0)), 'Item F: the weight must be a whole number from 1 to 99 (it is 0).'],
  ['an item with a value above 999', bad((c) => (c.options.items[1].value = 1000)), 'Item B: the value must be a whole number from 1 to 999 (it is 1000).'],
  ['a single item', bad((c) => (c.options.items = [c.options.items[0]])), 'A knapsack needs at least 2 items (there is 1).'],
  ['21 items', bad((c) => (c.options.items = Array.from({ length: 21 }, () => ({ weight: 1, value: 1 })))), 'A knapsack can have at most 20 items (there are 21).'],
  ['a capacity above the total weight', bad((c) => (c.options.capacity = 98)), 'The capacity can be at most the total weight, 97 (it is 98)'],
  ['a capacity of 0', bad((c) => (c.options.capacity = 0)), 'The capacity must be a whole number of at least 1 (it is 0).'],
  ['an unknown handling method', bad((c) => (c.options.handling = 'greedy')), 'The constraint handling must be one of decoder, penalty, repair-lamarckian, repair-baldwinian.'],
  ['a negative ρ', bad((c) => (c.options.rho = -1)), 'The penalty ρ must be a number from 0 to 1000 (it is -1).'],
  ['ρ given as text', bad((c) => (c.options.rho = '4')), '"options.rho" must be a number.'],
  ['a missing ρ', bad((c) => delete c.options.rho), '"options" is missing "rho".'],
  ['no options at all', bad((c) => delete c.options), '"configuration" is missing "options", which Knapsack needs.'],
  ['a hand-edited bag of the wrong length', bad((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['0101'] })), 'Chromosome 1 has 4 genes, but this problem needs 12.'],
] as const) {
  test(`a bad link (${name}) opens the default configuration with the drawer’s own message, applies nothing of it, and clears the address`, async ({ page }) => {
    await page.goto(url + hash);
    const notice = page.getByTestId('link-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'alert');
    await expect(notice).toContainText('default configuration is open instead');
    await expect(notice).toContainText(words);
    await expect(page.getByTestId('problem-button')).toHaveText(/Goldberg/);
    await expect(page.getByTestId('seed')).toHaveText('42'); // not the link's seed 5
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
    expect(page.url()).toBe(url);
  });
}

test('a link with several problems lists them all, and none of its good parts is used', async ({ page }) => {
  await page.goto(url + bad((c) => ((c.options.capacity = 0), (c.options.rho = -1), (c.options.items[0].weight = 0))));
  const items = await page.getByTestId('link-notice').locator('li').allTextContents();
  expect(items).toHaveLength(3);
  await expect(page.getByTestId('problem-button')).toHaveText(/Goldberg/);
});

for (const handling of handlings) {
  test(`${handling}: the link of a configured knapsack run opens as the same run in a fresh page, with its instance, method and hand-edited population`, async ({ page }) => {
    const options: KnapsackOptions = { items: base.items.slice(0, 9), capacity: 30, handling, rho: 3.5 };
    const params: GaParams = { ...entry.defaults.params, crossover: { enabled: true, operator: 'two-point', probability: 0.6 }, mutation: { enabled: true, mode: 'per-individual', probability: 0.5 } };
    const bags = ['110000000', '011011011', '000000001'];
    const setup = { problem: entry.create(options), init: { kind: 'explicit' as const, chromosomes: bags } };
    await page.goto(url + encodeConfig(configOf(setup, params, 77, 'knapsack', options)));
    await expect(page.getByTestId('link-notice')).toHaveCount(0);
    await expect(page.locator('#brand .s')).toHaveText(/^9 items · capacity 30 · optimum \d+$/);
    expect(page.url()).toBe(url);
    const run = createRun(gaAlgorithm, { setup, params, seed: 77 });
    const show = (g: number) => run.snapshot(g).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet));
    expect(await rows(page)).toEqual(show(0));
    for (let g = 1; g <= 3; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    expect(await rows(page)).toEqual(show(3));
    await page.getByRole('button', { name: /Parameters/ }).click();
    await expect(page.locator('#handling')).toHaveValue(handling);
    await expect(page.locator('#capacity')).toHaveValue('30');
    await expect(page.locator('input[id^="item-weight-"]')).toHaveCount(9);
  });
}

test('a link with 20 items and a very different instance opens, plays and fits the screen', async ({ page }) => {
  const items = Array.from({ length: 20 }, (_, k) => ({ weight: 5 + ((k * 7) % 40), value: 10 + ((k * 13) % 90) }));
  const total = items.reduce((t, i) => t + i.weight, 0);
  const options: KnapsackOptions = { items, capacity: Math.floor(total / 3), handling: 'repair-lamarckian', rho: 8 };
  const setup = { problem: entry.create(options), init: { kind: 'random' as const, size: 8 } };
  await page.goto(url + encodeConfig(configOf(setup, entry.defaults.params, 3, 'knapsack', options)));
  await expect(page.getByTestId('link-notice')).toHaveCount(0);
  await expect(page.getByTestId('item-row').first().locator('.itemrow > span')).toHaveCount(20);
  const run = createRun(gaAlgorithm, { setup, params: entry.defaults.params, seed: 3 });
  for (let g = 0; g < 2; g++) {
    await page.keyboard.press('g');
    run.forwardCycle();
  }
  expect(await rows(page)).toEqual(run.snapshot(2).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

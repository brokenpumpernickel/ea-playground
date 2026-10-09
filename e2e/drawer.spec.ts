import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatBits, gaAlgorithm, goldberg } from '../src/engine';
import { createRun } from '../src/run';
import { defaultParams, defaultSeed, defaultSetup } from '../src/ui/config';

const url = pathToFileURL(resolve('dist/index.html')).href;

const generations = async (page: Page, n: number) => {
  for (let k = 0; k < n; k++) await page.getByRole('button', { name: /^Generation/ }).click();
};
const openDrawer = async (page: Page) => {
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.getByTestId('drawer')).toBeVisible();
};
const setText = async (page: Page, id: string, value: string) => {
  const input = page.locator(`#${id}`);
  await input.fill(value);
  await input.press('Enter');
};
const populationRows = (page: Page) =>
  page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const state = (run: ReturnType<typeof createRun>, cycle: number) => (run.snapshot(cycle).state as { population: { chromosome: number[] }[] }).population.map((i) => i.chromosome.join(''));

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('the drawer is closed to start with, opens from Parameters, and Escape closes it and returns focus', async ({ page }) => {
  await expect(page.getByTestId('drawer')).toHaveCount(0);
  const button = page.getByRole('button', { name: /Parameters/ });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('drawer')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('drawer')).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('every operator control explains what its probability applies to and when the draw is made', async ({ page }) => {
  await openDrawer(page);
  await expect(page.locator('[data-field="crossover-probability"]')).toContainText('Applies per pair. One draw u per pair');
  await expect(page.locator('[data-field="mutation-probability"]')).toContainText('Per gene: every gene of every offspring draws u');
  await expect(page.locator('[data-field="mutation-probability"]')).toContainText('Per individual: one draw per offspring');
  await expect(page.locator('[data-field="crossover-on"]')).toContainText('each pair of parents passes to the offspring as copies');
  await expect(page.locator('[data-field="mutation-on"]')).toContainText('every offspring passes through unchanged');
});

test('changing pc in the middle of a generation shows as pending and applies at the next generation boundary', async ({ page }) => {
  await generations(page, 1);
  await page.getByRole('button', { name: /^Micro-step/ }).click(); // generation 2, selection entered
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  await openDrawer(page);
  await setText(page, 'crossover-probability', '0.3');
  await expect(page.getByTestId('pending-crossover-probability')).toHaveText('pending · 0.8 → 0.3');
  await expect(page.getByTestId('pending-chip')).toBeVisible();
  await expect(page.getByTestId('discard-notice')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // this generation still uses the old probability
  await page.getByRole('button', { name: /^Stage/ }).click(); // end of selection
  await page.getByRole('button', { name: /^Stage/ }).click(); // end of pairing
  await page.getByRole('button', { name: /^Micro-step/ }).click(); // crossover entered
  await expect(page.locator('.crossover .expl')).toContainText('u < pc (0.8)');
  await expect(page.getByTestId('pending-chip')).toBeVisible();

  // the next one uses the new one, and nothing is pending any more
  await page.getByRole('button', { name: /^Generation/ }).click();
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  await page.getByRole('button', { name: /^Stage/ }).click();
  await page.getByRole('button', { name: /^Stage/ }).click();
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  await expect(page.locator('.crossover .expl')).toContainText('u < pc (0.3)');
  await expect(page.getByTestId('pending-chip')).toHaveCount(0);

  // and the run is the one the engine makes with that change at that boundary
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: defaultSeed });
  run.forwardCycle();
  run.forwardCycle();
  run.setParameters({ ...defaultParams, crossover: { ...defaultParams.crossover, probability: 0.3 } });
  run.forwardCycle();
  await page.getByRole('button', { name: /^Generation/ }).click();
  expect(await populationRows(page)).toEqual(state(run, 3));
});

test('an invalid entry is explained and changes nothing', async ({ page }) => {
  await openDrawer(page);
  await setText(page, 'crossover-probability', 'abc');
  await expect(page.locator('[data-field="crossover-probability"]')).toContainText('must be a number from 0 to 1');
  await expect(page.getByTestId('pending-chip')).toHaveCount(0);
  await setText(page, 'mutation-probability', '1.5');
  await expect(page.locator('[data-field="mutation-probability"]')).toContainText('must be a number from 0 to 1');
  await setText(page, 'elites', '9');
  await expect(page.locator('[data-field="elites"]')).toContainText('from 0 to the population size (6)');
  await expect(page.getByTestId('pending-chip')).toHaveCount(0);
  await generations(page, 2); // the run is untouched: it still runs with the defaults
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: defaultSeed });
  run.forwardCycle();
  run.forwardCycle();
  expect(await populationRows(page)).toEqual(state(run, 2));
});

test('the weight chain editor adds, orders and removes steps and says what is wrong with an invalid chain', async ({ page }) => {
  await openDrawer(page);
  await page.locator('#add-step').selectOption('linear-ranking');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const chain = page.getByTestId('chain-editor');
  await expect(chain).toContainText('Step 2 (Linear ranking) needs ranks as its input; put a Rank step before it.');
  await expect(chain.locator('li.bad')).toHaveCount(1);
  await expect(page.getByTestId('pending-chip')).toHaveCount(0); // an invalid chain is never applied

  await page.locator('#add-step').selectOption('rank');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /Move step 3 \(Rank\) up/ }).click();
  await expect(chain.locator('li').nth(1)).toHaveAttribute('data-step', 'rank');
  await expect(chain).not.toContainText('needs ranks');
  await expect(chain.locator('li.bad')).toHaveCount(0);
  await expect(page.getByTestId('pending-chip')).toBeVisible();

  await page.getByRole('button', { name: /Remove step 3 \(Linear ranking\)/ }).click();
  await expect(chain.locator('li')).toHaveCount(2);
});

test('tournament selection says it ignores the chain', async ({ page }) => {
  await openDrawer(page);
  await page.locator('#method').selectOption('tournament');
  await expect(page.locator('[data-field="tournamentSize"]')).toContainText('ignores the weight chain');
  await expect(page.getByTestId('chain-editor')).toHaveCount(0);
  await setText(page, 'tournamentSize', '3');
  await expect(page.getByTestId('pending-chip')).toBeVisible();
  await generations(page, 1);
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  await expect(page.getByTestId('pending-chip')).toHaveCount(0);
});

test('population size and the seed need a restart: the notice names what is lost, cancel changes nothing, confirm restarts', async ({ page }) => {
  await generations(page, 3);
  const before = await populationRows(page);
  await openDrawer(page);
  await setText(page, 'size', '8');
  await expect(page.getByTestId('pending-chip')).toHaveCount(0); // not an operator parameter
  await expect(page.getByText('Changed: Population size. Restarts the run from generation 0.')).toBeVisible();
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Changing the population size restarts the run from generation 0 and discards the 3 recorded generations (1–3).');

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('reset-notice')).toHaveCount(0);
  expect(await populationRows(page)).toEqual(before);
  await expect(page.getByText('recorded gens 0–3')).toBeVisible();

  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByText('recorded gens 0–0')).toBeVisible();
  const run = createRun(gaAlgorithm, { setup: { ...defaultSetup, init: { kind: 'random', size: 8 } }, params: defaultParams, seed: defaultSeed });
  expect(await populationRows(page)).toEqual(state(run, 0));
  expect(await populationRows(page)).toHaveLength(8);
});

test('a hand-edited population shows each chromosome’s x and fitness as you type, rejects bad ones in words, and starts the run from it', async ({ page }) => {
  await openDrawer(page);
  await page.locator('#init').selectOption('explicit');
  const area = page.locator('#chromosomes');
  await area.fill('01101\n11000\n01000\n10011');
  const table = page.getByRole('table', { name: 'Hand-edited population' });
  const rows = await table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('[data-bits], [data-col]')].map((el) => el.getAttribute('data-bits') ?? el.textContent)));
  expect(rows).toEqual([
    ['01101', '13', '169'],
    ['11000', '24', '576'],
    ['01000', '8', '64'],
    ['10011', '19', '361'],
  ]);

  await area.fill('01101\n0110\n01x01');
  await expect(page.locator('[data-field="chromosomes"]')).toContainText('Chromosome 2 has 4 genes, but this problem needs 5.');
  await expect(page.getByTestId('apply-reset')).toBeDisabled();

  await area.fill('01101\n11000\n01000\n10011');
  await expect(page.getByTestId('apply-reset')).toBeEnabled();
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toContainText('Changing the initialization restarts the run from generation 0');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  expect(await populationRows(page)).toEqual(['01101', '11000', '01000', '10011']);
  await page.keyboard.press('Escape');
  await generations(page, 2);
  const run = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] } }, params: defaultParams, seed: defaultSeed });
  run.forwardCycle();
  run.forwardCycle();
  expect(await populationRows(page)).toEqual(state(run, 2));
  expect(formatBits([0, 1, 1, 0, 1])).toBe('01101');
});

test('scrubbing back and changing a parameter shows the notice, cancel changes nothing, and confirming reruns from there reproducibly', async ({ page }) => {
  await generations(page, 6);
  const scrub = page.getByTestId('scrub');
  await scrub.focus();
  for (let k = 0; k < 3; k++) await page.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '3');
  const oldRows = await populationRows(page);
  await openDrawer(page);

  await setText(page, 'mutation-probability', '0.3');
  const notice = page.getByTestId('discard-notice');
  await expect(notice).toHaveText('Generations 4–6 will be discarded. The run continues from generation 3 with the new settings.');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByText('recorded gens 0–6')).toBeVisible();
  await expect(page.locator('#mutation-probability')).toHaveValue('0.05'); // the drawer shows what the run really has
  await expect(page.getByTestId('pending-chip')).toHaveCount(0);
  expect(await populationRows(page)).toEqual(oldRows);

  await setText(page, 'mutation-probability', '0.3');
  await page.getByRole('button', { name: 'Discard and apply' }).click();
  await expect(page.getByText('recorded gens 0–3')).toBeVisible();
  await expect(page.getByTestId('pending-chip')).toBeVisible();
  await page.keyboard.press('Escape');
  await generations(page, 3);

  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: defaultSeed });
  for (let g = 0; g < 3; g++) run.forwardCycle();
  run.setParameters({ ...defaultParams, mutation: { ...defaultParams.mutation, probability: 0.3 } });
  for (let g = 0; g < 3; g++) run.forwardCycle();
  expect(await populationRows(page)).toEqual(state(run, 6));
  const original = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: defaultSeed });
  for (let g = 0; g < 6; g++) original.forwardCycle();
  expect(state(run, 6)).not.toEqual(state(original, 6));
});

test('warnings appear when the population or generation limit is beyond what the app is designed for', async ({ page }) => {
  await openDrawer(page);
  await setText(page, 'size', '600');
  await expect(page.getByTestId('drawer-warnings')).toContainText('Population size 600 is above the supported limit of 500');
  await setText(page, 'stop-limit', '5000');
  await expect(page.getByTestId('drawer-warnings')).toContainText('A generation limit of 5000 is above the supported maximum of 2000');
  await setText(page, 'size', '6');
  await expect(page.getByTestId('drawer-warnings')).not.toContainText('Population size');
});

test('elites show their share of the population, and the stop criteria can be switched off', async ({ page }) => {
  await openDrawer(page);
  await setText(page, 'elites', '2');
  await expect(page.locator('[data-field="elites"]')).toContainText('33.3% of N');
  await expect(page.getByTestId('pending-elites')).toHaveText('pending · 0 → 2');
  await page.locator('#stop-target-on').uncheck();
  await expect(page.locator('#stop-target')).toBeDisabled();
});

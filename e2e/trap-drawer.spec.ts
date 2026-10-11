import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const base = entry.defaultOptions() as TrapOptions;
const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const openTrap = async (page: Page, options: TrapOptions = base) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: entry.defaults.init }, entry.defaults.params, 42, 'trap', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
  await page.getByRole('button', { name: /Parameters/ }).click();
};
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};

test('the run setup has the block size, the number of blocks, the linkage and the trap’s definition with the numbers for the current sizes; the other problems have none of it', async ({ page }) => {
  await openTrap(page);
  await expect(page.locator('#block-size')).toHaveValue('4');
  await expect(page.locator('#blocks')).toHaveValue('5');
  await expect(page.locator('#linkage')).toHaveValue('tight');
  await expect(page.getByTestId('trap-definition')).toContainText('k − 1 − u');
  await expect(page.getByTestId('trap-definition')).toContainText('Deb and Goldberg');
  await expect(page.getByTestId('trap-definition')).toContainText('1111 → 4, 0000 → 3, 1000 → 2, 1100 → 1, 1110 → 0');
  await expect(page.getByTestId('trap-definition')).toContainText('The best fitness is 20; all zeros scores 15.');
  await expect(page.locator('#blocks-help')).toHaveText('1 to 10 blocks, at most 30 genes in all (4 × 5 = 20).');
  await expect(page.getByTestId('apply-reset')).toBeDisabled();
  await page.locator('#linkage').selectOption('loose');
  await expect(page.locator('#linkage-help')).toContainText('genes 1, 6, 11, …');
  await page.locator('#block-size').fill('3');
  await expect(page.getByTestId('trap-definition')).toContainText('The best fitness is 15; all zeros scores 10.');
  await page.keyboard.press('Escape');
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  for (const id of ['#block-size', '#blocks', '#linkage']) await expect(page.locator(id)).toHaveCount(0);
  await expect(page.getByTestId('trap-definition')).toHaveCount(0);
});

test('changing the options restarts under the new trap, says what changed and where the stop moves, and the run is the engine’s', async ({ page }) => {
  await openTrap(page);
  await page.locator('#linkage').selectOption('loose');
  await page.locator('#blocks').fill('4');
  await expect(page.getByText('Changed: Number of blocks, Linkage, Target fitness.')).toBeVisible();
  await expect(page.locator('[data-section="setup"] .applyreset .help')).toContainText('The stop at “target fitness reached” moves to the new optimum, k × m (16).');
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Changing the number of blocks, the linkage and the target fitness restarts the run from generation 0. Nothing recorded will be lost.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#brand .s')).toHaveText('4 blocks of 4 · loose · optimum 16');
  const options: TrapOptions = { blockSize: 4, blocks: 4, linkage: 'loose' };
  const setup = { problem: entry.create(options), init: entry.defaults.init };
  const run = createRun(gaAlgorithm, { setup, params: { ...entry.defaults.params, stop: { ...entry.defaults.params.stop, targetFitness: 16 } }, seed: 42 });
  expect(await rows(page)).toEqual(run.snapshot(0).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet)));
  await page.keyboard.press('g');
  run.forwardCycle();
  expect(await rows(page)).toEqual(run.snapshot(1).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet)));
});

for (const [name, size, blocks, field, message] of [
  ['a block size of 9', '9', '5', 'block-size', 'Block size must be a whole number from 2 to 8 (it is 9).'],
  ['a block size that is not a number', 'abc', '5', 'block-size', 'Block size must be a whole number from 2 to 8 (it is not a number).'],
  ['no blocks', '4', '0', 'blocks', 'The number of blocks must be a whole number from 1 to 10 (it is 0).'],
  ['more than 30 genes', '8', '6', 'blocks', 'Block size × blocks: at most 30 genes in all (8 × 6 = 48).'],
] as const) {
  test(`${name}: the field is marked invalid and names what is wrong, and the restart is refused`, async ({ page }) => {
    await openTrap(page);
    await page.locator('#block-size').fill(size);
    await page.locator('#blocks').fill(blocks);
    await expect(page.locator(`#${field}-error`)).toHaveText(message);
    await expect(page.locator(`#${field}`)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('apply-reset')).toBeDisabled();
    await expect(page.locator('[data-section="setup"] .applyreset .help')).toContainText('Fix the highlighted fields first.');
  });
}

test('with the drawer open no control is without a name, and the three fields are labelled', async ({ page }) => {
  await openTrap(page);
  expect(await unnamed(page)).toEqual([]);
  await expect(page.getByLabel('Block size k')).toBeVisible();
  await expect(page.getByLabel('Number of blocks m')).toBeVisible();
  await expect(page.getByLabel('Linkage')).toBeVisible();
});

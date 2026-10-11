import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, type GaParams, type Initialization, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;
const base = entry.defaultOptions() as KnapsackOptions;
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const openDrawer = async (page: Page) => {
  if (await page.getByTestId('drawer').count()) return;
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.getByTestId('drawer')).toBeVisible();
};
const field = (page: Page, id: string) => page.locator(`.ctl[data-field="${id}"]`);
const engineRows = (options: KnapsackOptions, init: Initialization, generation: number, params: GaParams = entry.defaults.params, seed = entry.defaults.seed) => {
  const problem = entry.create(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init }, params, seed });
  for (let g = 0; g < generation; g++) run.forwardCycle();
  return run.snapshot(generation).state.population.map((i) => formatGenes(i.chromosome, problem.alphabet));
};

test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Knapsack/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await openDrawer(page);
});

test('the run setup has the handling, the capacity and every item with its weight and value; ρ appears only for the penalty; the other problems have none of it', async ({ page }) => {
  await expect(page.locator('#handling')).toHaveValue('decoder');
  await expect(field(page, 'handling')).toContainText('Walks the items in order and packs each one that still fits.');
  await expect(page.locator('#rho')).toHaveCount(0);
  await expect(page.locator('#capacity')).toHaveValue('48');
  await expect(field(page, 'capacity')).toContainText('at most the total weight (97)');
  for (let k = 0; k < 12; k++) {
    await expect(page.locator(`#item-weight-${k}`)).toHaveValue(String(base.items[k]!.weight));
    await expect(page.locator(`#item-value-${k}`)).toHaveValue(String(base.items[k]!.value));
    await expect(page.locator(`#item-weight-${k}`)).toHaveAccessibleName(`Item ${String.fromCharCode(65 + k)} weight`);
  }
  await expect(page.getByTestId('apply-reset')).toBeDisabled();
  await page.locator('#handling').selectOption('penalty');
  await expect(page.locator('#rho')).toHaveValue('8');
  await expect(field(page, 'handling')).toContainText('lose ρ for every unit of excess weight');
  await page.keyboard.press('Escape');
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await openDrawer(page);
  for (const id of ['#handling', '#capacity', '#rho', '#item-weight-0']) await expect(page.locator(id)).toHaveCount(0);
});

test('a bad weight, value, capacity or ρ is explained under its field, outlines the field, and blocks the restart until fixed', async ({ page }) => {
  await page.locator('#item-weight-5').fill('0');
  await expect(page.locator('#item-weight-5')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#items-error')).toHaveText('Item F: the weight must be a whole number from 1 to 99 (it is 0).');
  await expect(page.getByTestId('apply-reset')).toBeDisabled();
  await expect(page.getByText('Fix the highlighted fields first.')).toBeVisible();
  await page.locator('#item-value-1').fill('1000');
  await expect(page.locator('#items-error')).toContainText('Item B: the value must be a whole number from 1 to 999 (it is 1000).');
  await page.locator('#item-weight-5').fill('14');
  await page.locator('#item-value-1').fill('20');
  await expect(page.locator('#items-error')).toHaveCount(0);
  await expect(page.getByTestId('apply-reset')).toBeDisabled(); // nothing changed yet
  await page.locator('#capacity').fill('98');
  await expect(field(page, 'capacity').locator('.err')).toHaveText('The capacity can be at most the total weight, 97 (it is 98): a bag that holds everything is no puzzle.');
  await page.locator('#capacity').fill('abc');
  await expect(field(page, 'capacity').locator('.err')).toContainText('(it is not a number)');
  await page.locator('#capacity').fill('48');
  await page.locator('#handling').selectOption('penalty');
  await page.locator('#rho').fill('-3');
  await expect(field(page, 'rho').locator('.err')).toHaveText('The penalty ρ must be a number from 0 to 1000 (it is -3).');
  await page.locator('#rho').fill('2.5');
  await expect(field(page, 'rho').locator('.err')).toHaveCount(0);
  await expect(page.getByTestId('apply-reset')).toBeEnabled();
});

test('items can be added up to 20 and removed down to 2, each change re-checked at once', async ({ page }) => {
  await expect(page.locator('#add-item')).toBeEnabled();
  for (let k = 12; k < 20; k++) await page.locator('#add-item').click();
  await expect(page.locator('#item-weight-19')).toHaveValue('5');
  await expect(page.locator('#add-item')).toBeDisabled();
  await expect(field(page, 'capacity')).toContainText('total weight (137)');
  for (let k = 0; k < 18; k++) await page.getByRole('button', { name: /^Remove item/ }).first().click();
  await expect(page.locator('input[id^="item-weight-"]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Remove item/ }).first()).toBeDisabled();
  await expect(field(page, 'capacity').locator('.err')).toContainText('The capacity can be at most the total weight, 10 (it is 48)');
});

test('a valid change is staged until Apply and restart, the notice names what is lost, and the run is the engine’s for the new instance', async ({ page }) => {
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await openDrawer(page);
  const before = await rows(page);
  await page.locator('#item-weight-0').fill('8');
  await expect(page.getByText('Changed: Items.')).toBeVisible();
  expect(await rows(page)).toEqual(before);
  await expect(page.locator('#brand .s')).toHaveText('12 items · capacity 48 · optimum 123');
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Changing the items restarts the run from generation 0 and discards the 2 recorded generations (1–2).');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await rows(page)).toEqual(before);

  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  const options: KnapsackOptions = { ...base, items: base.items.map((item, k) => (k === 0 ? { ...item, weight: 8 } : item)) };
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  expect(await rows(page)).toEqual(engineRows(options, entry.defaults.init, 0));
  await expect(page.locator('#item-weight-0')).toHaveValue('8');
  await expect(page.getByTestId('item-row').first().locator('.itemrow > span').first()).toContainText('8');
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  expect(await rows(page)).toEqual(engineRows(options, entry.defaults.init, 2));
});

test('changing the handling restarts under the new method, and ρ with it for the penalty', async ({ page }) => {
  await page.locator('#handling').selectOption('penalty');
  await page.locator('#rho').fill('7');
  await expect(page.getByText('Changed: Constraint handling.')).toBeVisible();
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Changing the constraint handling restarts the run from generation 0. Nothing recorded will be lost.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  const options: KnapsackOptions = { ...base, handling: 'penalty', rho: 7 };
  await expect(page.locator('#brand .s')).toHaveText('12 items · capacity 48 · optimum 123');
  expect(await rows(page)).toEqual(engineRows(options, entry.defaults.init, 0));
  await expect(page.locator('#handling')).toHaveValue('penalty');
  await expect(page.locator('#rho')).toHaveValue('7');
  await expect(page.getByRole('table', { name: /^Population/ }).getByRole('columnheader').filter({ hasText: 'Penalty' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  expect(await rows(page)).toEqual(engineRows(options, entry.defaults.init, 2));
});

test('another instance moves “target fitness reached” to its optimum, and says so', async ({ page }) => {
  await expect(page.locator('#stop-target')).toHaveValue('123');
  await page.locator('#capacity').fill('40');
  await expect(page.getByText("moves to the new instance's optimum (112)")).toBeVisible();
  await expect(page.getByText('Changed: Capacity, Target fitness.')).toBeVisible();
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Changing the capacity and the target fitness restarts the run from generation 0. Nothing recorded will be lost.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.locator('#stop-target')).toHaveValue('112');
  await expect(page.locator('#brand .s')).toHaveText('12 items · capacity 40 · optimum 112');
});

test('operator settings still work beside a staged instance, and the staged instance does not leak into them', async ({ page }) => {
  await page.locator('#item-weight-0').fill('8');
  await page.locator('#mutation-probability').fill('0.1');
  await page.locator('#mutation-probability').press('Enter');
  await expect(page.getByTestId('pending-mutation-probability')).toBeVisible();
  await expect(page.locator('#item-weight-0')).toHaveValue('8');
  await expect(page.getByTestId('item-row').first().locator('.itemrow > span').first()).not.toContainText('8');
});

test('hand-edited bags: a live table with each bag’s weight and fitness, a message naming the wrong chromosome, and the run starts from them', async ({ page }) => {
  await page.locator('#init').selectOption('explicit');
  const editor = page.getByTestId('hand-population');
  await expect(editor.getByTestId('item-row')).toHaveCount(1);
  await editor.locator('textarea').fill('110000000000\n111111111111\n0101');
  const table = editor.getByRole('table', { name: 'Hand-edited population' });
  await expect(table.locator('tbody tr[data-row="1"] [data-col="bag weight"]')).toContainText('21/48 ✓');
  await expect(table.locator('tbody tr[data-row="1"] [data-col="fitness"]')).toHaveText('24');
  await expect(table.locator('tbody tr[data-row="2"] [data-col="bag weight"]')).toContainText('46/48 ✓'); // the decoder packs what fits
  await expect(table.locator('tbody tr[data-row="3"]')).toHaveClass('bad');
  await expect(field(page, 'chromosomes').locator('p.err')).toHaveText('Chromosome 3 has 4 genes, but this problem needs 12.');
  await expect(page.getByTestId('apply-reset')).toBeDisabled();
  const bags = ['110000000000', '111111111111', '000000000001'];
  await editor.locator('textarea').fill(bags.join('\n'));
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  expect(await rows(page)).toEqual(bags);
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  expect(await rows(page)).toEqual(engineRows(base, { kind: 'explicit', chromosomes: bags }, 2));
});

test('Copy link then open reproduces the run with its instance and handling', async ({ page, context }) => {
  await page.locator('#handling').selectOption('repair-lamarckian');
  await page.locator('#capacity').fill('40');
  await page.locator('#item-value-2').fill('30');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const fresh = await context.newPage();
  await fresh.goto(link);
  await expect(fresh.getByTestId('link-notice')).toHaveCount(0);
  await expect(fresh.locator('#brand .s')).toContainText('capacity 40');
  expect(await rows(fresh)).toEqual(await rows(page));
  await fresh.keyboard.press('g');
  await fresh.keyboard.press('g');
  const options: KnapsackOptions = { ...base, handling: 'repair-lamarckian', capacity: 40, items: base.items.map((item, k) => (k === 2 ? { ...item, value: 30 } : item)) };
  expect(await rows(fresh)).toEqual(engineRows(options, entry.defaults.init, 2, entry.defaults.params, entry.defaults.seed).map((r) => r));
  await openDrawer(fresh);
  await expect(fresh.locator('#handling')).toHaveValue('repair-lamarckian');
  await expect(fresh.locator('#item-value-2')).toHaveValue('30');
});

test('the drawer fits at 1366×768 in projector mode with 20 items', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await openDrawer(page);
  for (let k = 12; k < 20; k++) await page.locator('#add-item').click();
  await page.locator('#item-weight-3').fill('0');
  const drawer = (await page.getByTestId('drawer').boundingBox())!;
  for (const id of ['#item-weight-19', '#item-value-19', '#capacity']) {
    await page.locator(id).scrollIntoViewIfNeeded();
    const box = (await page.locator(id).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(drawer.x);
    expect(box.x + box.width).toBeLessThanOrEqual(drawer.x + drawer.width);
  }
  expect(await page.getByTestId('drawer').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});

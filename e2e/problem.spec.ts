import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';

const url = pathToFileURL(resolve('dist/index.html')).href;
const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const button = (page: Page) => page.getByTestId('problem-button');

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('the brand area names the running problem and opens a menu of the problems', async ({ page }) => {
  await expect(button(page)).toHaveText(/Goldberg x²/);
  await expect(button(page)).toHaveAttribute('aria-haspopup', 'menu');
  await expect(button(page)).toHaveAttribute('aria-expanded', 'false');
  await button(page).click();
  await expect(button(page)).toHaveAttribute('aria-expanded', 'true');
  const items = page.getByRole('menuitemradio');
  await expect(items).toHaveText([/Goldberg x²/, /Target string/, /Knapsack/, /Trap/]);
  await expect(items.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(items.nth(1)).toHaveAttribute('aria-checked', 'false');
  await expect(items.nth(0)).toBeFocused();
});

test('choosing a problem shows the restart notice; cancel changes nothing', async ({ page }) => {
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  const before = await rows(page);
  await button(page).click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Switching to the problem Target string restarts the run from generation 0 and discards the 2 recorded generations (1–2).');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('reset-notice')).toHaveCount(0);
  await expect(button(page)).toHaveText(/Goldberg x²/);
  expect(await rows(page)).toEqual(before);
  await expect(page.getByText('recorded gens 0–2')).toBeVisible();
});

test('switching loads the string problem’s own defaults, and the run is the engine’s', async ({ page }) => {
  await button(page).click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(button(page)).toHaveText(/Target string/);
  await expect(page.locator('#brand .s')).toHaveText('Match “HELLO” · 27 symbols');
  await expect(page.locator('#brand .logo')).toHaveText('Aa');
  await expect(page.getByTestId('seed')).toHaveText('42');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');

  const entry = entryOf('target-string')!;
  const problem = entry.create(entry.defaultOptions());
  const run = createRun(gaAlgorithm, { setup: { problem, init: entry.defaults.init }, params: entry.defaults.params, seed: entry.defaults.seed });
  expect(await rows(page)).toEqual(run.snapshot(0).state.population.map((i) => formatGenes(i.chromosome, problem.alphabet)));
  expect(await rows(page)).toHaveLength(12);

  // the table has the problem's own column: one fitness column with its note, shown as "n of 5"
  const table = page.getByRole('table', { name: /^Population · generation 0$/ });
  await expect(table.locator('thead th.num').first()).toContainText('Fitness');
  await expect(table.locator('thead th.num').first()).toContainText('= matches');
  const cells = await table.locator('tbody [data-col="fitness"]').allTextContents();
  expect(cells.every((c) => /^\d of 5$/.test(c))).toBe(true);
  await expect(table.locator('thead')).not.toContainText('x');

  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  for (let g = 0; g < 3; g++) run.forwardCycle();
  expect(await rows(page)).toEqual(run.snapshot(3).state.population.map((i) => formatGenes(i.chromosome, problem.alphabet)));
});

test('nothing of the previous problem is carried over when switching back', async ({ page }) => {
  await button(page).click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#method')).toHaveValue('tournament');
  await page.locator('#elites').fill('3');
  await page.locator('#elites').press('Enter');
  await page.keyboard.press('Escape');
  await button(page).click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(button(page)).toHaveText(/Goldberg x²/);
  await expect(page.locator('#brand .s')).toHaveText('Maximise x² on 0…31');
  expect(await rows(page)).toHaveLength(6);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#method')).toHaveValue('roulette');
  await expect(page.locator('#elites')).toHaveValue('0');
  await expect(page.getByTestId('pending-chip')).toHaveCount(0);
});

test('the presets offered are those of the running problem', async ({ page }) => {
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
  await page.keyboard.press('Escape');
  await button(page).click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Evolve a word', 'No mutation', 'Mutation too high']); // the string problem's own
});

test('a share link from the string problem opens the string problem', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await button(page).click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const fresh = await context.newPage();
  await fresh.goto(link);
  await expect(fresh.getByTestId('problem-button')).toHaveText(/Target string/);
  expect(await rows(fresh)).toEqual(await rows(page));
});

test('the menu works from the keyboard and the arrow keys in it do not step the run', async ({ page }) => {
  await button(page).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: /Goldberg/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: /Target string/ })).toBeFocused();
  await page.keyboard.press('ArrowRight'); // would step the run if it reached the shortcuts
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitemradio', { name: /Goldberg/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(button(page)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reset-notice')).toContainText('Switching to the problem Target string');
});

test('the menu fits the brand area at 1366×768 in projector mode', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await button(page).click();
  const menu = (await page.getByTestId('problem-list').boundingBox())!;
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(1366);
  expect(menu.y + menu.height).toBeLessThanOrEqual(768);
});

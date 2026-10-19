import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { GaParams, LandscapeOptions, NichingConfig } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, decodeConfig, encodeConfig } from '../src/ui/run-config';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const options: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };

const open = async (page: Page, niching?: NichingConfig, extra: Partial<GaParams> = {}) => {
  const d = defaultsOf(entry, options);
  const params: GaParams = { ...d.params, ...extra, ...(niching ? { niching } : {}) };
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, params, 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.getByTestId('drawer')).toBeVisible();
};
const method = (page: Page) => page.locator('#niching-method');
const chip = (page: Page) => page.getByTestId('pending-chip');
/** The niching of the run as the share link carries it (what the run will use once pending changes apply). */
const linked = async (page: Page) => {
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toHaveText('Link copied.');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const decoded = decodeConfig(link.slice(link.indexOf('#')));
  expect(decoded.ok).toBe(true);
  return decoded.ok ? decoded.config.params.niching : undefined;
};

test('the landscape\'s drawer has a Niching section: none by default, with the three methods', async ({ page }) => {
  await open(page);
  const section = page.locator('[data-section="niching"]');
  await expect(section).toBeVisible();
  await expect(section.getByRole('heading', { name: /^Niching/ })).toBeVisible();
  await expect(method(page)).toHaveValue('none');
  expect(await method(page).locator('option').allInnerTexts()).toEqual(['None', 'Fitness sharing', 'Deterministic crowding']);
  await expect(page.locator('#niching-sigma')).toHaveCount(0);
  await expect(page.locator('#niching-method-help')).toContainText('broad low hill');
  expect(await linked(page)).toBeUndefined();
});

test('the other problems have no Niching section', async ({ page }) => {
  for (const id of ['goldberg', 'tsp', 'knapsack', 'trap', 'target-string']) {
    const e = entryOf(id)!;
    const d = defaultsOf(e, e.defaultOptions());
    await page.goto('about:blank');
    await page.goto(url + encodeConfig(configOf({ problem: e.create(e.defaultOptions()), init: d.init }, d.params, 7, id, e.defaultOptions())));
    await page.getByRole('button', { name: /Parameters/ }).click();
    await expect(page.getByTestId('drawer'), id).toBeVisible();
    await expect(page.locator('[data-section="niching"]'), id).toHaveCount(0);
  }
});

test('choosing fitness sharing shows its radius and shape with their defaults and the tip, marks the change pending, and applies it at the next generation', async ({ page }) => {
  await open(page);
  await method(page).selectOption('sharing');
  await expect(page.locator('#niching-sigma')).toHaveValue('2');
  await expect(page.locator('#niching-alpha')).toHaveValue('1');
  await expect(page.getByTestId('niching-tip')).toContainText('roulette-wheel selection and a population of 30 or more');
  await expect(chip(page)).toContainText('Niching');
  await expect(page.getByTestId('pending-niching-method')).toBeVisible();
  expect(await linked(page)).toEqual({ method: 'sharing', sigma: 2, alpha: 1 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await expect(chip(page)).toHaveCount(0);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(method(page)).toHaveValue('sharing');
  await expect(page.getByTestId('pending-niching-method')).toHaveCount(0);
});

test('the radius and the shape can be changed while sharing, each pending on its own, and a bad one is said in words and applies nothing', async ({ page }) => {
  await open(page, { method: 'sharing', sigma: 2, alpha: 1 });
  await page.locator('#niching-sigma').fill('3.5');
  await page.locator('#niching-sigma').blur();
  await expect(page.getByTestId('pending-niching-sigma')).toContainText('2 → 3.5');
  await expect(chip(page)).toContainText('Sharing σ');
  expect(await linked(page)).toEqual({ method: 'sharing', sigma: 3.5, alpha: 1 });
  await page.locator('#niching-alpha').fill('2');
  await page.locator('#niching-alpha').blur();
  await expect(page.getByTestId('pending-niching-alpha')).toContainText('1 → 2');
  await page.locator('#niching-sigma').fill('0');
  await page.locator('#niching-sigma').blur();
  await expect(page.locator('#niching-sigma-error')).toHaveText('σ (the niche radius) must be a number greater than 0.');
  // the bad entry applied nothing: the run still carries the last good radius
  expect((await linked(page))?.sigma).toBe(3.5);
  await page.locator('#niching-alpha').fill('x');
  await page.locator('#niching-alpha').blur();
  await expect(page.locator('#niching-alpha-error')).toHaveText('α (the shape of the sharing kernel) must be a number greater than 0.');
});

test('choosing deterministic crowding says what it replaces and switches off: the selection method, elites and offspring truncation are not offered; choosing none brings them back', async ({ page }) => {
  await open(page);
  await expect(page.locator('#method')).toBeVisible();
  await expect(page.locator('#elites')).toBeVisible();
  await method(page).selectOption('crowding');
  await expect(page.locator('#niching-sigma')).toHaveCount(0);
  await expect(page.getByTestId('selection-crowding-note')).toContainText('every individual as a parent exactly once');
  await expect(page.getByTestId('replacement-crowding-note')).toContainText('elites and offspring truncation do not apply');
  await expect(page.locator('#method')).toHaveCount(0);
  await expect(page.locator('#elites')).toHaveCount(0);
  await expect(page.locator('#truncation-on')).toHaveCount(0);
  await expect(page.locator('#niching-method-help')).toContainText('replaces it only if strictly better');
  expect(await linked(page)).toEqual({ method: 'crowding', sigma: 2, alpha: 1 });
  await method(page).selectOption('none');
  await expect(page.locator('#method')).toBeVisible();
  await expect(page.locator('#elites')).toBeVisible();
  await expect(page.getByTestId('selection-crowding-note')).toHaveCount(0);
  expect(await linked(page)).toBeUndefined();
});

test('a radius and a shape set while sharing are remembered through crowding and none, and come back', async ({ page }) => {
  await open(page, { method: 'sharing', sigma: 4, alpha: 2 });
  await method(page).selectOption('crowding');
  await method(page).selectOption('none');
  expect(await linked(page)).toEqual({ method: 'none', sigma: 4, alpha: 2 });
  await method(page).selectOption('sharing');
  await expect(page.locator('#niching-sigma')).toHaveValue('4');
  await expect(page.locator('#niching-alpha')).toHaveValue('2');
});

test('a link with niching opens with it in the drawer and in the run, and Apply and restart keeps it', async ({ page }) => {
  await open(page, { method: 'crowding', sigma: 2, alpha: 1 });
  await expect(method(page)).toHaveValue('crowding');
  expect(await linked(page)).toEqual({ method: 'crowding', sigma: 2, alpha: 1 });
  // a setup change restarts the run with the drawer's parameters, niching among them
  await page.locator('#seed').fill('9');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  if (!(await page.getByTestId('drawer').isVisible())) await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(method(page)).toHaveValue('crowding');
  expect(await linked(page)).toEqual({ method: 'crowding', sigma: 2, alpha: 1 });
});

test('the controls are named and reachable by keyboard: the method is a labelled select, the radius and the shape labelled fields', async ({ page }) => {
  await open(page, { method: 'sharing', sigma: 2, alpha: 1 });
  await expect(page.getByLabel('Niching', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Niche radius σ')).toBeVisible();
  await expect(page.getByLabel('Shape α')).toBeVisible();
  await method(page).focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('niching-sigma');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('niching-alpha');
  const tree = await page.locator('[data-section="niching"]').ariaSnapshot();
  expect(tree.split('\n').filter((l) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio)(\s+\[[^\]]*\])*:?\s*$/.test(l))).toEqual([]);
});

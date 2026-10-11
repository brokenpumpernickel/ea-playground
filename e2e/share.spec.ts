import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatBits, gaAlgorithm } from '../src/engine';
import { createRun } from '../src/run';
import { defaultParams, defaultSeed, defaultSetup } from '../src/ui/config';
import { configOf, decodeConfig, encodeConfig, setupOf } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const openDrawer = async (page: Page) => {
  if (await page.getByTestId('drawer').count()) return;
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.getByTestId('drawer')).toBeVisible();
};
const setText = async (page: Page, id: string, value: string) => {
  await page.locator(`#${id}`).fill(value);
  await page.locator(`#${id}`).press('Enter');
};
const generations = async (page: Page, n: number) => {
  for (let k = 0; k < n; k++) await page.keyboard.press('g');
};
const copyLink = async (page: Page) => {
  await openDrawer(page);
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
};
const engineRows = (config: NonNullable<ReturnType<typeof decodeConfig> & { ok: true }>['config'], n: number) => {
  const run = createRun(gaAlgorithm, { setup: setupOf(config), params: config.params, seed: config.seed });
  for (let g = 0; g < n; g++) run.forwardCycle();
  return run.snapshot(n).state.population.map((i) => formatBits(i.chromosome));
};

test('a copied link opens the same paused run at generation 0 in a fresh page, and the run that follows is the engine’s', async ({ page, context }) => {
  await page.goto(url);
  // a hand-edited population and a new seed (restart), then an operator change that is still pending
  await openDrawer(page);
  await page.locator('#init').selectOption('explicit');
  await page.locator('#chromosomes').fill('01101\n11000\n01000\n10011');
  await setText(page, 'seed', '7');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await setText(page, 'crossover-probability', '0.5');
  await expect(page.getByTestId('pending-chip')).toBeVisible();

  const link = await copyLink(page);
  expect(link.startsWith(url + '#v1.')).toBe(true);
  const decoded = decodeConfig(link.slice(link.indexOf('#')));
  if (!decoded.ok) throw new Error(decoded.problems.join(' '));
  expect(decoded.config.seed).toBe(7);
  expect(decoded.config.params.crossover.probability).toBe(0.5); // the pending change is in the link
  expect(decoded.config.setup.init).toEqual({ kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] });

  const fresh = await context.newPage();
  await fresh.goto(link);
  await expect(fresh.getByTestId('seed')).toHaveText('7');
  await expect(fresh.locator('#pop-heading')).toHaveText('Population · generation 0');
  expect(await rows(fresh)).toEqual(['01101', '11000', '01000', '10011']);
  await expect(fresh.getByRole('status')).not.toContainText('Playing');
  await expect(fresh.getByTestId('link-notice')).toHaveCount(0);
  await expect(fresh.getByTestId('pending-chip')).toHaveCount(0); // the change is a setting now, not pending
  await openDrawer(fresh);
  await expect(fresh.locator('#crossover-probability')).toHaveValue('0.5');
  await fresh.keyboard.press('Escape');
  await generations(fresh, 3);
  expect(await rows(fresh)).toEqual(engineRows(decoded.config, 3));
});

test('the address is cleared after a link loads, so a reload does not silently reset the run', async ({ page }) => {
  await page.goto(url + encodeConfig(configOf({ ...defaultSetup, init: { kind: 'random', size: 4 } }, defaultParams, 99)));
  await expect(page.getByTestId('seed')).toHaveText('99');
  expect(page.url()).toBe(url);
  await page.reload();
  await expect(page.getByTestId('seed')).toHaveText('42');
});

test('an unrelated hash is left alone', async ({ page }) => {
  await page.goto(url + '#intro');
  await expect(page.getByTestId('link-notice')).toHaveCount(0);
  expect(page.url()).toBe(url + '#intro');
  await expect(page.getByTestId('seed')).toHaveText('42');
});

const good = configOf(defaultSetup, defaultParams, defaultSeed);
const bad = (change: (c: Record<string, any>) => void) => {
  const c = JSON.parse(JSON.stringify(good)) as Record<string, any>;
  change(c);
  return `#v1.${Buffer.from(JSON.stringify(c)).toString('base64url')}`;
};

for (const [name, hash, words] of [
  ['empty after the version', '#v1.', 'empty'],
  ['a newer version', '#v2.abc', 'different version'],
  ['not base64url', '#v1.@@@', 'cannot be part of a share link'],
  ['not JSON', '#v1.' + Buffer.from('nope').toString('base64url'), 'cut short or damaged'],
  ['truncated', encodeConfig(good).slice(0, 50), 'cut short or damaged'],
  ['an unknown problem', bad((c) => (c.problem = 'tsp')), 'Unknown problem "tsp"'],
  ['an unknown key', bad((c) => (c.extra = 1)), 'unknown key "extra"'],
  ['a value the drawer would refuse', bad((c) => (c.params.crossover.probability = 1.5)), 'crossover probability must be a number from 0 to 1'],
  ['a wrong type', bad((c) => (c.params.elites = 'two')), '"params.elites" must be a number'],
] as const) {
  test(`a bad link (${name}) opens the default configuration with a readable message, never starts playing, and clears the address`, async ({ page }) => {
    await page.goto(url + hash);
    const notice = page.getByTestId('link-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'alert');
    await expect(notice).toContainText('default configuration is open instead');
    await expect(notice).toContainText(words);
    await expect(page.getByTestId('seed')).toHaveText('42');
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
    const defaults = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: defaultSeed }).snapshot(0).state.population.map((i) => formatBits(i.chromosome));
    expect(await rows(page)).toEqual(defaults);
    await expect(page.getByRole('status')).not.toContainText('Playing');
    expect(page.url()).toBe(url);
    await page.waitForTimeout(1500);
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
    await notice.getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice).toHaveCount(0);
  });
}

test('every problem in a link with several is listed, and nothing from the good parts is used', async ({ page }) => {
  await page.goto(
    url +
      bad((c) => {
        c.seed = 7;
        c.params.crossover.probability = '0.8';
        c.params.stop.speed = 3;
      }),
  );
  const items = await page.getByTestId('link-notice').locator('li').allTextContents();
  expect(items).toHaveLength(2);
  await expect(page.getByTestId('seed')).toHaveText('42'); // the valid seed in the same link was not applied
});

test('when the clipboard cannot be written the link is shown to be copied by hand', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } });
  });
  await page.goto(url);
  await openDrawer(page);
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toContainText('could not be copied automatically');
  const field = page.getByTestId('share-field');
  await expect(field).toBeVisible();
  const text = await field.inputValue();
  expect(text.startsWith(url + '#v1.')).toBe(true);
  expect(decodeConfig(text.slice(text.indexOf('#'))).ok).toBe(true);
});

test('a very long link (a large hand-edited population) is warned about', async ({ page }) => {
  await page.goto(url);
  await openDrawer(page);
  await page.locator('#init').selectOption('explicit');
  await page.locator('#chromosomes').fill(Array.from({ length: 220 }, (_, k) => (k % 32).toString(2).padStart(5, '0')).join('\n'));
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-long')).toContainText('characters long');
  await expect(page.getByTestId('share-status')).toBeVisible();
});

test('a short link has no warning, and on file:// the link says it only opens on this computer', async ({ page }) => {
  await page.goto(url);
  await openDrawer(page);
  await expect(page.getByTestId('share-file')).toContainText('only opens on this computer');
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-long')).toHaveCount(0);
});

test('works with browser storage blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await page.goto(url);
  await openDrawer(page);
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
});

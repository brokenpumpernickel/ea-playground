import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { GaParams, LandscapeOptions, NichingConfig } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

/** The accessibility pass for milestone 9: names, headers and sentences for the new views, the keyboard alone, colour is never the only carrier, reduced motion. */
const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const options: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };
const sharing: NichingConfig = { method: 'sharing', sigma: 2, alpha: 1 };
const crowding: NichingConfig = { method: 'crowding', sigma: 2, alpha: 1 };
const roulette: GaParams['selection'] = { method: 'roulette', chain: [{ step: 'identity' }] };
const tournament: GaParams['selection'] = { method: 'tournament', size: 2 };

const open = async (page: Page, niching: NichingConfig, selection: GaParams['selection'], projector = false, size = 12) => {
  await page.goto('about:blank');
  const params: GaParams = { ...defaultsOf(entry, options).params, selection, niching };
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size } }, params, 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};
/** Forward by micro-steps (the arrow key) into `stage` and through its first micro-step. */
const toStage = async (page: Page, stage: string) => {
  for (let k = 0; k < 400; k++) {
    if ((await page.getByTestId('stage-panel').locator('h2').first().innerText()).includes(stage)) {
      await page.keyboard.press('ArrowRight');
      return;
    }
    await page.keyboard.press('ArrowRight');
  }
  throw new Error(`never reached ${stage}`);
};

test('the weights table with sharing names its columns, the tournament table and the duel table have row and column headers, and the draws are a named list', async ({ page }) => {
  await open(page, sharing, roulette);
  await page.keyboard.press('ArrowRight');
  const weights = page.getByRole('table', { name: 'Selection weights and probabilities' });
  await expect(weights.getByRole('columnheader', { name: 'Niche count' })).toBeVisible();
  await expect(weights.getByRole('columnheader', { name: 'Shared' })).toBeVisible();

  await open(page, sharing, tournament);
  await page.keyboard.press('ArrowRight');
  const shares = page.getByRole('table', { name: 'Fitness, niche count and shared weight of every individual' });
  await expect(shares.getByRole('columnheader')).toHaveText(['Ind.', 'Fitness', 'Niche count', 'Shared']);
  expect(await shares.locator('tbody tr').count()).toBe(12);
  for (const row of await shares.locator('tbody tr').all()) await expect(row.getByRole('rowheader')).toHaveCount(1);

  await open(page, crowding, tournament);
  await page.keyboard.press('ArrowRight');
  const draws = page.getByRole('list', { name: 'Draws' });
  await expect(draws.getByRole('listitem')).toHaveCount(12);
  for (const item of await draws.getByRole('listitem').all()) expect((await item.innerText()).trim().length).toBeGreaterThan(5);
  await expect(draws.locator('[aria-current="true"]')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(draws.locator('[aria-current="true"]')).toHaveCount(1);

  await toStage(page, 'Replacement');
  const duels = page.getByRole('table', { name: 'Duels, by pair' });
  await expect(duels.locator('thead').getByRole('columnheader')).toHaveText(['Child', 'against', 'distance', 'fitness', 'result']);
  expect(await duels.getByRole('rowheader').count()).toBe(12);
  for (const row of await duels.locator('tr[data-child]').all()) await expect(row.getByRole('rowheader')).toHaveCount(1);
  expect(await unnamed(page)).toEqual([]);
});

test('the ring is decoration with a sentence of its own, and the peak readout has a sentence and a table for the screen reader', async ({ page }) => {
  await open(page, sharing, roulette);
  await page.getByTestId('show-landscape').click();
  await page.getByTestId('heat-marks').locator('[data-marker="individual"] .body').first().dispatchEvent('click');
  await expect(page.getByTestId('niche-layer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByTestId('ring-sentence')).toBeVisible();
  const sentence = await page.getByTestId('ring-sentence').innerText();
  expect(sentence).toMatch(/radius of the niche, σ = 2/);
  await expect(page.getByTestId('peak-sentence')).toHaveText(/^Within 1\.5 of a peak: broad hill \d+, narrow hill \d+; elsewhere \d+ of 12\.$/);
  const table = page.getByRole('table', { name: 'Individuals near each peak' });
  await expect(table.getByRole('columnheader')).toHaveText(['Peak', 'x', 'y', 'Individuals within 1.5']);
  await expect(table.getByRole('rowheader')).toHaveText(['broad hill', 'narrow hill']);
});

test('with the keyboard alone: a sharing generation stage by stage, an individual selected by the arrow keys with its ring, cleared by Escape; a crowding generation to its duels', async ({ page }) => {
  await open(page, sharing, roulette);
  for (let k = 0; k < 6; k++) await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#pop-heading')).toContainText('generation 1');
  await page.getByTestId('show-landscape').click();
  const marks = page.getByTestId('heat-marks');
  await marks.focus();
  await expect(page.getByTestId('niche-ring')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('niche-ring')).toHaveCount(1);
  await expect(page.getByTestId('niche-label')).toHaveText('σ = 2');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('niche-ring')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('niche-ring')).toHaveCount(0);

  await open(page, crowding, tournament);
  for (let k = 0; k < 6; k++) await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#pop-heading')).toContainText('generation 1');
  await expect(page.getByTestId('duels')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('duels')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('duels')).toBeVisible();
});

test('colour is never the only carrier: duel results are words and marks, kept places are labelled, the ring is dashed and labelled with its radius', async ({ page }) => {
  await open(page, crowding, tournament);
  await page.keyboard.press('ArrowRight');
  await toStage(page, 'Replacement');
  const rows = page.locator('[data-testid="duels"] tr[data-child]');
  const winners: Record<string, number> = {};
  for (const row of await rows.all()) {
    const text = await row.locator('td.res').innerText();
    const winner = (await row.getAttribute('data-winner'))!;
    winners[winner] = (winners[winner] ?? 0) + 1;
    expect(text).toContain(winner === 'child' ? 'child wins' : 'stays');
    expect(text).toContain('✓');
    expect(text).toContain('✕');
  }
  expect(Object.values(winners).reduce((a, b) => a + b, 0)).toBe(12);
  // an individual that kept its place says so in words
  if (winners.parent) await expect(page.locator('.rcol[aria-label="Next population"]').getByText(/kept #\d+/).first()).toBeVisible();

  await open(page, sharing, roulette);
  await page.getByTestId('show-landscape').click();
  await page.getByTestId('heat-marks').locator('[data-marker="individual"] .body').first().dispatchEvent('click');
  expect(await page.getByTestId('niche-ring').evaluate((e) => getComputedStyle(e).strokeDasharray)).not.toBe('none');
  await expect(page.getByTestId('niche-label')).toBeVisible();
});

test('with reduced motion nothing in the niching views animates or transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const durations = () => page.evaluate(() => [...document.querySelectorAll('.crowdsel *, .duels *, .duelcol *, .sharetable *, .roulette *, .ringlayer *, .lview *, tr, button')].map((el) => getComputedStyle(el)).map((s) => `${s.transitionDuration}|${s.animationName}`));
  await open(page, crowding, tournament);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const draws = await durations();
  await toStage(page, 'Replacement');
  const duels = await durations();
  await open(page, sharing, roulette);
  await page.keyboard.press('ArrowRight');
  await page.getByTestId('show-landscape').click();
  await page.getByTestId('heat-marks').locator('[data-marker="individual"] .body').first().dispatchEvent('click');
  const ring = await durations();
  for (const [name, list] of [['draws', draws], ['duels', duels], ['ring', ring]] as const) {
    expect(list.length, name).toBeGreaterThan(30);
    expect(list.every((d) => /^0s(, 0s)*\|none$/.test(d)), name).toBe(true);
  }
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

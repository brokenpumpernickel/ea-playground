import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, handlings, itemName, type GaParams, type Handling, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;

const setupOf = (handling: Handling, params: GaParams = entry.defaults.params, seed = 42) => {
  const options = { ...(entry.defaultOptions() as KnapsackOptions), handling };
  const problem = entry.create(options) as ReturnType<typeof entry.create> & {
    outcomeOf(c: readonly number[]): { packed: boolean[]; weight: number; excess: number };
  };
  return { options, problem, setup: { problem, init: entry.defaults.init }, params, seed };
};
const open = async (page: Page, s: ReturnType<typeof setupOf>, projector = false) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf(s.setup, s.params, s.seed, 'knapsack', s.options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Knapsack/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const SCALE = 72;
/** A seed whose first generation has an overweight offspring under the penalty, found by running the engine (the default seed need not have one). */
const repairSeed = () => {
  for (let seed = 1; seed < 200; seed++) {
    const s = setupOf('repair-lamarckian', undefined, seed);
    const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed });
    run.forwardCycle();
    if (run.events(1).some((e) => e.stage === 'evaluation' && e.repairedFrom)) return seed;
  }
  throw new Error('no seed found');
};
const overweightSeed = () => {
  for (let seed = 1; seed < 200; seed++) {
    const s = setupOf('penalty', undefined, seed);
    const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed });
    run.forwardCycle();
    const initial = run.snapshot(0).state.population.some((i) => s.problem.outcomeOf(i.chromosome).excess > 0);
    const offspring = run.events(1).some((e) => e.stage === 'evaluation' && s.problem.outcomeOf(e.individual.chromosome).excess > 0);
    if (initial && offspring) return seed;
  }
  throw new Error('no seed found');
};

for (const handling of handlings) {
  test(`${handling}: every bar in the table is the engine’s weight against the capacity, filled and hatched in proportion`, async ({ page }) => {
    const s = setupOf(handling);
    await open(page, s);
    const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed: s.seed });
    let over = 0;
    for (let g = 0; g <= 3; g++) {
      if (g > 0) {
        await page.keyboard.press('g');
        run.forwardCycle();
      }
      const bars = await page.getByRole('table', { name: /^Population · generation \d+$/ }).locator('tbody tr .capbar').evaluateAll((els) =>
        els.map((el) => ({ value: Number(el.getAttribute('data-value')), limit: Number(el.getAttribute('data-limit')), fill: Number(el.getAttribute('data-fill')), over: Number(el.getAttribute('data-over')) })),
      );
      const population = run.snapshot(g).state.population;
      expect(bars).toHaveLength(population.length);
      population.forEach((individual, k) => {
        const outcome = s.problem.outcomeOf(individual.chromosome);
        expect(bars[k]!.value).toBe(outcome.weight);
        expect(bars[k]!.limit).toBe(48);
        expect(bars[k]!.fill).toBeCloseTo((Math.min(outcome.weight, 48) / SCALE) * 100, 6);
        expect(bars[k]!.over).toBeCloseTo((Math.max(0, Math.min(outcome.weight, SCALE) - 48) / SCALE) * 100, 6);
        if (outcome.excess > 0) over++;
      });
    }
    if (handling === 'penalty') expect(over).toBeGreaterThan(0);
    else expect(over).toBe(0);
  });
}

test('Lamarckian repair: the ✂ marks are exactly the genes repair rewrote, and the bar below shows the repaired bag and what it was repaired from', async ({ page }) => {
  const s = setupOf('repair-lamarckian', undefined, 42);
  await open(page, s);
  const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed: 42 });
  for (let g = 0; g < 3; g++) run.forwardCycle();
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  const events = run.events(3).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
  let repaired = 0;
  for (const [k, e] of events.entries()) {
    await page.keyboard.press('ArrowRight');
    const row = page.locator(`tr[data-offspring="${e.offspring}"]`);
    await expect(row).toHaveAttribute('data-state', 'revealed');
    const expected = (e.repairedFrom ?? []).flatMap((g, i) => (g !== e.individual.chromosome[i] ? [i + 1] : []));
    const marked = await row.locator('.bit.cut').evaluateAll((els) => els.map((el) => [...el.parentElement!.children].indexOf(el) + 1));
    expect(marked).toEqual(expected);
    if (expected.length > 0) {
      repaired++;
      await expect(row.locator('[data-bits]')).toHaveAttribute('data-dropped', expected.join(','));
    } else await expect(row.locator('[data-bits]')).not.toHaveAttribute('data-dropped', /./);
    // the bar under the table is for the offspring just scored
    const bar = page.getByTestId('bag-bar');
    await expect(bar).toContainText(`Offspring ${e.offspring}`);
    const outcome = s.problem.outcomeOf(e.individual.chromosome);
    await expect(bar).toHaveAttribute('data-weight', String(outcome.weight));
    const letters = await bar.locator('.seg').evaluateAll((els) => els.map((el) => el.getAttribute('data-item')));
    expect(letters).toEqual(outcome.packed.flatMap((p, i) => (p ? [itemName(i)] : [])));
    if (e.repairedFrom) await expect(bar).toContainText(`repaired from ${s.problem.outcomeOf(e.repairedFrom).weight}`);
    else await expect(bar).not.toContainText('repaired from');
    if (k > 7) break;
  }
  expect(repaired).toBeGreaterThan(0);
});

test('penalty: the bar of the offspring being scored hatches what is over the capacity, and says how much', async ({ page }) => {
  const seed = overweightSeed();
  const s = setupOf('penalty', undefined, seed);
  await open(page, s);
  const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed });
  run.forwardCycle();
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  const events = run.events(1).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
  let sawOver = false;
  for (const e of events) {
    await page.keyboard.press('ArrowRight');
    const outcome = s.problem.outcomeOf(e.individual.chromosome);
    const bar = page.getByTestId('bag-bar');
    await expect(bar).toContainText(`Offspring ${e.offspring}`);
    await expect(bar).toHaveAttribute('data-excess', String(outcome.excess));
    const hatched = await bar.locator('.seg.ov').count();
    expect(hatched > 0).toBe(outcome.excess > 0);
    if (outcome.excess > 0) {
      sawOver = true;
      await expect(bar).toContainText(`${outcome.excess} over (hatched)`);
    } else await expect(bar).not.toContainText('over (hatched)');
  }
  expect(sawOver).toBe(true);
});

test('nothing here depends on colour alone: the excess is hatched, a skipped gene is dashed, a repaired gene is dotted with ✂, and the numbers are in the text', async ({ page }) => {
  await open(page, setupOf('penalty', undefined, overweightSeed()));
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  const hatch = await page.locator('.capbar .over').first().evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(hatch).toContain('repeating-linear-gradient');
  await expect(page.getByRole('table', { name: /^Population/ }).locator('tbody tr').first().locator('[data-col="bag weight"]')).toHaveText(/^\d+\/48 (✓|✗ \+\d+)$/);
  await open(page, setupOf('decoder'));
  for (let g = 0; g < 3; g++) await page.keyboard.press('g');
  const skip = await page.locator('.bit.skip').first().evaluate((el) => ({ style: getComputedStyle(el).borderTopStyle, text: el.textContent }));
  expect(skip).toEqual({ style: 'dashed', text: '✕' });
  await open(page, setupOf('repair-lamarckian', undefined, repairSeed()));
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 8; k++) await page.keyboard.press('ArrowRight'); // every offspring scored
  const cut = await page.locator('.bit.cut').first().evaluate((el) => ({ style: getComputedStyle(el).borderTopStyle, mark: getComputedStyle(el, '::after').content }));
  expect(cut.style).toBe('dotted');
  expect(cut.mark).toContain('✂');
});

for (const projector of [false, true]) {
  for (const handling of ['decoder', 'penalty'] as const) {
    test(`${handling}${projector ? ' in projector mode' : ''}: the population table never scrolls sideways, with tournament or roulette selection`, async ({ page }) => {
      for (const selection of [entry.defaults.params.selection, { method: 'roulette' as const, chain: [{ step: 'shift' as const }] }]) {
        await open(page, setupOf(handling, { ...entry.defaults.params, selection }), projector);
        for (let g = 0; g < 2; g++) await page.keyboard.press('g');
        await page.keyboard.press('ArrowRight'); // into the next generation, where selection results show
        const [scroll, client] = await page.locator('.tablewrap').first().evaluate((el) => [el.scrollWidth, el.clientWidth]);
        expect(scroll).toBeLessThanOrEqual(client);
      }
    });
  }
}

test('the other problems have no capacity bars', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('.capbar')).toHaveCount(0);
  await expect(page.getByTestId('bag-bar')).toHaveCount(0);
});

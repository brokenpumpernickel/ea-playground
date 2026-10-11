import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, handlings, itemName, type GaParams, type Handling, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;
const base = entry.defaultOptions() as KnapsackOptions;

const setupOf = (handling: Handling, o: { items?: number; params?: GaParams; seed?: number } = {}) => {
  const items = Array.from({ length: o.items ?? 12 }, (_, k) => base.items[k % 12]!);
  const total = items.reduce((t, i) => t + i.weight, 0);
  const options: KnapsackOptions = { ...base, handling, items, capacity: o.items && o.items !== 12 ? Math.floor(total / 2) : base.capacity };
  const problem = entry.create(options);
  return { options, problem, setup: { problem, init: entry.defaults.init }, params: o.params ?? entry.defaults.params, seed: o.seed ?? 42 };
};
const open = async (page: Page, s: ReturnType<typeof setupOf>) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf(s.setup, s.params, s.seed, 'knapsack', s.options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Knapsack/);
};
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};

test('every chromosome in the table is named by its bag: the items in it, its weight against the capacity, and what is not in it although the gene is 1', async ({ page }) => {
  const s = setupOf('decoder');
  await open(page, s);
  const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed: s.seed });
  for (let g = 0; g < 3; g++) {
    await page.keyboard.press('g');
    run.forwardCycle();
  }
  const labels = await page.getByRole('table', { name: /^Population · generation 3$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => [el.getAttribute('role'), el.getAttribute('aria-label')]));
  const expected = run.snapshot(3).state.population.map((i) => {
    const o = (s.problem as typeof s.problem & { outcomeOf(c: readonly number[]): { packed: boolean[]; weight: number } }).outcomeOf(i.chromosome);
    const letters = o.packed.flatMap((p, k) => (p ? [itemName(k)] : []));
    const skipped = i.chromosome.flatMap((g, k) => (g === 1 && !o.packed[k] ? [itemName(k)] : []));
    return `Chromosome ${formatGenes(i.chromosome, s.problem.alphabet)}, ${letters.length ? `bag: ${letters.join(', ')}` : 'nothing in the bag'}, weight ${o.weight} of 48${skipped.length ? `, not in the bag although the gene is 1: ${skipped.join(', ')}` : ''}`;
  });
  expect(labels.map((l) => l[0])).toEqual(Array(8).fill('img'));
  expect(labels.map((l) => l[1])).toEqual(expected);
  expect(expected.some((l) => l.includes('not in the bag although'))).toBe(true); // a skipped gene is named too
});

test('the tables are real tables with named columns, for every method, and the items are named in one sentence', async ({ page }) => {
  for (const handling of handlings) {
    await open(page, setupOf(handling));
    const table = page.getByRole('table', { name: /^Population · generation 0$/ });
    await expect(table.getByRole('columnheader')).toContainText(handling === 'penalty' ? ['#', 'Chromosome', 'Bag weight', 'Value', 'Penalty', 'Fitness'] : ['#', 'Chromosome', 'Bag weight', 'Value', 'Fitness']);
    await expect(table.getByTestId('item-row')).toHaveAttribute('aria-label', /^Items: A weighs 9 and is worth 4;/);
    await expect(table.getByRole('row')).toHaveCount(9);
  }
});

test('a full generation can be stepped through with the keyboard alone, starting from the problem menu', async ({ page }) => {
  await page.goto(url);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('problem-button')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: /Knapsack/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reset-notice')).toBeVisible();
  await page.keyboard.press('Tab');
  while (!(await page.getByRole('button', { name: 'Restart and apply' }).evaluate((el) => el === document.activeElement))) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('problem-button')).toHaveText(/Knapsack/);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowRight');
  for (const stage of ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation']) {
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.getByTestId('ribbon').locator('li[aria-current="step"]')).toContainText(stage);
  }
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  await expect(page.getByTestId('ribbon').locator('li.done')).toHaveCount(6);
});

test('the problem menu and the drawer, open, leave no control without a name, and the item fields are named', async ({ page }) => {
  await open(page, setupOf('penalty'));
  expect(await unnamed(page)).toEqual([]);
  await page.getByTestId('problem-button').click();
  await expect(page.getByRole('menuitemradio', { name: /Knapsack/ })).toHaveAttribute('aria-checked', 'true');
  expect(await unnamed(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Parameters/ }).click();
  expect(await unnamed(page)).toEqual([]);
  await page.locator('#init').selectOption('explicit');
  await page.locator('#item-weight-3').fill('0');
  expect(await unnamed(page)).toEqual([]);
  await expect(page.getByRole('textbox', { name: 'Item D weight' })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Remove item D' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add item' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Constraint handling' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Penalty ρ' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Capacity' })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Items/ })).toBeVisible();
});

test('every meaning that has a colour has something else as well: feasible and over (text and hatch), not in the bag (✕, dashed), repaired (✂, dotted), the feasible line (◇, dotted), and the figures under the bars', async ({ page }) => {
  // the penalty: ✓ or ✗ with the amount in the text, and the excess hatched
  const penalty = setupOf('penalty', { seed: 35, params: { ...entry.defaults.params } });
  penalty.options = { ...penalty.options, rho: 1 } as KnapsackOptions;
  penalty.setup = { problem: entry.create(penalty.options), init: penalty.setup.init };
  await open(page, penalty);
  for (let g = 0; g < 30; g++) await page.keyboard.press('g');
  const weights = await page.getByRole('table', { name: /^Population/ }).locator('tbody tr [data-col="bag weight"]').allTextContents();
  expect(weights.some((w) => /✗ \+\d+/.test(w))).toBe(true);
  expect(await page.locator('.capbar .over').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('repeating-linear-gradient');
  const diamond = await page.locator('[data-series="feasibleBestSoFar"][data-gen]').first().evaluate((el) => ({ tag: el.tagName, d: el.getAttribute('d') }));
  expect(diamond.tag).toBe('path');
  expect(diamond.d).toContain('l7,8 l-7,8 l-7,-8'); // a diamond, not a circle or square
  expect(await page.locator('path[data-series="feasibleBestSoFar"]:not([data-gen])').first().evaluate((el) => el.getAttribute('stroke-dasharray'))).toBe('2 4');
  // the figures under the bars of "Chosen per item"
  const bars = await page.locator('.matchbar.chosen .gene').evaluateAll((els) => els.map((el) => [el.querySelector('b')!.textContent, el.querySelector('span')!.textContent]));
  expect(bars.map((b) => b[1]).join('')).toBe('ABCDEFGHIJKL');
  expect(bars.every((b) => /^\d+%$/.test(b[0]!))).toBe(true);
  // the decoder: ✕ in a dashed cell
  await open(page, setupOf('decoder'));
  for (let g = 0; g < 3; g++) await page.keyboard.press('g');
  const skip = await page.locator('.bit.skip').first().evaluate((el) => ({ border: getComputedStyle(el).borderTopStyle, text: el.textContent }));
  expect(skip).toEqual({ border: 'dashed', text: '✕' });
});

test('with reduced motion, nothing on the knapsack screens animates or transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, setupOf('repair-lamarckian'));
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const durations = await page.evaluate(() => [...document.querySelectorAll('.bit, .capbar, .capbar i, .seg, .card, button, tr, svg *')].map((el) => getComputedStyle(el)).map((s) => `${s.transitionDuration}|${s.animationName}`));
  expect(durations.length).toBeGreaterThan(100);
  expect(durations.every((d) => /^0s(, 0s)*\|none$/.test(d))).toBe(true);
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [handling, items] of [...handlings.map((h) => [h, 12] as const), ['decoder', 20] as const, ['penalty', 20] as const]) {
    test(`at ${width}×${height} in projector mode, ${handling} with ${items} items: every stage, the drawer and the menu fit, and nothing scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, setupOf(handling, { items }));
      await page.getByRole('button', { name: 'Projector mode' }).click();
      const overflow = () =>
        page.evaluate(() => ({
          x: document.documentElement.scrollWidth - window.innerWidth,
          y: document.documentElement.scrollHeight - window.innerHeight,
          canvas: document.querySelector('.canvas')!.getBoundingClientRect().toJSON(),
          sideways: [...document.querySelectorAll('.mwrap, .cgrid, .rgrid, .mcards, .tablewrap')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.className} ${el.scrollWidth}>${el.clientWidth}`),
        }));
      const check = async (what: string) => {
        const o = await overflow();
        expect(o.x, `${what}: page overflows sideways`).toBeLessThanOrEqual(0);
        expect(o.y, `${what}: page overflows downwards`).toBeLessThanOrEqual(0);
        expect(o.canvas.right).toBeLessThanOrEqual(width + 1);
        expect(o.canvas.bottom).toBeLessThanOrEqual(height + 1);
        expect(o.sideways, `${what}: a view scrolls sideways`).toEqual([]);
      };
      await check('at the start');
      await page.keyboard.press('g');
      await check('after a generation');
      await page.keyboard.press('ArrowRight');
      for (const stage of ['selection', 'pairing', 'crossover', 'mutation', 'evaluation', 'replacement']) {
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('ArrowRight');
        for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight'); // some of its micro-steps revealed
        await check(`inside ${stage}`);
      }
      await page.getByRole('button', { name: /Parameters/ }).click();
      await check('with the drawer open');
      await page.keyboard.press('Escape');
      await page.getByTestId('problem-button').click();
      await check('with the problem menu open');
      const menu = (await page.getByTestId('problem-list').boundingBox())!;
      expect(menu.x + menu.width).toBeLessThanOrEqual(width);
      expect(menu.y + menu.height).toBeLessThanOrEqual(height);
    });
  }
}

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [handling, items] of [...handlings.map((h) => [h, 12] as const), ['penalty', 20] as const]) {
    test(`at ${width}×${height} in projector mode, ${handling} with ${items} items: the narration stays inside its box at every micro-step of two generations`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, setupOf(handling, { items, seed: 7 }));
      await page.getByRole('button', { name: 'Projector mode' }).click();
      const outside = () =>
        page.evaluate(() => {
          const box = document.querySelector('#narr')!.getBoundingClientRect();
          return [...document.querySelectorAll('#narr > *')]
            .map((el) => ({ text: el.textContent!.slice(0, 60), rect: el.getBoundingClientRect() }))
            .filter(({ rect }) => rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.right > box.right + 1)
            .map(({ text }) => text);
        });
      for (let k = 0; k < 2 * 40; k++) {
        await page.keyboard.press('ArrowRight');
        expect(await outside(), `micro-step ${k + 1}`).toEqual([]);
      }
    });
  }
}

import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, type GaParams, type GaSetup } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('target-string')!;
const title = (page: Page) => page.locator('#pop-heading');

const openStrings = async (page: Page, target = 'HELLO', params: GaParams = entry.defaults.params) => {
  const options = { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target };
  const setup: GaSetup = { problem: entry.create(options), init: entry.defaults.init };
  await page.goto(url + encodeConfig(configOf(setup, params, entry.defaults.seed, 'target-string', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Target string/);
  return { options, setup };
};
const unnamed = async (page: Page) => {
  // an unnamed control shows up in the accessibility tree as a bare role with no quoted name
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};

test('every chromosome has a name that spells its letters and says which positions match', async ({ page }) => {
  const { setup } = await openStrings(page);
  await page.keyboard.press('g');
  const engine = createRun(gaAlgorithm, { setup, params: entry.defaults.params, seed: entry.defaults.seed });
  engine.forwardCycle();
  const labelled = await page.getByRole('table', { name: /^Population · generation 1$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => [el.getAttribute('role'), el.getAttribute('aria-label')]));
  const expected = engine.snapshot(1).state.population.map((i) => {
    const word = formatGenes(i.chromosome, setup.problem.alphabet);
    const spelled = [...word].map((c) => (c === ' ' ? 'space' : c)).join(', ');
    const at = [...word].flatMap((c, k) => (c === 'HELLO'[k] ? [k + 1] : []));
    const where = at.length === 0 || at.length === 5 ? '' : ` (${at.length === 1 ? 'position' : 'positions'} ${at.length === 1 ? at[0] : `${at.slice(0, -1).join(', ')} and ${at[at.length - 1]}`})`;
    return `Chromosome ${spelled}. ${at.length} of 5 positions match the target${where}`;
  });
  expect(labelled.map((l) => l[0])).toEqual(Array(12).fill('img'));
  expect(labelled.map((l) => l[1])).toEqual(expected);
  expect(expected.some((label) => label.includes('space'))).toBe(true); // at least one string in this run has a space, and it is named
});

test('the population table is a real table with named columns, and the target row is named', async ({ page }) => {
  await openStrings(page);
  const table = page.getByRole('table', { name: /^Population · generation 0$/ });
  await expect(table.getByRole('columnheader')).toContainText(['#', 'Chromosome', 'Fitness', 'Weight', 'Prob.', 'Parent']);
  await expect(table.getByTestId('target-row')).toHaveAttribute('aria-label', 'The target is HELLO');
  await expect(table.getByRole('row')).toHaveCount(13);
});

test('a full generation can be stepped through with the keyboard alone, starting from the problem menu', async ({ page }) => {
  await page.goto(url);
  await page.keyboard.press('Tab'); // the first stop is the problem menu
  await expect(page.getByTestId('problem-button')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: /Goldberg/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: /Target string/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reset-notice')).toBeVisible();
  await page.keyboard.press('Tab');
  while (!(await page.getByRole('button', { name: 'Restart and apply' }).evaluate((el) => el === document.activeElement))) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('problem-button')).toHaveText(/Target string/);
  await page.locator('body').click({ position: { x: 5, y: 5 } }); // leave the focus where the page's shortcuts listen

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 2, name: /Selection/ })).toBeVisible();
  for (const stage of ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation']) {
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.getByTestId('ribbon').locator('li[aria-current="step"]')).toContainText(stage);
  }
  await page.keyboard.press('Shift+ArrowRight');
  await expect(title(page)).toHaveText('Population · generation 1');
  await expect(page.getByTestId('ribbon').locator('li.done')).toHaveCount(6);
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(title(page)).toHaveText('Parents · generation 0');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(title(page)).toHaveText('Population · generation 2');
});

test('the problem menu and the drawer, open, leave no control without a name', async ({ page }) => {
  await openStrings(page);
  expect(await unnamed(page)).toEqual([]);
  await page.getByTestId('problem-button').click();
  await expect(page.getByRole('menuitemradio', { name: /Target string/ })).toHaveAttribute('aria-checked', 'true');
  expect(await unnamed(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Parameters/ }).click();
  expect(await unnamed(page)).toEqual([]);
  await page.locator('#init').selectOption('explicit');
  await page.locator('#target').fill('HELLO, WORLD');
  expect(await unnamed(page)).toEqual([]);
  // the setup fields are named and tied to their messages
  await expect(page.getByRole('textbox', { name: 'Target', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('textbox', { name: 'Alphabet' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Chromosomes, one per line' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Hand-edited population' })).toBeVisible();
});

test('the match, the miss and the changed symbol are marked by shape and text, not only by colour', async ({ page }) => {
  // pm = 0.5, so that the mutation stage certainly changes symbols
  await openStrings(page, 'HELLO', { ...entry.defaults.params, mutation: { enabled: true, mode: 'per-gene', probability: 0.5 } });
  await page.keyboard.press('g');
  const cells = page.getByRole('table', { name: /^Population · generation 1$/ }).locator('tbody tr').first().locator('.bit');
  const style = (kind: 'match' | 'miss') =>
    cells.evaluateAll(
      (els, k) =>
        els
          .filter((el) => el.classList.contains(k))
          .map((el) => {
            const s = getComputedStyle(el);
            return { borderStyle: s.borderTopStyle, shadow: s.boxShadow, weight: s.fontWeight };
          }),
      kind,
    );
  const misses = await style('miss');
  expect(misses.length).toBeGreaterThan(0);
  expect(misses.every((m) => m.borderStyle === 'dashed')).toBe(true); // a dashed outline
  const matches = await page
    .locator('.bit.match')
    .first()
    .evaluate((el) => ({ borderStyle: getComputedStyle(el).borderTopStyle, shadow: getComputedStyle(el).boxShadow }));
  expect(matches.borderStyle).toBe('solid');
  expect(matches.shadow).not.toBe('none'); // the heavy baseline

  // a flipped gene: ✱, an outline and the words "old → new" with the draw
  await page.goto('about:blank');
  await openStrings(page, 'HELLO', { ...entry.defaults.params, mutation: { enabled: true, mode: 'per-gene', probability: 0.5 } });
  await page.keyboard.press('ArrowRight'); // generation 1, selection entered
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight'); // to the end of crossover
  await page.keyboard.press('ArrowRight'); // mutation entered
  for (let k = 0; k < 12; k++) await page.keyboard.press('ArrowRight'); // every offspring drawn
  const flipped = page.locator('.mcard .bit.flip').first();
  await expect(flipped).toBeVisible();
  const s = await flipped.evaluate((el) => ({ border: getComputedStyle(el).borderTopWidth, after: getComputedStyle(el, '::after').content }));
  expect(s.after).toContain('✱');
  expect(parseFloat(s.border)).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.mcard .badge.flip').first()).toContainText(/✱ gene \d+: \S+ → \S+ \(r = [\d.]+\)/);
  await expect(page.locator('.mcard .under.flag').first()).toBeVisible(); // the draw that flipped it is outlined too
});

test('with reduced motion, nothing on the string screens animates or transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openStrings(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll('.bit, .card, .menuitem, button, tr, svg *')]
      .map((el) => getComputedStyle(el))
      .map((s) => `${s.transitionDuration}|${s.animationName}`),
  );
  expect(durations.length).toBeGreaterThan(50);
  expect(durations.every((d) => /^0s(, 0s)*\|none$/.test(d))).toBe(true);
  await page.getByTestId('problem-button').click();
  await expect(page.getByTestId('problem-list')).toBeVisible();
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const target of ['HELLO', 'HELLO WORLD']) {
    test(`at ${width}×${height} in projector mode, with the target “${target}”, every stage, the drawer and the problem menu fit without scrolling the page`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openStrings(page, target);
      await page.getByRole('button', { name: 'Projector mode' }).click();
      const overflow = () =>
        page.evaluate(() => ({
          x: document.documentElement.scrollWidth - window.innerWidth,
          y: document.documentElement.scrollHeight - window.innerHeight,
          canvas: document.querySelector('.canvas')!.getBoundingClientRect().toJSON(),
          // a stage view that needs sideways scrolling inside its panel
          sideways: [...document.querySelectorAll('.mwrap, .cgrid, .rgrid, .mcards')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className),
        }));
      const check = async (what: string) => {
        const o = await overflow();
        expect(o.x, `${what}: page overflows sideways`).toBeLessThanOrEqual(0);
        expect(o.y, `${what}: page overflows downwards`).toBeLessThanOrEqual(0);
        expect(o.canvas.right).toBeLessThanOrEqual(width + 1);
        expect(o.canvas.bottom).toBeLessThanOrEqual(height + 1);
        expect(o.sideways, `${what}: a stage view scrolls sideways`).toEqual([]);
      };
      await page.keyboard.press('ArrowRight');
      for (const stage of ['selection', 'pairing', 'crossover', 'mutation', 'evaluation', 'replacement']) {
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('ArrowRight'); // into the next stage so that its view shows
        await check(`after ${stage}`);
      }
      await page.getByRole('button', { name: /Parameters/ }).click();
      await page.locator('#init').selectOption('explicit');
      await page.getByTestId('hand-population').locator('textarea').fill(`${target}\n${target.replace(/./, 'Z')}`);
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

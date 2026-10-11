import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, trapProblem, type GaParams, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { blockInfoOf } from '../src/ui/block-context';
import { blockSentence } from '../src/ui/block-model';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const base: TrapOptions = { blockSize: 4, blocks: 5, linkage: 'tight' };
const params: GaParams = { ...entry.defaults.params, mutation: { enabled: true, mode: 'per-gene', probability: 0.15 }, crossover: { enabled: true, operator: 'one-point', probability: 0.9 } };
const open = async (page: Page, options: TrapOptions = base, projector = true) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size: 12 } }, params, 7, 'trap', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};
const cases: [string, TrapOptions][] = [
  ['4 × 5 tight', base],
  ['6 × 5 loose (30 genes)', { blockSize: 6, blocks: 5, linkage: 'loose' }],
  ['2 × 1 (one block)', { blockSize: 2, blocks: 1, linkage: 'tight' }],
  ['3 × 10 (ten blocks)', { blockSize: 3, blocks: 10, linkage: 'tight' }],
];

for (const linkage of ['tight', 'loose'] as const) {
  test(`${linkage}: every chromosome in the table is named by its blocks, as the engine scores them`, async ({ page }) => {
    const options: TrapOptions = { ...base, linkage };
    await open(page, options);
    const problem = trapProblem(options);
    const info = blockInfoOf(problem);
    const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 12 } }, params, seed: 7 });
    for (let g = 0; g < 3; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    const labels = await page.getByRole('table', { name: /^Population · generation 3$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => [el.getAttribute('role'), el.getAttribute('aria-label')]));
    const expected = run.snapshot(3).state.population.map((i) => {
      const bits = formatGenes(i.chromosome, problem.alphabet);
      return `Chromosome ${bits}, ${blockSentence(info, bits)}`;
    });
    expect(labels.map((l) => l[0])).toEqual(Array(12).fill('img'));
    expect(labels.map((l) => l[1])).toEqual(expected);
  });
}

test('the tables are real tables with named columns, and the blocks are named in one sentence', async ({ page }) => {
  await open(page);
  const table = page.getByRole('table', { name: /^Population · generation 0$/ });
  await expect(table.getByRole('columnheader')).toContainText(['#', 'Chromosome', 'Decoded', 'Fitness']);
  await expect(table.getByTestId('block-row')).toHaveAttribute('aria-label', 'Blocks: block 1 is genes 1 to 4; block 2 is genes 5 to 8; block 3 is genes 9 to 12; block 4 is genes 13 to 16; block 5 is genes 17 to 20');
  await expect(table.getByRole('row')).toHaveCount(13);
  await expect(page.getByTestId('block-states-table')).toHaveAttribute('aria-label', 'Blocks at all ones and at all zeros by generation');
});

test('a full generation can be stepped through with the keyboard alone, starting from the problem menu', async ({ page }) => {
  await page.goto(url);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('problem-button')).toBeFocused();
  await page.keyboard.press('Enter');
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: /Trap/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reset-notice')).toBeVisible();
  await page.keyboard.press('Tab');
  while (!(await page.getByRole('button', { name: 'Restart and apply' }).evaluate((el) => el === document.activeElement))) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
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

test('the problem menu, the drawer and the schema tracker, open, leave no control without a name', async ({ page }) => {
  await open(page);
  expect(await unnamed(page)).toEqual([]);
  await page.getByTestId('problem-button').click();
  await expect(page.getByRole('menuitemradio', { name: /Trap/ })).toHaveAttribute('aria-checked', 'true');
  expect(await unnamed(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Parameters/ }).click();
  expect(await unnamed(page)).toEqual([]);
  await page.locator('#block-size').fill('9');
  expect(await unnamed(page)).toEqual([]);
  await expect(page.getByRole('textbox', { name: 'Block size k' })).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape');
  await page.getByTestId('show-schema').click();
  expect(await unnamed(page)).toEqual([]);
  await expect(page.getByRole('textbox', { name: /^Schema/ })).toBeVisible();
});

test('every meaning that has a colour has something else as well', async ({ page }) => {
  // crossover marks: the words and shapes ● A, ▨ B, ◧ split, and the hatched genes of parent B
  await open(page);
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight');
  const origins = await page.locator('.ccard .bnote').allTextContents();
  expect(origins.length).toBeGreaterThan(0);
  expect(origins.every((t) => ['● A', '▨ B', '◧ split'].includes(t))).toBe(true);
  expect(origins.some((t) => t === '◧ split')).toBe(true);
  expect(await page.locator('.ccard .bit.hatch').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('repeating-linear-gradient');
  expect((await page.getByTestId('block-split').first().textContent())!.trim()).toMatch(/^(◧|●) (\d of 5 blocks split|no block split)$/);
  // mutation: ✱ in the badge and on the gene
  await page.keyboard.press('Shift+ArrowRight');
  const changes = await page.getByTestId('block-change').allTextContents();
  expect(changes.length).toBeGreaterThan(0);
  expect(changes.every((t) => t.trim().startsWith('✱'))).toBe(true);
  // block notes in the table: ✓ n and ▽ n, with the numbers
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  const notes = await page.locator('.tablewrap .bnote').allTextContents();
  expect(notes.some((t) => /^✓ \d$/.test(t))).toBe(true);
  expect(notes.some((t) => /^▽ \d$/.test(t))).toBe(true);
  expect(notes.every((t) => /^(✓ |▽ )?\d$/.test(t))).toBe(true);
  // the block states panel: hatched for all zeros, solid for all ones, with the figures and marks printed
  const kinds = await page.evaluate(() => ({
    att: getComputedStyle(document.querySelector('.bsbar .sg.att') ?? document.body).backgroundImage,
    figures: [...document.querySelectorAll('.bsnum')].map((el) => el.textContent),
  }));
  expect(kinds.att).toContain('repeating-linear-gradient');
  expect(kinds.figures.every((t) => /^✓ \d+ · \d+ · ▽ \d+$/.test(t ?? ''))).toBe(true);
  // the fitness plot: the all-zeros line is dashed differently from the optimum's, and both are labelled
  const lines = await page.evaluate(() => ({
    optimum: document.querySelector('[data-optimum]')!.getAttribute('stroke-dasharray'),
    attractor: document.querySelector('[data-attractor]')!.getAttribute('stroke-dasharray'),
    labels: [...document.querySelectorAll('[data-plot="fitness"] text')].map((t) => t.textContent).filter((t) => /optimum|all zeros/.test(t ?? '')),
  }));
  expect(lines.optimum).not.toBe(lines.attractor);
  expect(lines.labels).toEqual(['all zeros 15', 'optimum 20']);
  // the schema tracker: the instances' line is solid with ■, the population's is dashed with ●
  await page.getByTestId('show-schema').click();
  await page.locator('#schema-input').fill('*'.repeat(20)); // every individual is an instance, so both lines have points
  const schema = await page.evaluate(() => ({
    population: document.querySelector('[data-plot="schema-fitness"] path[stroke-dasharray]')?.getAttribute('stroke-dasharray'),
    instanceDot: document.querySelector('[data-plot="schema-fitness"] rect[data-series="instanceMean"]')?.tagName,
    populationDot: document.querySelector('[data-plot="schema-fitness"] circle[data-series="populationMean"]')?.tagName,
    caption: document.querySelector('.schema figcaption b')?.textContent,
  }));
  expect(schema.population).toBe('7 4');
  expect([schema.instanceDot, schema.populationDot]).toEqual(['rect', 'circle']);
});

test('with reduced motion, nothing on the trap screens animates or transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  const durations = await page.evaluate(() => [...document.querySelectorAll('.bit, .blk, .bnote, .bsbar, .bsbar i, .card, button, tr, svg *')].map((el) => getComputedStyle(el)).map((s) => `${s.transitionDuration}|${s.animationName}`));
  expect(durations.length).toBeGreaterThan(200);
  expect(durations.every((d) => /^0s(, 0s)*\|none$/.test(d))).toBe(true);
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: every stage, the schema tracker, the drawer and the menu fit, and nothing scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options);
      const check = async (what: string) => {
        const o = await page.evaluate(() => ({
          x: document.documentElement.scrollWidth - window.innerWidth,
          y: document.documentElement.scrollHeight - window.innerHeight,
          canvas: document.querySelector('.canvas')!.getBoundingClientRect().toJSON(),
          sideways: [...document.querySelectorAll('.mwrap, .cgrid, .rgrid, .tablewrap')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.className} ${el.scrollWidth}>${el.clientWidth}`),
        }));
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
        for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
        await check(`inside ${stage}`);
      }
      await page.getByTestId('show-schema').click();
      await check('with the schema tracker');
      await page.getByTestId('show-stage').click();
      await page.getByRole('button', { name: /Parameters/ }).click();
      await check('with the drawer open');
      await page.keyboard.press('Escape');
      await page.getByTestId('problem-button').click();
      await check('with the problem menu open');
      const menu = (await page.getByTestId('problem-list').boundingBox())!;
      expect(menu.x + menu.width).toBeLessThanOrEqual(width);
      expect(menu.y + menu.height).toBeLessThanOrEqual(height);
    });

    test(`at ${width}×${height} in projector mode, ${name}: the narration stays inside its box at every micro-step of two generations`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options);
      const outside = () =>
        page.evaluate(() => {
          const box = document.querySelector('#narr')!.getBoundingClientRect();
          return [...document.querySelectorAll('#narr > *')]
            .map((el) => ({ text: el.textContent!.slice(0, 60), rect: el.getBoundingClientRect() }))
            .filter(({ rect }) => rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.right > box.right + 1)
            .map(({ text }) => text);
        });
      for (let k = 0; k < 2 * 30; k++) {
        await page.keyboard.press('ArrowRight');
        expect(await outside(), `micro-step ${k + 1}`).toEqual([]);
      }
    });
  }
}

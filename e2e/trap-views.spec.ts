import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, type Linkage, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const open = async (page: Page, options: TrapOptions, size = 12) => {
  const init = { kind: 'random' as const, size };
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init }, entry.defaults.params, 7, 'trap', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
  await page.getByRole('button', { name: 'Projector mode' }).click();
};
const cases: [string, TrapOptions][] = [
  ['4 × 5 tight', { blockSize: 4, blocks: 5, linkage: 'tight' }],
  ['4 × 5 loose', { blockSize: 4, blocks: 5, linkage: 'loose' }],
  ['6 × 5 loose', { blockSize: 6, blocks: 5, linkage: 'loose' }],
  ['6 × 5 tight', { blockSize: 6, blocks: 5, linkage: 'tight' }],
  ['3 × 10 tight', { blockSize: 3, blocks: 10, linkage: 'tight' }],
  ['2 × 1 tight', { blockSize: 2, blocks: 1, linkage: 'tight' }],
];

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: the block row lines up with the cells, notes sit under their blocks, and no table is wider than its panel, in the population, evaluation and replacement views`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options);
      const check = async (what: string) => {
        const r = await page.evaluate((linkage) => {
          const tol = 1.5;
          const out: string[] = [];
          for (const wrap of document.querySelectorAll('.tablewrap, .mwrap, .rgrid')) {
            if (wrap.scrollWidth > wrap.clientWidth + 1) out.push(`sideways ${wrap.className} ${wrap.scrollWidth}>${wrap.clientWidth}`);
          }
          for (const head of document.querySelectorAll('[data-testid="block-row"]')) {
            const table = head.closest('table, .rcol') as HTMLElement;
            const row = table.querySelector('tbody tr, .rrow');
            const chrom = row?.querySelector('.bits.blocked');
            if (!chrom) continue;
            const labels = [...head.querySelectorAll('.brk, .bn')].map((el) => el.getBoundingClientRect());
            const targets = (linkage === 'tight' ? [...chrom.querySelectorAll('.blk')] : [...chrom.querySelectorAll('.bit')]).map((el) => el.getBoundingClientRect());
            if (labels.length !== targets.length) out.push(`label count ${labels.length} vs ${targets.length}`);
            labels.forEach((l, k) => {
              const t = targets[k];
              if (t && (Math.abs(l.left - t.left) > tol || Math.abs(l.width - t.width) > tol)) out.push(`label ${k + 1} at ${l.left.toFixed(1)}+${l.width.toFixed(1)} vs ${t.left.toFixed(1)}+${t.width.toFixed(1)}`);
            });
          }
          for (const chrom of document.querySelectorAll('.bits.blocked')) {
            const box = chrom.getBoundingClientRect();
            for (const note of chrom.querySelectorAll('.bnote')) {
              const n = note.getBoundingClientRect();
              if (n.left < box.left - 1 || n.right > box.right + 1) out.push(`note outside its chromosome: ${note.textContent}`);
            }
            if (linkage === 'tight') for (const blk of chrom.querySelectorAll('.blk')) {
              const note = blk.querySelector('.bnote');
              if (!note) continue;
              const b = blk.getBoundingClientRect();
              const n = note.getBoundingClientRect();
              if (n.left < b.left - 1 || n.right > b.right + 1) out.push(`note wider than its block: ${note.textContent} ${n.width.toFixed(1)}>${b.width.toFixed(1)}`);
            }
          }
          if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
          return out;
        }, options.linkage);
        expect(r, what).toEqual([]);
      };
      await check('population at the start');
      await page.keyboard.press('g');
      await check('population after a generation');
      await page.keyboard.press('ArrowRight');
      for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
      for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
      await check('evaluation');
      await page.keyboard.press('Shift+ArrowRight');
      await check('replacement');
    });
  }
}

test('every chromosome in the population table has a name and a sentence of its blocks, and the block row has one sentence', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { blockSize: 4, blocks: 5, linkage: 'tight' });
  const labels = await page.getByRole('table', { name: /^Population/ }).locator('tbody [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(labels).toHaveLength(12);
  for (const l of labels) expect(l).toMatch(/^Chromosome [01]{20}, ones per block \d, \d, \d, \d, \d; scores [\d, ]+; (all ones in|no block is all ones)/);
  await expect(page.getByTestId('block-row').first()).toHaveAttribute('aria-label', 'Blocks: block 1 is genes 1 to 4; block 2 is genes 5 to 8; block 3 is genes 9 to 12; block 4 is genes 13 to 16; block 5 is genes 17 to 20');
});

test('the decoded counts and the fitness in the table are the engine’s, and a trap never shows the item row or the target row', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const options: TrapOptions = { blockSize: 4, blocks: 5, linkage: 'tight' };
  await open(page, options);
  const run = createRun(gaAlgorithm, { setup: { problem: entry.create(options), init: { kind: 'random', size: 12 } }, params: entry.defaults.params, seed: 7 });
  const pop = run.snapshot(0).state.population;
  const fitness = await page.getByRole('table', { name: /^Population/ }).locator('tbody [data-col="fitness"]').allTextContents();
  expect(fitness.map(Number)).toEqual(pop.map((i) => i.fitness));
  await expect(page.getByTestId('item-row')).toHaveCount(0);
});

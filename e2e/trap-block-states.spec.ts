import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, trapProblem, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { blockInfoOf } from '../src/ui/block-context';
import { blockStateCounts } from '../src/ui/block-states-model';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const open = async (page: Page, options: TrapOptions) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size: 12 } }, entry.defaults.params, 7, 'trap', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
  await page.getByRole('button', { name: 'Projector mode' }).click();
};
const cases: [string, TrapOptions][] = [
  ['1 block of 4', { blockSize: 4, blocks: 1, linkage: 'tight' }],
  ['5 blocks of 4 tight', { blockSize: 4, blocks: 5, linkage: 'tight' }],
  ['5 blocks of 6 loose', { blockSize: 6, blocks: 5, linkage: 'loose' }],
  ['10 blocks of 3', { blockSize: 3, blocks: 10, linkage: 'tight' }],
];

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: the block states panel fits, keeps the widths of its columns from generation to generation, and its counts are the engine's`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options);
      const problem = trapProblem(options);
      const info = blockInfoOf(problem);
      const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 12 } }, params: entry.defaults.params, seed: 7 });
      const read = () =>
        page.evaluate(() => {
          const panel = document.querySelector('[data-testid="block-states"]')!.closest('section')!;
          const box = panel.getBoundingClientRect();
          const out: string[] = [];
          for (const el of panel.querySelectorAll('.bstates, .bsrow, .bskey, .bshist, .summary')) {
            const r = el.getBoundingClientRect();
            if (r.bottom > box.bottom + 0.5 || r.right > box.right + 0.5) out.push(`${el.className || el.tagName} leaves the panel (bottom ${r.bottom.toFixed(1)} > ${box.bottom.toFixed(1)}, right ${r.right.toFixed(1)} > ${box.right.toFixed(1)})`);
          }
          const rows = [...panel.querySelectorAll('.bsrow')];
          const bars = rows.map((r) => Math.round(r.querySelector('.bsbar')!.getBoundingClientRect().width));
          const nums = rows.map((r) => Math.round(r.querySelector('.bsnum')!.getBoundingClientRect().width));
          const counts = rows.map((r) => ['data-optimum', 'data-between', 'data-attractor'].map((a) => Number(r.getAttribute(a))));
          return { out, bars, nums, counts, history: panel.querySelector('.bshist')!.textContent, heading: panel.querySelector('h2')!.textContent, panelWidth: Math.round(box.width) };
        });
      let widths: string | undefined;
      for (let g = 0; g <= 8; g++) {
        if (g > 0) {
          await page.keyboard.press('g');
          run.forwardCycle();
        }
        const r = await read();
        expect(r.out, `generation ${g}`).toEqual([]);
        expect(r.heading).toBe('Block states');
        expect(r.counts, `generation ${g}`).toEqual(blockStateCounts(info, run.snapshot(g).state.population).map((c) => [c.optimum, c.between, c.attractor]));
        expect(new Set(r.bars).size, 'every bar the same width').toBe(1);
        expect(new Set(r.nums).size, 'every figure column the same width').toBe(1);
        const key = JSON.stringify([r.bars[0], r.nums[0], r.panelWidth]);
        widths ??= key;
        expect(key, `generation ${g}`).toBe(widths);
        expect(r.history).toMatch(/^blocks at all zeros, generations? \d+(–\d+)?: /);
      }
    });
  }
}

test('scrubbing back shows the block states of that generation, with the history line ending there', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const options: TrapOptions = { blockSize: 4, blocks: 5, linkage: 'tight' };
  await open(page, options);
  for (let g = 0; g < 6; g++) await page.keyboard.press('g');
  const scrub = page.getByTestId('scrub');
  await scrub.focus();
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '4');
  const problem = trapProblem(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 12 } }, params: entry.defaults.params, seed: 7 });
  for (let g = 0; g < 6; g++) run.forwardCycle();
  const counts = blockStateCounts(blockInfoOf(problem), run.snapshot(4).state.population);
  const rows = await page.locator('.bsrow').evaluateAll((els) => els.map((el) => ['data-optimum', 'data-between', 'data-attractor'].map((a) => Number(el.getAttribute(a)))));
  expect(rows).toEqual(counts.map((c) => [c.optimum, c.between, c.attractor]));
  await expect(page.getByTestId('block-history')).toHaveText(/generations 0–4: /);
});

test('the other problems keep their own panels', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#allele-heading')).toHaveText('Share of 1s per gene');
  await expect(page.getByTestId('block-states')).toHaveCount(0);
});

test('the fitness plot of the trap has a dashed line for what all zeros scores next to the optimum line, with its label inside the plot; the other problems have only the optimum', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { blockSize: 4, blocks: 5, linkage: 'tight' });
  for (let g = 0; g < 4; g++) await page.keyboard.press('g');
  const plot = page.locator('[data-plot="fitness"]');
  await expect(plot.locator('[data-attractor="15"]')).toHaveCount(1);
  await expect(plot.locator('[data-optimum="20"]')).toHaveCount(1);
  await expect(plot).toContainText('all zeros 15');
  await expect(plot).toContainText('optimum 20');
  const boxes = await plot.evaluate((svg) => {
    const outer = svg.getBoundingClientRect();
    return [...svg.querySelectorAll('text')].filter((t) => /all zeros|optimum/.test(t.textContent ?? '')).map((t) => {
      const r = t.getBoundingClientRect();
      return { text: t.textContent, inside: r.left >= outer.left && r.right <= outer.right && r.top >= outer.top && r.bottom <= outer.bottom };
    });
  });
  expect(boxes.every((b) => b.inside)).toBe(true);
  await page.goto(url);
  await expect(page.locator('[data-plot="fitness"] [data-attractor]')).toHaveCount(0);
});

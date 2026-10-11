import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, trapProblem, type GaParams, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { blockInfoOf } from '../src/ui/block-context';
import { blockOrigins } from '../src/ui/block-model';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const params: GaParams = { ...entry.defaults.params, crossover: { enabled: true, operator: 'one-point', probability: 0.9 } };
const open = async (page: Page, options: TrapOptions) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size: 12 } }, params, 7, 'trap', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
  await page.getByRole('button', { name: 'Projector mode' }).click();
};
const cases: [string, TrapOptions][] = [
  ['4 × 5 tight', { blockSize: 4, blocks: 5, linkage: 'tight' }],
  ['4 × 5 loose', { blockSize: 4, blocks: 5, linkage: 'loose' }],
  ['6 × 5 tight', { blockSize: 6, blocks: 5, linkage: 'tight' }],
  ['6 × 5 loose', { blockSize: 6, blocks: 5, linkage: 'loose' }],
  ['3 × 10 tight', { blockSize: 3, blocks: 10, linkage: 'tight' }],
];

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: at every micro-step of the crossover stage of two generations the cards fit, the block row sits over the cells and every note is under its block`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options);
      const check = () =>
        page.evaluate((linkage) => {
          const out: string[] = [];
          const tol = 1.5;
          const grid = document.querySelector('.cgrid');
          if (!grid) return ['no crossover grid'];
          if (grid.scrollWidth > grid.clientWidth + 1) out.push(`grid sideways ${grid.scrollWidth}>${grid.clientWidth}`);
          if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
          for (const card of document.querySelectorAll('.ccard')) {
            const box = card.getBoundingClientRect();
            for (const el of card.querySelectorAll('.bits.blocked, .badge, .blkhdr')) {
              const r = el.getBoundingClientRect();
              if (r.right > box.right + 1) out.push(`${el.className} leaves its card by ${(r.right - box.right).toFixed(1)}`);
            }
            const head = card.querySelector('[data-testid="block-row"]');
            const chrom = card.querySelector('.bits.blocked');
            if (head && chrom) {
              const labels = [...head.querySelectorAll('.brk, .bn')].map((el) => el.getBoundingClientRect());
              const targets = (linkage === 'tight' ? [...chrom.querySelectorAll('.blk')] : [...chrom.querySelectorAll('.bit')]).map((el) => el.getBoundingClientRect());
              if (labels.length !== targets.length) out.push(`label count ${labels.length} vs ${targets.length}`);
              labels.forEach((l, k) => {
                const t = targets[k];
                if (t && (Math.abs(l.left - t.left) > tol || Math.abs(l.width - t.width) > tol)) out.push(`label ${k + 1} off by ${(l.left - t.left).toFixed(1)}`);
              });
            }
            for (const chromosome of card.querySelectorAll('.bits.blocked')) {
              const tops = new Set([...chromosome.querySelectorAll('.bit')].map((b) => Math.round(b.getBoundingClientRect().top)));
              if (tops.size > 1) out.push(`a chromosome wraps onto ${tops.size} lines`);
            }
            if (linkage === 'tight') {
              for (const blk of card.querySelectorAll('.blk')) {
                const note = blk.querySelector('.bnote');
                if (!note) continue;
                const b = blk.getBoundingClientRect();
                const n = note.getBoundingClientRect();
                if (n.left < b.left - 1 || n.right > b.right + 1) out.push(`note ${note.textContent} wider than its block`);
              }
            }
          }
          return out;
        }, options.linkage);
      await page.keyboard.press('ArrowRight');
      for (let k = 0; k < 2; k++) await page.keyboard.press('Shift+ArrowRight'); // end of pairing
      let seen = 0;
      for (let step = 0; step < 14; step++) {
        await page.keyboard.press('ArrowRight');
        if (await page.getByRole('heading', { level: 2, name: /Crossover/ }).count()) {
          seen++;
          expect(await check(), `micro-step ${step}`).toEqual([]);
        }
      }
      expect(seen).toBeGreaterThan(3);
      // and the same in the second generation, after a whole generation
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('ArrowLeft');
    });
  }
}

test('the notes on the screen are the verdicts of the recorded crossover: every child and block, tight and loose', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const linkage of ['tight', 'loose'] as const) {
    const options: TrapOptions = { blockSize: 4, blocks: 5, linkage };
    await open(page, options);
    const problem = trapProblem(options);
    const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 12 } }, params, seed: 7 });
    run.forwardCycle();
    const info = blockInfoOf(problem);
    await page.keyboard.press('ArrowRight');
    for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight'); // end of crossover: every pair shown
    await expect(page.getByRole('heading', { level: 2, name: /Crossover/ })).toBeVisible();
    const events = run.events(1).flatMap((e) => (e.stage === 'crossover' && e.decision === 'recombined' ? [e] : []));
    expect(events.length).toBeGreaterThan(2);
    const shown = await page.locator('.ccard[data-state="revealed"]').evaluateAll((cards) =>
      cards.map((card) => [...card.querySelectorAll('[data-child]')].map((row) => [...row.querySelectorAll('.bnote')].map((n) => n.className.replace('bnote ', '')))),
    );
    const expected = run.events(1).flatMap((e) =>
      e.stage === 'crossover' && e.decision === 'recombined' ? [e.children.map((c) => blockOrigins(info, c.sources).map((v) => (v === 'A' ? 'whole-a' : v === 'B' ? 'whole-b' : 'split')))] : [],
    );
    const shownRecombined = shown.filter((card) => card.every((row) => row.length > 0));
    expect(shownRecombined).toEqual(expected);
  }
});

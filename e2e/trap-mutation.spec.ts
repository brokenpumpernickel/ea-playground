import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { GaParams, TrapOptions } from '../src/engine';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const params: GaParams = { ...entry.defaults.params, mutation: { enabled: true, mode: 'per-gene', probability: 0.2 } };
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
  ['2 × 2 tight', { blockSize: 2, blocks: 2, linkage: 'tight' }],
];

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: at every micro-step of the mutation stage the cards fit, the block row sits over the cells, draws and marks do not overlap`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options);
      const check = () =>
        page.evaluate(({ linkage, genes }) => {
          const out: string[] = [];
          const tol = 1.5;
          const wrap = document.querySelector('.mwrap');
          if (!wrap) return ['no mutation view'];
          if (wrap.scrollWidth > wrap.clientWidth + 1) out.push(`sideways ${wrap.scrollWidth}>${wrap.clientWidth}`);
          if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
          const head = wrap.querySelector('[data-testid="block-row"]');
          const cards = [...wrap.querySelectorAll('.mcard')];
          const first = cards[0]?.querySelector('.bits.blocked');
          if (head && first) {
            const labels = [...head.querySelectorAll('.brk, .bn')].map((el) => el.getBoundingClientRect());
            const targets = (linkage === 'tight' ? [...first.querySelectorAll('.blk')] : [...first.querySelectorAll('.gcell')]).map((el) => el.getBoundingClientRect());
            if (labels.length !== targets.length) out.push(`label count ${labels.length} vs ${targets.length}`);
            labels.forEach((l, k) => {
              const t = targets[k];
              if (t && (Math.abs(l.left - t.left) > tol || Math.abs(l.width - t.width) > tol)) out.push(`label ${k + 1} off by ${(l.left - t.left).toFixed(1)} / ${(l.width - t.width).toFixed(1)}`);
            });
          }
          for (const card of cards) {
            const box = card.getBoundingClientRect();
            for (const el of card.querySelectorAll('.bits, .badge')) {
              if (el.getBoundingClientRect().right > box.right + 1) out.push(`${el.className} leaves its card`);
            }
            for (const chromosome of card.querySelectorAll('.bits.blocked')) {
              const tops = new Set([...chromosome.querySelectorAll('.bit')].map((b) => Math.round(b.getBoundingClientRect().top)));
              if (tops.size > 1) out.push(`a chromosome wraps onto ${tops.size} lines`);
            }
            // the draws under the genes must stay inside their column, and clear of the stars over the result row's genes
            const unders = [...card.querySelectorAll('.under')]
              .filter((u) => (u.textContent ?? '').trim() !== '')
              .map((u) => {
                const range = document.createRange();
                range.selectNodeContents(u);
                return { text: u.textContent, box: range.getBoundingClientRect(), col: u.closest('.gcell')!.getBoundingClientRect() };
              });
            if (genes <= 20) {
              for (const u of unders) if (u.box.left < u.col.left - 1 || u.box.right > u.col.right + 1) out.push(`draw ${u.text} wider than its column (${u.box.width.toFixed(1)} > ${u.col.width.toFixed(1)})`);
            }
            // above 20 genes only the draws that flipped a gene are printed, wider than a column but never on top of one another
            unders.forEach((a, i) => unders.slice(i + 1).forEach((b) => {
              if (a.box.left < b.box.right && b.box.left < a.box.right && a.box.top < b.box.bottom && b.box.top < a.box.bottom) out.push(`draws ${a.text} and ${b.text} overlap`);
            }));
            const stars = [...card.querySelectorAll('.crow.res .bit.flip')].map((b) => {
              const r = b.getBoundingClientRect();
              return { left: r.left + r.width / 2 - 8, right: r.left + r.width / 2 + 8, top: r.top - 18, bottom: r.top };
            });
            for (const u of unders) for (const s of stars) if (u.box.left < s.right && s.left < u.box.right && u.box.top < s.bottom && s.top < u.box.bottom) out.push(`a draw (${u.text}) and a star overlap`);
            for (const note of card.querySelectorAll('.bnote')) {
              const b = note.closest('.bits')!.getBoundingClientRect();
              const n = note.getBoundingClientRect();
              if (n.left < b.left - 1 || n.right > b.right + 1) out.push('a note is outside its chromosome');
            }
          }
          return out;
        }, { linkage: options.linkage, genes: options.blockSize * options.blocks });
      await page.keyboard.press('ArrowRight');
      for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight'); // end of crossover
      let seen = 0;
      for (let step = 0; step < 14; step++) {
        await page.keyboard.press('ArrowRight');
        if (await page.getByRole('heading', { level: 2, name: /Mutation/ }).count()) {
          seen++;
          expect(await check(), `micro-step ${step}`).toEqual([]);
        }
      }
      expect(seen).toBeGreaterThan(3);
      await page.keyboard.press('Shift+ArrowRight');
      expect(await check(), 'at the end of the stage').toEqual([]);
    });
  }
}

test('a changed block is said in words on the screen, with the block, its genes and its scores', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { blockSize: 4, blocks: 5, linkage: 'tight' });
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight'); // end of mutation: every offspring shown
  await expect(page.getByRole('heading', { level: 2, name: /Mutation/ })).toBeVisible();
  const changes = await page.getByTestId('block-change').allTextContents();
  expect(changes.length).toBeGreaterThan(0);
  for (const c of changes) expect(c).toMatch(/block \d+: [01]{4} → [01]{4} · \d → \d/);
});

import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { GaParams, TrapOptions } from '../src/engine';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const open = async (page: Page, options: TrapOptions, params: GaParams) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size: 12 } }, params, 7, 'trap', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
  await page.getByRole('button', { name: 'Projector mode' }).click();
};
const cases: [string, TrapOptions][] = [
  ['4 × 5 tight', { blockSize: 4, blocks: 5, linkage: 'tight' }],
  ['4 × 5 loose', { blockSize: 4, blocks: 5, linkage: 'loose' }],
  ['6 × 5 loose (30 genes)', { blockSize: 6, blocks: 5, linkage: 'loose' }],
  ['3 × 10 tight', { blockSize: 3, blocks: 10, linkage: 'tight' }],
];

/** Everything printed in a card stays inside it, and in a row of the card nothing sits on top of its neighbour or is clipped. */
const check = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const boxOf = (el: Element) => el.getBoundingClientRect();
    for (const grid of document.querySelectorAll('.tgrid, .pgrid')) {
      if (grid.scrollWidth > grid.clientWidth + 1) out.push(`${grid.className} scrolls sideways ${grid.scrollWidth}>${grid.clientWidth}`);
    }
    for (const card of document.querySelectorAll('.tcard, .pcard')) {
      const c = boxOf(card);
      const inside = (el: Element, what: string) => {
        const r = boxOf(el);
        if (r.right > c.right + 1 || r.left < c.left - 1) out.push(`${what} leaves its card by ${(r.right - c.right).toFixed(1)}`);
      };
      for (const row of card.querySelectorAll('.contestants li, .parent')) {
        const items = [...row.children];
        items.forEach((el, k) => {
          inside(el, `${(el as HTMLElement).className || el.tagName} of a row`);
          const next = items[k + 1];
          if (next) {
            const a = boxOf(el);
            const b = boxOf(next);
            // side by side (same line) must not overlap; stacked elements are fine
            if (a.top < b.bottom - 2 && b.top < a.bottom - 2 && a.right > b.left + 1) out.push(`${(el as HTMLElement).className || el.tagName} overlaps the next item`);
          }
        });
        for (const el of row.querySelectorAll(':scope > span:not(.bits)')) {
          const r = boxOf(el);
          if (r.height > 34) out.push(`the text “${el.textContent}” is broken over several lines`);
        }
      }
    }
    if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
    return out;
  });

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options] of cases) {
    for (const method of ['tournament', 'roulette'] as const) {
      test(`at ${width}×${height} in projector mode, ${name}, ${method} selection: at every micro-step of selection and pairing the cards hold their rows without overlap, clipping or broken text`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        const params: GaParams = { ...entry.defaults.params, selection: method === 'tournament' ? { method: 'tournament', size: 2 } : { method: 'roulette', chain: [{ step: 'identity' }] } };
        await open(page, options, params);
        await page.keyboard.press('ArrowRight');
        let seen = 0;
        for (let step = 0; step < 22; step++) {
          const heading = await page.locator('#stage-heading').textContent();
          if (/Selection|Pairing/.test(heading ?? '')) {
            seen++;
            expect(await check(page), `micro-step ${step} (${heading})`).toEqual([]);
          }
          await page.keyboard.press('ArrowRight');
        }
        expect(seen).toBeGreaterThan(5);
        // and the whole of the pairing stage at once
        await page.keyboard.press('ArrowLeft');
      });
    }
  }
}

test('in the mutation cards the badges for the blocks have room below the result row: a flipped gene’s star and shadow do not touch them', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { blockSize: 4, blocks: 5, linkage: 'tight' }, { ...entry.defaults.params, mutation: { enabled: true, mode: 'per-gene', probability: 0.15 } });
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  const gaps = await page.evaluate(() =>
    [...document.querySelectorAll('.mcard')].flatMap((card) => {
      const res = card.querySelector('.crow.res');
      const marks = card.querySelector('.crow.blockmarks');
      if (!res || !marks) return [];
      const bits = [...res.querySelectorAll('.bit')].reduce((bottom, b) => Math.max(bottom, b.getBoundingClientRect().bottom), -Infinity);
      const badge = marks.querySelector('.badge');
      return badge ? [badge.getBoundingClientRect().top - bits] : [];
    }),
  );
  expect(gaps.length).toBeGreaterThan(0);
  for (const g of gaps) expect(g).toBeGreaterThanOrEqual(10);
});

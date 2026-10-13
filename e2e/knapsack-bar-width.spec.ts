import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { handlings, type GaParams, type Handling, type KnapsackOptions } from '../src/engine';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;
const base = entry.defaultOptions() as KnapsackOptions;

const open = async (page: Page, handling: Handling, items: number, seed: number) => {
  const list = Array.from({ length: items }, (_, k) => base.items[k % 12]!);
  const total = list.reduce((t, i) => t + i.weight, 0);
  const options: KnapsackOptions = { ...base, handling, items: list, capacity: items !== 12 ? Math.floor(total / 2) : base.capacity };
  const params: GaParams = entry.defaults.params;
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: entry.defaults.init }, params, seed, 'knapsack', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Knapsack/);
  await page.getByRole('button', { name: 'Projector mode' }).click();
};

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [handling, items] of [...handlings.map((h) => [h, 12] as const), ['penalty', 20] as const]) {
    test(`at ${width}×${height} in projector mode, ${handling} with ${items} items: the stacked bar's track keeps one width and one left edge at every micro-step of two generations, and its caption and label never overlap it or leave the panel`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, handling, items, 7);
      const seen: { left: number; width: number; label: string; caption: string }[] = [];
      for (let k = 0; k < 2 * 40; k++) {
        await page.keyboard.press('ArrowRight');
        const g = await page.evaluate(() => {
          const wrap = document.querySelector('.bagwrap');
          if (!wrap) return null;
          const bar = wrap.querySelector('.bigbar')!.getBoundingClientRect();
          const lbl = wrap.querySelector('.lbl')!.getBoundingClientRect();
          const cap = wrap.querySelector('.legend2')!.getBoundingClientRect();
          const panel = wrap.closest('section.panel')!.getBoundingClientRect();
          const meets = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
          return {
            left: Math.round(bar.left * 100) / 100,
            width: Math.round(bar.width * 100) / 100,
            label: wrap.querySelector('.lbl')!.textContent!,
            caption: wrap.querySelector('.legend2')!.textContent!.trim(),
            problems: [meets(lbl, bar) && 'the label overlaps the bar', meets(cap, bar) && 'the caption overlaps the bar', cap.right > panel.right + 1 && 'the caption leaves the panel', cap.left < panel.left - 1 && 'the caption leaves the panel on the left', bar.right > panel.right + 1 && 'the bar leaves the panel', lbl.left < panel.left - 1 && 'the label leaves the panel'].filter(Boolean),
          };
        });
        if (!g) continue;
        expect(g.problems, `micro-step ${k + 1}: ${g.label}, ${g.caption}`).toEqual([]);
        seen.push(g);
      }
      expect(seen.length, 'the bar was seen at several micro-steps').toBeGreaterThan(5);
      expect(new Set(seen.map((s) => s.label)).size, 'with different offspring labels').toBeGreaterThan(1);
      expect(new Set(seen.map((s) => s.caption)).size, 'and different captions').toBeGreaterThan(2);
      expect(new Set(seen.map((s) => s.width)).size, 'the track width changes between micro-steps').toBe(1);
      expect(new Set(seen.map((s) => s.left)).size, 'the track moves between micro-steps').toBe(1);
    });
  }
}

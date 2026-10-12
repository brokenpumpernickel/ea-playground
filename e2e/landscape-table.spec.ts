import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatReal, gaAlgorithm, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;

/** Extreme data on purpose: both bounds, zero, mixed signs, the longest numbers. */
const extremes = (options: LandscapeOptions): string[] => {
  if (options.representation === 'real') return ['-5 -5', '5 5', '0 0', '-5 5', '4.999 -0.001', '2 -1', '-3.141 2.718', '0.5 -4.5'];
  const n = options.bitsPerVariable;
  const ones = '1'.repeat(n);
  const zeros = '0'.repeat(n);
  const alt = '10'.repeat(n).slice(0, n);
  return [zeros + zeros, ones + ones, ones + zeros, zeros + ones, alt + alt, '1' + '0'.repeat(n - 1) + '0' + '1'.repeat(n - 1), '0' + '1'.repeat(n - 1) + '1' + '0'.repeat(n - 1), alt + zeros];
};

const open = async (page: Page, options: LandscapeOptions, seed = 7) => {
  const d = defaultsOf(entry, options);
  const init = { kind: 'explicit' as const, chromosomes: extremes(options) };
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init }, { ...d.params, elites: 1 }, seed, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  await page.getByRole('button', { name: 'Projector mode' }).click();
};
const engineRows = (options: LandscapeOptions, generation: number, seed = 7) => {
  const d = defaultsOf(entry, options);
  const problem = entry.create(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'explicit', chromosomes: extremes(options) } }, params: { ...d.params, elites: 1 }, seed });
  for (let g = 0; g < generation; g++) run.forwardCycle();
  return run.snapshot(generation).state.population.map((i) => (options.representation === 'real' ? formatReal(i.chromosome, 3) : i.chromosome.join('')));
};
const popRows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));

const cases: [string, LandscapeOptions][] = [
  ['the real pair, single peak', { function: 'single-peak', representation: 'real', bitsPerVariable: 10 }],
  ['the real pair, Himmelblau (f(x, y) shown)', { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 }],
  ['plain binary, 10 bits per variable', { function: 'single-peak', representation: 'plain', bitsPerVariable: 10 }],
  ['Gray code, 12 bits per variable, Rastrigin', { function: 'rastrigin', representation: 'gray', bitsPerVariable: 12 }],
  ['plain binary, 6 bits per variable, Himmelblau (f(x, y) shown)', { function: 'himmelblau', representation: 'plain', bitsPerVariable: 6 }],
  ['Gray code, 4 bits per variable', { function: 'two-peaks', representation: 'gray', bitsPerVariable: 4 }],
];

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: the table fits its panel, its columns keep their widths from generation to generation, and the variable row lines up with the bits`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options);
      const measure = () =>
        page.evaluate(() => {
          const out: string[] = [];
          for (const wrap of document.querySelectorAll('.tablewrap, .mwrap, .rgrid')) {
            if (wrap.scrollWidth > wrap.clientWidth + 1) out.push(`sideways ${wrap.className} ${wrap.scrollWidth}>${wrap.clientWidth}`);
          }
          for (const table of document.querySelectorAll('.tablewrap table')) {
            const t = table.getBoundingClientRect();
            const p = (table.closest('.panel') as HTMLElement).getBoundingClientRect();
            if (t.right > p.right + 1) out.push(`table sticks out of its panel ${t.right.toFixed(1)}>${p.right.toFixed(1)}`);
          }
          for (const heading of document.querySelectorAll('.panel .ph')) {
            const panel = heading.closest('.panel')!.getBoundingClientRect();
            for (const child of heading.children) if (child.getBoundingClientRect().right > panel.right + 1) out.push(`panel heading overflows: ${child.textContent}`);
          }
          const pop = document.querySelector('table[aria-labelledby="pop-heading"]');
          const widths = pop ? [...pop.querySelectorAll('thead th')].map((th) => Math.round(th.getBoundingClientRect().width * 10) / 10) : [];
          const labels: string[] = [];
          for (const head of document.querySelectorAll('[data-testid="variable-row"]')) {
            const holder = head.closest('table, .rcol');
            const chrom = holder?.querySelector('tbody tr .bits.vars, .rrow .bits.vars');
            if (!chrom) continue;
            const labelBoxes = [...head.querySelectorAll('.vlab')].map((el) => el.getBoundingClientRect());
            const groups = [...chrom.querySelectorAll('.vgrp')].map((el) => el.getBoundingClientRect());
            if (labelBoxes.length !== groups.length) out.push(`variable labels ${labelBoxes.length} vs groups ${groups.length}`);
            labelBoxes.forEach((l, k) => {
              const g = groups[k];
              if (g && (Math.abs(l.left - g.left) > 1.5 || Math.abs(l.width - g.width) > 1.5)) out.push(`variable label ${k + 1} at ${l.left.toFixed(1)}+${l.width.toFixed(1)} vs ${g.left.toFixed(1)}+${g.width.toFixed(1)}`);
            });
            labels.push(`${labelBoxes.length}`);
          }
          if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
          return { out, widths };
        });
      const first = await measure();
      expect(first.out, 'population at the start').toEqual([]);
      expect(first.widths.length).toBeGreaterThan(2);
      expect(await popRows(page)).toEqual(engineRows(options, 0));
      const seen: number[][] = [first.widths];
      const snapshot = async (what: string) => {
        const m = await measure();
        expect(m.out, what).toEqual([]);
        seen.push(m.widths);
      };
      await page.keyboard.press('g');
      await snapshot('population after one generation');
      expect(await popRows(page)).toEqual(engineRows(options, 1));
      await page.keyboard.press('g');
      await snapshot('population after two generations');
      expect(await popRows(page)).toEqual(engineRows(options, 2));
      // through the stages of the next generation: parents, evaluation and replacement as well
      await page.keyboard.press('ArrowRight');
      await snapshot('selection');
      for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
      for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
      await snapshot('evaluation');
      await page.keyboard.press('Shift+ArrowRight');
      await snapshot('replacement');
      for (const widths of seen.slice(1)) {
        expect(widths.length).toBe(first.widths.length);
        widths.forEach((w, k) => expect(Math.abs(w - first.widths[k]!), `column ${k + 1} width ${w} vs ${first.widths[k]}`).toBeLessThanOrEqual(1.5));
      }
    });
  }
}

test('every chromosome in the population table has a name and a sentence, for the pair and for the bits, and the variable row has one sentence', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { function: 'single-peak', representation: 'real', bitsPerVariable: 10 });
  const real = await page.getByRole('table', { name: /^Population/ }).locator('tbody [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(real).toHaveLength(8);
  expect(real[0]).toBe('Chromosome x = −5.000, y = −5.000');
  expect(real[2]).toBe('Chromosome x = 0.000, y = 0.000');
  expect(real.every((l) => /^Chromosome x = −?\d+\.\d{3}, y = −?\d+\.\d{3}$/.test(l!))).toBe(true);
  await open(page, { function: 'single-peak', representation: 'plain', bitsPerVariable: 4 });
  const bits = await page.getByRole('table', { name: /^Population/ }).locator('tbody [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(bits[0]).toBe('Chromosome x bits 0000, y bits 0000, decodes to x = −5.000, y = −5.000');
  expect(bits[1]).toBe('Chromosome x bits 1111, y bits 1111, decodes to x = 5.000, y = 5.000');
  await expect(page.getByTestId('variable-row').first()).toHaveAttribute('aria-label', 'Variables: the first 4 bits are x and the next 4 are y; each is read as a whole number in plain binary and scaled onto −5 to 5.');
});

test('the table shows the columns of its representation: the pair and fitness, or the bits with their decoded x and y', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const headers = () => page.getByRole('table', { name: /^Population/ }).locator('thead th').allInnerTexts();
  await open(page, { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 });
  expect((await headers()).map((h) => h.split('\n')[0])).toEqual(['#', 'CHROMOSOME', 'F(X, Y)', 'FITNESS']);
  await expect(page.getByTestId('variable-row').first()).toContainText('(x, y)');
  await open(page, { function: 'single-peak', representation: 'gray', bitsPerVariable: 10 });
  expect((await headers()).map((h) => h.split('\n')[0])).toEqual(['#', 'CHROMOSOME', 'X', 'Y', 'FITNESS']);
});

test('the other problems’ tables are unchanged: no variable row, no pair', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('variable-row')).toHaveCount(0);
  await expect(page.locator('.bits.pair, .bits.vars')).toHaveCount(0);
});

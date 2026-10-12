import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeProblem, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const base: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 };

/** Extreme data on purpose: both bounds, zero, mixed signs, the longest numbers. */
const extremes = (options: LandscapeOptions): string[] => {
  if (options.representation === 'real') return ['-5 -5', '5 5', '0 0', '-5 5', '4.999 -0.001', '2 -1', '-3.141 2.718', '0.5 -4.5', '5 5', '-5 -5', '0 0', '2 -1'];
  const n = options.bitsPerVariable;
  const ones = '1'.repeat(n);
  const zeros = '0'.repeat(n);
  const alt = '10'.repeat(n).slice(0, n);
  return [zeros + zeros, ones + ones, ones + zeros, zeros + ones, alt + alt, '1' + '0'.repeat(n - 1) + '0' + '1'.repeat(n - 1), '0' + '1'.repeat(n - 1) + '1' + '0'.repeat(n - 1), alt + zeros, ones + ones, zeros + zeros, ones + zeros, zeros + ones];
};
const open = async (page: Page, options: LandscapeOptions = base, size = 12, projector = true, extreme = false) => {
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  const init = extreme ? { kind: 'explicit' as const, chromosomes: extremes(options) } : { kind: 'random' as const, size };
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init }, d.params, 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const showLandscape = async (page: Page) => {
  await page.getByTestId('show-landscape').click();
  await expect(page.getByTestId('heat-marks')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};

/** Every function, both representations, 12 and 60 individuals, and extreme data. */
const cases: [string, LandscapeOptions, number, boolean][] = [
  ['single peak, real, 12', { function: 'single-peak', representation: 'real', bitsPerVariable: 10 }, 12, false],
  ['two peaks, Gray, 60', { function: 'two-peaks', representation: 'gray', bitsPerVariable: 10 }, 60, false],
  ['Rastrigin, real, 60', { function: 'rastrigin', representation: 'real', bitsPerVariable: 10 }, 60, false],
  ['Himmelblau, plain, 12', { function: 'himmelblau', representation: 'plain', bitsPerVariable: 10 }, 12, false],
  ['Himmelblau, real, extreme data', { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 }, 12, true],
  ['Rastrigin, Gray, extreme data', { function: 'rastrigin', representation: 'gray', bitsPerVariable: 12 }, 12, true],
];

test('every individual is named by its numbers, the pictures by a sentence, and the positions are in a real table that equals the engine’s', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  const problem = landscapeProblem(base);
  const d = defaultsOf(entry, base);
  const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 12 } }, params: d.params, seed: 7 });
  for (let g = 0; g < 3; g++) {
    await page.keyboard.press('g');
    run.forwardCycle();
  }
  const table = page.getByRole('table', { name: /^Population · generation 3$/ });
  await expect(table.getByRole('columnheader')).toContainText(['#', 'Chromosome']);
  const labels = await table.locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => [el.getAttribute('role'), el.getAttribute('aria-label')]));
  expect(labels.map((l) => l[0])).toEqual(Array(12).fill('img'));
  expect(labels.every((l) => /^Chromosome x = −?\d+(\.\d+)?, y = −?\d+(\.\d+)?/.test(l[1]!))).toBe(true);
  await showLandscape(page);
  const sentence = await page.getByTestId('landscape-sentence').innerText();
  expect(sentence).toMatch(/[Hh]igher is (always )?better/);
  expect(sentence).toMatch(/optim(um|a)/);
  expect(await page.locator('.heatwrap').getAttribute('aria-label')).toBe(sentence);
  await expect(page.getByTestId('surface-focus')).toHaveAttribute('aria-label', /^Surface of the same landscape\. Rotate with the arrow keys/);
  await expect(page.getByTestId('heat-marks')).toHaveAttribute('aria-label', /^Individuals on the heatmap\. Left and right arrows/);
  const rows = await page.getByRole('table', { name: 'Positions of the individuals' }).locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent)));
  const state = run.snapshot(3).state.population;
  expect(rows).toHaveLength(12);
  rows.forEach((r, k) => {
    const point = problem.pointOf(state[k]!.chromosome);
    expect(Number(r[0])).toBe(state[k]!.id);
    expect(Number(r[1])).toBeCloseTo(point.x, 2);
    expect(Number(r[2])).toBeCloseTo(point.y, 2);
    expect(Number(r[3])).toBeCloseTo(state[k]!.fitness, 2);
  });
  expect(await page.getByRole('table', { name: 'Positions of the individuals' }).getByRole('columnheader').allTextContents()).toEqual(['Individual', 'x', 'y', 'Fitness', 'Role']);
});

test('a full generation can be stepped through with the keyboard alone, from the problem menu, with the landscape view open, the surface turned and an individual selected', async ({ page }) => {
  await page.goto(url);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('problem-button')).toBeFocused();
  await page.keyboard.press('Enter');
  for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: /Landscape/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reset-notice')).toBeVisible();
  while (!(await page.getByRole('button', { name: 'Restart and apply' }).evaluate((el) => el === document.activeElement))) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  // Tab to the stage view's tab for the landscape and open it with the keyboard
  for (let k = 0; k < 60; k++) {
    if (await page.getByTestId('show-landscape').evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(page.getByTestId('show-landscape')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('heat-marks')).toBeVisible();
  // Tab on through the toolbar to the heatmap's marks, then to the surface; both are reached and named
  const reach = async (testid: string) => {
    for (let k = 0; k < 40; k++) {
      if (await page.getByTestId(testid).evaluate((el) => el === document.activeElement)) return;
      await page.keyboard.press('Tab');
    }
    throw new Error(`Tab never reached ${testid}`);
  };
  await reach('heat-marks');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-testid="heat-marks"] [data-selected="true"]')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  const selected = await page.locator('[data-testid="heat-marks"] [data-selected="true"]').getAttribute('data-id');
  await expect(page.getByTestId(`select-${selected}`)).toHaveAttribute('aria-pressed', 'true');
  await reach('surface-focus');
  const before = await page.getByTestId('surface').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await page.getByTestId('surface').evaluate((c) => (c as HTMLCanvasElement).toDataURL())).not.toBe(before);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // one whole generation with the keys, stage by stage, the landscape view still open
  await page.keyboard.press('ArrowRight');
  for (const stage of ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation']) {
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.getByTestId('ribbon').locator('li[aria-current="step"]')).toContainText(stage);
  }
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  await expect(page.getByTestId('ribbon').locator('li.done')).toHaveCount(6);
  await expect(page.getByTestId('heat-marks')).toBeVisible();
});

for (const representation of ['real', 'gray'] as const) {
  test(`${representation}: the problem menu, the drawer, the landscape view and a selection, open, leave no control without a name`, async ({ page }) => {
    await open(page, { ...base, representation });
    expect(await unnamed(page)).toEqual([]);
    await page.getByTestId('problem-button').click();
    await expect(page.getByRole('menuitemradio', { name: /Landscape/ })).toHaveAttribute('aria-checked', 'true');
    expect(await unnamed(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Parameters/ }).click();
    expect(await unnamed(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await showLandscape(page);
    expect(await unnamed(page)).toEqual([]);
    await page.getByTestId('select-' + (await page.locator('.idbtn').first().getAttribute('data-testid'))!.replace('select-', '')).click();
    await page.getByTestId('trail-3').click();
    expect(await unnamed(page)).toEqual([]);
    for (const name of ['Rotate the surface left', 'Rotate the surface right']) await expect(page.getByRole('button', { name })).toBeVisible();
  });
}

test('every meaning that has a colour has something else as well: shapes and labels for the marks, a ring and a cross for the selection, the words of the key and of the sentences', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { ...base, function: 'two-peaks' }, 12);
  await page.keyboard.press('g');
  await showLandscape(page);
  // the key names every mark by its shape
  const key = await page.locator('.lkey').innerText();
  for (const word of ['● individual', '◆ elite', '★ best', '▢ parent (A, B)', '▲ offspring', '◉ selected']) expect(key).toContain(word);
  const shapes = await page.locator('[data-testid="heat-marks"] [data-marker="individual"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-shape')));
  expect(shapes).toContain('diamond');
  expect(shapes).toContain('circle');
  expect(shapes.every((shape) => ['circle', 'diamond', 'star'].includes(shape!))).toBe(true);
  // every individual has its number beside it (up to 16 are labelled), so no mark is identified by colour alone
  const labelled = await page.locator('[data-testid="heat-marks"] [data-marker="individual"]').evaluateAll((els) => els.map((el) => el.querySelector('text')?.textContent ?? ''));
  expect(labelled.every((t) => /^\d+/.test(t))).toBe(true);
  // the selected one: a ring and a cross, the pressed button and the sentence
  await page.getByTestId(`select-${await page.locator('[data-testid="heat-marks"] [data-marker="individual"]').first().getAttribute('data-id')}`).click();
  await expect(page.locator('[data-testid="heat-marks"] .ring')).toHaveCount(1);
  await expect(page.locator('[data-testid="heat-marks"] .cross')).toHaveCount(1);
  await expect(page.getByTestId('population-sentence')).toContainText('is selected');
  // parents are squares marked A and B, offspring triangles, at the crossover stage
  const lettered = () => page.locator('[data-testid="heat-marks"] [data-shape="square"] text').filter({ hasText: /[AB]/ }).count();
  for (let k = 0; k < 120 && (await lettered()) === 0; k++) await page.keyboard.press('ArrowRight');
  const stage = await page.locator('[data-testid="heat-marks"] [data-marker]').evaluateAll((els) => els.map((el) => [el.getAttribute('data-marker'), el.getAttribute('data-shape'), el.querySelector('text')?.textContent ?? '']));
  expect(stage.some((s) => s[1] === 'square' && /[AB]/.test(s[2]!))).toBe(true);
  // the rules of the marks: a ridge-hidden mark is a dashed ring, trail dots are smaller than marks and carry their generation
  const css = await page.evaluate(() => [...document.styleSheets].flatMap((s) => [...s.cssRules]).map((r) => r.cssText).filter((t) => /\.ghost/.test(t)).join(' '));
  expect(css).toMatch(/dasharray/);
  await page.getByTestId('trail-3').click();
  expect(await page.locator('[data-testid="heat-marks"] .trail').count()).toBeGreaterThan(0);
  const sizes = await page.evaluate(() => ({ dot: Number(document.querySelector('[data-testid="heat-marks"] .trail circle')?.getAttribute('r') ?? 0), mark: Number(document.querySelector('[data-testid="heat-marks"] .mk .body')?.getAttribute('r') ?? 99) }));
  expect(sizes.dot).toBeLessThan(sizes.mark === 99 ? 99 : Math.max(sizes.mark, 7));
  await expect(page.getByRole('group', { name: 'Trails: earlier generations as fading dots' })).toBeVisible();
  // the minimised functions say it in words
  await open(page, { ...base, function: 'rastrigin' }, 12);
  await showLandscape(page);
  await expect(page.locator('.lview figcaption').first()).toContainText('fitness = −f, higher is better');
  await expect(page.getByTestId('landscape-sentence')).toContainText('higher is always better');
  // the panel under the stage names the same: an optimum line labelled in words, and the legend "fitness = −f"
  await expect(page.locator('[data-plot="fitness"] text', { hasText: /^optimum/ })).toHaveCount(1);
  await expect(page.locator('.plot .legend').first()).toContainText('fitness = −f');
});

test('with reduced motion, nothing on the landscape screens animates or transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  await showLandscape(page);
  await page.getByTestId('trail-3').click();
  await page.getByTestId('rotate-right').click();
  const durations = () => page.evaluate(() => [...document.querySelectorAll('.mk, .marks *, .lview *, .spread *, canvas, .bit, .card, button, tr, svg *')].map((el) => getComputedStyle(el)).map((s) => `${s.transitionDuration}|${s.animationName}`));
  const stage = await durations();
  expect(stage.length).toBeGreaterThan(200);
  expect(stage.every((d) => /^0s(, 0s)*\|none$/.test(d))).toBe(true);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByTestId('show-stage').click();
  const stageView = await durations();
  expect(stageView.every((d) => /^0s(, 0s)*\|none$/.test(d))).toBe(true);
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options, size, extreme] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: every stage, the landscape view, the drawer and the menu fit, nothing overlaps and nothing scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options, size, true, extreme);
      const check = async (what: string) => {
        const o = await page.evaluate(() => {
          const panels = [...document.querySelectorAll('section.panel')].filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => ({ name: el.getAttribute('aria-labelledby') ?? el.className, r: el.getBoundingClientRect() }));
          const overlaps: string[] = [];
          for (let a = 0; a < panels.length; a++) {
            for (let b = a + 1; b < panels.length; b++) {
              const p = panels[a]!.r;
              const q = panels[b]!.r;
              if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) overlaps.push(`${panels[a]!.name} and ${panels[b]!.name}`);
            }
          }
          const clipped = [...document.querySelectorAll('.lview, .lplots figure, .spread, .plot .summary, .plot .ph, .tablewrap, .ccard, .mwrap, .cgrid, .rgrid')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.className} ${el.scrollWidth}>${el.clientWidth}`);
          const outside = [...document.querySelectorAll('.lview canvas, .marks, .lview .lbar button')].filter((el) => {
            const r = el.getBoundingClientRect();
            const panel = el.closest('section.panel')?.getBoundingClientRect();
            return panel ? r.right > panel.right + 1 || r.bottom > panel.bottom + 1 || r.left < panel.left - 1 : false;
          }).map((el) => el.className.toString());
          return {
            x: document.documentElement.scrollWidth - window.innerWidth,
            y: document.documentElement.scrollHeight - window.innerHeight,
            canvas: document.querySelector('.canvas')!.getBoundingClientRect().toJSON(),
            overlaps,
            clipped,
            outside,
          };
        });
        expect(o.x, `${what}: page overflows sideways`).toBeLessThanOrEqual(0);
        expect(o.y, `${what}: page overflows downwards`).toBeLessThanOrEqual(0);
        expect(o.canvas.right).toBeLessThanOrEqual(width + 1);
        expect(o.canvas.bottom).toBeLessThanOrEqual(height + 1);
        expect(o.overlaps, `${what}: panels overlap`).toEqual([]);
        expect(o.clipped, `${what}: something scrolls sideways`).toEqual([]);
        expect(o.outside, `${what}: something leaves its panel`).toEqual([]);
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
      await showLandscape(page);
      await check('with the landscape view');
      await page.getByTestId('trail-5').click();
      await page.getByTestId('zoom-toggle').click();
      await check('with the landscape view zoomed, with trails');
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
      await open(page, options, size, true, extreme);
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

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const projector of [true, false]) {
    test(`at ${width}×${height}${projector ? ' in projector mode' : ''}, the title, the chips and the subtitle stay inside the brand box and never run into the stage ribbon, for every function and with the longest preset name`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const fn of ['single-peak', 'two-peaks', 'rastrigin', 'himmelblau'] as const) {
        await open(page, { ...base, function: fn, representation: fn === 'himmelblau' ? 'gray' : 'real' }, 12, projector);
        for (const preset of [undefined, 'Himmelblau: four optima']) {
          if (preset) {
            await page.getByRole('button', { name: /Parameters/ }).click();
            await page.locator('#preset').selectOption({ label: preset });
            await page.getByTestId('load-preset').click();
            await page.getByRole('button', { name: 'Restart and apply' }).click();
            await page.keyboard.press('Escape');
            await expect(page.locator('#brand')).toContainText(`preset: ${preset}`);
          }
          const problems = await page.evaluate(() => {
            const out: string[] = [];
            const brand = document.querySelector('#brand')!.getBoundingClientRect();
            const ribbon = document.querySelector('#ribbon')!.getBoundingClientRect();
            if (brand.right > ribbon.left + 1) out.push('the brand runs into the ribbon');
            if (ribbon.right > document.querySelector('#gen')!.getBoundingClientRect().left + 1) out.push('the ribbon runs into the generation counter');
            for (const li of document.querySelectorAll('#ribbon li')) if (li.scrollWidth > li.clientWidth + 1) out.push(`the stage "${li.textContent!.trim()}" does not fit its pill`);
            for (const el of document.querySelectorAll('#brand *')) {
              const r = el.getBoundingClientRect();
              if (r.width === 0) continue;
              if (r.right > brand.right + 1 || r.left < brand.left - 1) out.push(`${el.className || el.tagName} leaves the brand box (${Math.round(r.right)} > ${Math.round(brand.right)})`);
              if (r.bottom > document.querySelector('#top')!.getBoundingClientRect().bottom + 1) out.push(`${el.className || el.tagName} leaves the top bar`);
            }
            return out;
          });
          expect(problems, `${fn} ${preset ?? ''}`).toEqual([]);
        }
      }
    });
  }
}

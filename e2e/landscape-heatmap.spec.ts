import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { landscapeFunctions, landscapeProblem, type LandscapeFunction, type LandscapeOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { heatLayout, pixelOf, pointAt } from '../src/ui/heatmap-draw';
import { colourAt, fitnessGrid, isolineLevels, isolines, landscapeSentence, zoomRegion } from '../src/ui/landscape-grid';
import { landscapeInfoOf } from '../src/ui/landscape-context';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;

const open = async (page: Page, options: LandscapeOptions, size = 12, projector = false) => {
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size } }, d.params, 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const showLandscape = async (page: Page) => {
  await page.getByTestId('show-landscape').click();
  await expect(page.getByTestId('heatmap')).toBeVisible();
};
const options = (fn: LandscapeFunction, representation: LandscapeOptions['representation'] = 'real'): LandscapeOptions => ({ function: fn, representation, bitsPerVariable: 8 });

/** The colour of canvas pixels, read from the page. */
const pixels = (page: Page, at: [number, number][]) =>
  page.getByTestId('heatmap').evaluate((canvas, points) => {
    const ctx = (canvas as HTMLCanvasElement).getContext('2d')!;
    return points.map(([x, y]) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)]);
  }, at);
const geometry = async (page: Page) => {
  const attr = async (name: string) => (await page.getByTestId('heatmap').getAttribute(name))!.split(',').map(Number);
  const [L, T, R, B] = await attr('data-plot');
  const [x0, x1, y0, y1] = await attr('data-region');
  return { layout: { L: L!, T: T!, R: R!, B: B! }, region: { x0: x0!, x1: x1!, y0: y0!, y1: y1! } };
};

test('the stage panel has a second view, Landscape, only for a landscape; the narration stays visible and the other problems have no such tab', async ({ page }) => {
  await open(page, options('single-peak'));
  await expect(page.getByTestId('show-stage')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('heatmap')).toHaveCount(0);
  await showLandscape(page);
  await expect(page.getByTestId('show-landscape')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#stage-heading')).toHaveText('Landscape');
  await expect(page.getByTestId('narration')).toBeVisible();
  await page.getByTestId('show-stage').click();
  await expect(page.getByTestId('heatmap')).toHaveCount(0);
  await page.goto(url);
  await expect(page.getByTestId('show-landscape')).toHaveCount(0);
  await expect(page.getByTestId('heatmap')).toHaveCount(0);
});

for (const fn of landscapeFunctions) {
  test(`${fn}: every pixel of the heatmap is the colour of the engine's fitness at the point it stands for; the optimum is the top of the ramp and the worst corner the bottom`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await open(page, options(fn));
    await showLandscape(page);
    const info = landscapeInfoOf(landscapeProblem(options(fn)));
    const { layout, region } = await geometry(page);
    expect(layout).toEqual(heatLayout(520, 300));
    const levels = isolineLevels(info.fitnessRange);
    const range = info.fitnessRange.max - info.fitnessRange.min;
    const optimumPixel = pixelOf(layout, region, info.optima[0]!.x, info.optima[0]!.y);

    // the isolines as the page draws them, in canvas pixels, to know which pixels are lines or labels
    const segments = isolines(fitnessGrid(info, region, 121, 121), levels).flat().map(([x1, y1, x2, y2]) => {
      const a = pixelOf(layout, region, x1, y1);
      const b = pixelOf(layout, region, x2, y2);
      return [a.px, a.py, b.px, b.py] as const;
    });
    const nearLine = (px: number, py: number) => {
      let best = Infinity;
      for (const [x1, y1, x2, y2] of segments) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        best = Math.min(best, Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)));
      }
      return best;
    };

    // 600 pixels spread over the plot, leaving out those next to an isoline or a mark
    const wanted: [number, number][] = [];
    for (let k = 0; k < 600; k++) {
      const px = layout.L + 3 + ((k * 37) % (layout.R - layout.L - 6));
      const py = layout.T + 3 + ((k * 91) % (layout.B - layout.T - 6));
      if (nearLine(px, py) < 4) continue;
      if (info.optima.some((o) => Math.hypot(pixelOf(layout, region, o.x, o.y).px - px, pixelOf(layout, region, o.x, o.y).py - py) < 70)) continue;
      wanted.push([Math.round(px), Math.round(py)]);
    }
    expect(wanted.length).toBeGreaterThan(40); // Rastrigin is crossed by isolines almost everywhere
    const got = await pixels(page, wanted);
    let wrong = 0;
    wanted.forEach(([px, py], k) => {
      const p = pointAt(layout, region, px, py);
      const [r, g, b] = colourAt(info.fitnessAt(p.x, p.y), info.fitnessRange.min, info.fitnessRange.max);
      const off = got[k]!.some((v, c) => Math.abs(v - [r, g, b][c]!) > 2);
      if (off) {
        wrong++;
        // the only thing drawn over the colours besides the lines is a level's label, which sits on its line
        expect(nearLine(px, py), `pixel ${px},${py} differs from the engine's colour and is not by an isoline label`).toBeLessThan(30);
      }
    });
    expect(wrong / wanted.length, 'pixels hidden by labels').toBeLessThan(0.1);

    // beside the optimum (clear of its mark) the colour is the top of the ramp; at the worst corner, the bottom
    const sampleX = Math.round(optimumPixel.px + 6);
    const sampleY = Math.round(optimumPixel.py);
    const [near] = await pixels(page, [[sampleX, sampleY]]);
    const nearPoint = pointAt(layout, region, sampleX, sampleY);
    const top = colourAt(info.fitnessAt(nearPoint.x, nearPoint.y), info.fitnessRange.min, info.fitnessRange.max);
    near!.forEach((v, c) => expect(Math.abs(v - top[c]!)).toBeLessThanOrEqual(2));
    const luma = (c: readonly number[]) => 0.299 * c[0]! + 0.587 * c[1]! + 0.114 * c[2]!;
    expect(luma(near!)).toBeGreaterThan(0.75 * 255 * 0.85); // a light yellow, the top of the ramp (not a dark colour)
    const corners: [number, number][] = [[layout.L + 1, layout.T + 1], [layout.R - 3, layout.T + 1], [layout.L + 1, layout.B - 3], [layout.R - 3, layout.B - 3]];
    const worst = corners.reduce((best, c) => (info.fitnessAt(pointAt(layout, region, c[0], c[1]).x, pointAt(layout, region, c[0], c[1]).y) < info.fitnessAt(pointAt(layout, region, best[0], best[1]).x, pointAt(layout, region, best[0], best[1]).y) ? c : best), corners[0]!);
    const [bottom] = await pixels(page, [worst]);
    expect(luma(bottom!)).toBeLessThan(luma(near!) - 60);
  });
}

test('the optimum is marked ✕ in white with a dark outline at its pixel; Himmelblau marks four; the colour scale runs from dark at the bottom to light at the top', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, options('himmelblau'));
  await showLandscape(page);
  const info = landscapeInfoOf(landscapeProblem(options('himmelblau')));
  const { layout, region } = await geometry(page);
  const marks = info.optima.map((o) => pixelOf(layout, region, o.x, o.y));
  const centres = await pixels(page, marks.map((m) => [m.px, m.py] as [number, number]));
  centres.forEach((c) => c.forEach((v) => expect(v).toBeGreaterThan(235))); // the crossing of the white strokes
  const scaleX = layout.R + 18 + 8;
  const [top, bottom] = await pixels(page, [[scaleX, layout.T + 4], [scaleX, layout.B - 4]]);
  expect(0.299 * top![0]! + 0.587 * top![1]! + 0.114 * top![2]!).toBeGreaterThan(0.299 * bottom![0]! + 0.587 * bottom![1]! + 0.114 * bottom![2]! + 100);
});

test('Zoom to population rescales the heatmap to the population’s box plus a margin, says so, and keeps the optimum mark when it is inside', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const opts = options('single-peak');
  const d = defaultsOf(entry, opts);
  // a population in a small box around the optimum (2, −1)
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(opts), init: { kind: 'explicit', chromosomes: ['1.5 -1.5', '2.5 -0.5', '2 -1', '1.8 -0.7'] } }, d.params, 7, 'landscape', opts)));
  await showLandscape(page);
  await expect(page.getByTestId('zoom-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect((await geometry(page)).region).toEqual({ x0: -5, x1: 5, y0: -5, y1: 5 });
  await page.getByTestId('zoom-toggle').click();
  await expect(page.getByTestId('zoom-toggle')).toHaveAttribute('aria-pressed', 'true');
  const want = zoomRegion([{ x: 1.5, y: -1.5 }, { x: 2.5, y: -0.5 }, { x: 2, y: -1 }, { x: 1.8, y: -0.7 }], { lo: -5, hi: 5 });
  const { layout, region } = await geometry(page);
  expect(region.x0).toBeCloseTo(want.x0, 9);
  expect(region.x1).toBeCloseTo(want.x1, 9);
  expect(region.y0).toBeCloseTo(want.y0, 9);
  expect(region.y1).toBeCloseTo(want.y1, 9);
  await expect(page.getByTestId('landscape-sentence')).toContainText('Zoomed to the population: x from 1.3 to 2.7, y from −1.7 to −0.3');
  const info = landscapeInfoOf(landscapeProblem(opts));
  const mark = pixelOf(layout, region, 2, -1);
  expect(mark.px).toBeGreaterThan(layout.L);
  expect(mark.px).toBeLessThan(layout.R);
  const [centre] = await pixels(page, [[mark.px, mark.py]]);
  centre!.forEach((v) => expect(v).toBeGreaterThan(235)); // the optimum mark is still there
  // and the picture is the engine's over the new region
  const probe: [number, number] = [layout.L + 40, layout.T + 40];
  const p = pointAt(layout, region, probe[0], probe[1]);
  const [pix] = await pixels(page, [probe]);
  const expected = colourAt(info.fitnessAt(p.x, p.y), info.fitnessRange.min, info.fitnessRange.max);
  pix!.forEach((v, c) => expect(Math.abs(v - expected[c]!)).toBeLessThanOrEqual(2));
  await page.getByTestId('zoom-toggle').click();
  expect((await geometry(page)).region).toEqual({ x0: -5, x1: 5, y0: -5, y1: 5 });
  await expect(page.getByTestId('landscape-sentence')).not.toContainText('Zoomed');
});

test('the picture has a text alternative: its name is the sentence under it, naming the function, bounds, optimum and fitness range', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, options('rastrigin'));
  await showLandscape(page);
  const info = landscapeInfoOf(landscapeProblem(options('rastrigin')));
  const sentence = landscapeSentence(info, { x0: -5.12, x1: 5.12, y0: -5.12, y1: 5.12 }, false);
  await expect(page.getByTestId('landscape-sentence')).toHaveText(sentence);
  await expect(page.getByRole('img', { name: sentence })).toBeVisible();
  expect(sentence).toContain('Rastrigin');
  expect(sentence).toContain('fitness = −f');
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const projector of [false, true]) {
    test(`at ${width}×${height}${projector ? ' in projector mode' : ''}: the landscape view fits its panel for every function, zoomed and not, with the narration inside its box`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const fn of landscapeFunctions) {
        await open(page, options(fn), 12, projector);
        await showLandscape(page);
        for (const zoom of [false, true]) {
          if (zoom) await page.getByTestId('zoom-toggle').click();
          const problems = await page.evaluate(() => {
            const out: string[] = [];
            const body = document.querySelector('#stagebody')!.getBoundingClientRect();
            const narr = document.querySelector('#narr')!.getBoundingClientRect();
            for (const el of document.querySelectorAll('.lview, .lview canvas, .lview .lsent, .lview .lbar')) {
              const r = el.getBoundingClientRect();
              if (r.right > body.right + 1 || r.bottom > body.bottom + 1 || r.left < body.left - 1) out.push(`${el.className} leaves the stage body`);
              if (r.bottom > narr.top + 1 && r.top < narr.bottom) out.push(`${el.className} runs into the narration`);
            }
            const view = document.querySelector('.lview')!;
            if (view.scrollHeight > view.clientHeight + 1) out.push(`view scrolls ${view.scrollHeight}>${view.clientHeight}`);
            if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
            return out;
          });
          expect(problems, `${fn}${zoom ? ' zoomed' : ''}`).toEqual([]);
        }
      }
    });
  }
}

test('stepping keeps the view and its zoom; a restart returns to the stage view with the zoom off', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, options('two-peaks'));
  await showLandscape(page);
  await page.getByTestId('zoom-toggle').click();
  await page.keyboard.press('g');
  await expect(page.getByTestId('heatmap')).toBeVisible();
  await expect(page.getByTestId('zoom-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /New/ }).click();
  await expect(page.getByTestId('heatmap')).toHaveCount(0);
  await showLandscape(page);
  await expect(page.getByTestId('zoom-toggle')).toHaveAttribute('aria-pressed', 'false');
});

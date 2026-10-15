import { expect, test, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeProblem, metricsOfProblem, type GaParams, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { statsLines } from '../src/ui/spread-model';
import { heatLayout, pointAt } from '../src/ui/heatmap-draw';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const himmelblau: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 };
const rastrigin: LandscapeOptions = { function: 'rastrigin', representation: 'gray', bitsPerVariable: 8 };

const paramsOf = (options: LandscapeOptions): GaParams => ({ ...defaultsOf(entry, options).params, elites: 2 });
const open = async (page: Page, options: LandscapeOptions = himmelblau, projector = false, focus = true) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size: 14 } }, paramsOf(options), 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-landscape').click();
  if (focus) {
    await page.getByTestId('focus-toggle').click();
    await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};
const engine = (options: LandscapeOptions = himmelblau) => createRun(gaAlgorithm, { setup: { problem: landscapeProblem(options), init: { kind: 'random', size: 14 } }, params: paramsOf(options), seed: 7 });

type Box = { left: number; top: number; width: number; height: number };
const designBoxes = (page: Page, selectors: Record<string, string>) =>
  page.evaluate((sels) => {
    const c = document.querySelector('main.canvas')!.getBoundingClientRect();
    const k = c.width / 1920;
    const out: Record<string, { left: number; top: number; width: number; height: number }> = {};
    for (const [name, sel] of Object.entries(sels)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[name] = { left: (r.left - c.left) / k, top: (r.top - c.top) / k, width: r.width / k, height: r.height / k };
    }
    return out;
  }, selectors);
const apart = (a: Box, b: Box) => a.left + a.width <= b.left + 0.5 || b.left + b.width <= a.left + 0.5 || a.top + a.height <= b.top + 0.5 || b.top + b.height <= a.top + 0.5;
const within = (inner: Box, outer: Box, tol = 0.5) => inner.left >= outer.left - tol && inner.top >= outer.top - tol && inner.left + inner.width <= outer.left + outer.width + tol && inner.top + inner.height <= outer.top + outer.height + tol;
const sels = {
  panel: '[data-testid="stage-panel"]',
  body: '#stagebody',
  heat: 'canvas[data-testid="heatmap"]',
  surface: 'canvas[data-testid="surface"]',
  toolbar: '[data-testid="focus-toolbar"]',
  card: '[data-testid="focus-card"]',
  graph: '[data-testid="focus-graph"]',
  narr: '#narr',
};
const heat = (page: Page) => page.getByTestId('heatmap');
const surface = (page: Page) => page.getByTestId('surface');
const regionOf = async (page: Page) => {
  const [x0, x1, y0, y1] = ((await heat(page).getAttribute('data-region')) ?? '').split(',').map(Number);
  return { x0: x0!, x1: x1!, y0: y0!, y1: y1! };
};
const layoutOf = async (page: Page) => {
  const [L, T, R, B] = ((await heat(page).getAttribute('data-plot')) ?? '').split(',').map(Number);
  return { L: L!, T: T!, R: R!, B: B! };
};
const near = (a: number, b: number, tol: number, what: string) => expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(tol);
/** The page position of a canvas pixel of the heatmap. */
const heatPage = async (page: Page, px: number, py: number) => {
  const r = (await heat(page).boundingBox())!;
  const clientLeft = await heat(page).evaluate((c) => c.clientLeft);
  return { x: r.x + clientLeft + px, y: r.y + clientLeft + py };
};
const markers = (page: Page, layer: 'heat-marks' | 'surface-marks') =>
  page.getByTestId(layer).evaluate((svg) =>
    [...svg.querySelectorAll('[data-marker="individual"]')].map((g) => ({ id: Number(g.getAttribute('data-id')), x: Number(g.getAttribute('data-x')), y: Number(g.getAttribute('data-y')) })),
  );

test('the heatmap and the surface side by side, each about twice the area it has in the ordinary view, in the whole panel', async ({ page }) => {
  await open(page, himmelblau, false, false);
  const small = await designBoxes(page, sels);
  expect(small.heat!.width).toBeLessThan(540);
  await page.getByTestId('focus-toggle').click();
  const b = await designBoxes(page, sels);
  for (const name of ['heat', 'surface'] as const) {
    expect(b[name]!.width * b[name]!.height, name).toBeGreaterThan(1.9 * small[name]!.width * small[name]!.height);
    expect(within(b[name]!, b.body!), `${name} inside the body`).toBe(true);
  }
  expect(b.heat!.left + b.heat!.width).toBeLessThanOrEqual(b.surface!.left + 0.5);
  expect(Math.abs(b.heat!.top - b.surface!.top)).toBeLessThan(4);
  // none of the overlays lies over a figure, and the overlays are apart
  for (const name of ['toolbar', 'card', 'graph'] as const) {
    expect(b[name], name).toBeDefined();
    expect(within(b[name]!, b.body!), `${name} inside the body`).toBe(true);
    expect(apart(b[name]!, b.heat!), `${name} and the heatmap`).toBe(true);
    expect(apart(b[name]!, b.surface!), `${name} and the surface`).toBe(true);
  }
  expect(apart(b.toolbar!, b.card!)).toBe(true);
  expect(apart(b.toolbar!, b.graph!)).toBe(true);
  expect(apart(b.card!, b.graph!)).toBe(true);
  await page.getByTestId('focus-toggle').click();
  const back = await designBoxes(page, sels);
  expect(back.heat!.width).toBeCloseTo(small.heat!.width, 0);
});

test('the figures card has the generation\'s figures and the function, equal to the engine at every generation; the graph equals the metrics', async ({ page }) => {
  await open(page);
  const run = engine();
  const graph = page.locator('svg[data-plot="fitness-mini"]');
  for (let g = 0; g <= 4; g++) {
    if (g > 0) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    const m = metricsOfProblem(run.snapshot(g).state, landscapeProblem(himmelblau));
    const [first, second] = statsLines({ ...m, generation: g } as never);
    const card = page.getByTestId('focus-card');
    await expect(card).toContainText(first.replace(/ +/g, ' '));
    await expect(card).toContainText(second.replace(/ +/g, ' '));
    await expect(card).toContainText('Himmelblau');
    await expect(graph).toHaveAttribute('data-now', String(g));
    expect(Number(await graph.locator('[data-mini="best"]').getAttribute('data-value'))).toBeCloseTo(m.best, 9);
    expect(Number(await graph.locator('[data-mini="average"]').getAttribute('data-value'))).toBeCloseTo(m.average, 9);
    expect(await graph.getAttribute('aria-label')).toBe(await page.locator('svg[data-plot="fitness"]').getAttribute('aria-label'));
  }
  await expect(graph.locator('text[data-label="optimum"]')).toContainText('optimum');
  await expect(page.getByTestId('focus-card').getByTestId('landscape-key')).toBeVisible();
});

test('the marks are the engine\'s in the focus view: every individual at its decoded point, on both figures, in every generation', async ({ page }) => {
  await open(page);
  const run = engine();
  for (let g = 0; g <= 3; g++) {
    if (g > 0) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    const state = run.snapshot(g).state;
    const got = await markers(page, 'heat-marks');
    expect(got.map((m) => m.id)).toEqual(state.population.map((i) => i.id));
    for (const m of got) expect([m.x, m.y]).toEqual(state.population.find((i) => i.id === m.id)!.values);
    const onSurface = await markers(page, 'surface-marks');
    for (const m of onSurface) expect([m.x, m.y]).toEqual(state.population.find((i) => i.id === m.id)!.values);
    expect(onSurface.length).toBeGreaterThan(state.population.length - 4);
  }
  // selecting an individual from the heatmap selects it on the surface and in the table (hidden but kept)
  const target = (await markers(page, 'heat-marks'))[2]!;
  await page.getByTestId('heat-marks').locator(`[data-marker="individual"][data-id="${target.id}"] .body, [data-marker="individual"][data-id="${target.id}"] .ghost`).first().dispatchEvent('click');
  await expect(page.getByTestId('surface-marks').locator(`[data-marker="individual"][data-id="${target.id}"][data-selected="true"]`)).toHaveCount(1);
});

test('the wheel zooms the heatmap about the pointer, a drag pans it, a double-click returns to the whole domain; the marks follow the region', async ({ page }) => {
  await open(page);
  await page.keyboard.press('g');
  const layout = await layoutOf(page);
  const whole = await regionOf(page);
  expect(whole).toEqual({ x0: -5, x1: 5, y0: -5, y1: 5 });
  const pointer = await heatPage(page, layout.L + 0.7 * (layout.R - layout.L), layout.T + 0.3 * (layout.B - layout.T));
  const before = pointAt(layout, whole, layout.L + 0.7 * (layout.R - layout.L), layout.T + 0.3 * (layout.B - layout.T));
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.wheel(0, -400);
  const zoomed = await regionOf(page);
  const span = zoomed.x1 - zoomed.x0;
  expect(span).toBeLessThan(5);
  expect(span).toBeGreaterThan(0.3);
  // the point of the plane that was under the pointer is still under it (the pointer is held to whole pixels by the browser)
  const after = pointAt(layout, zoomed, layout.L + 0.7 * (layout.R - layout.L), layout.T + 0.3 * (layout.B - layout.T));
  near(after.x, before.x, 0.05 * span + 0.02, 'x under the pointer');
  near(after.y, before.y, 0.05 * (zoomed.y1 - zoomed.y0) + 0.02, 'y under the pointer');
  expect(zoomed.x0).toBeGreaterThanOrEqual(-5);
  expect(zoomed.x1).toBeLessThanOrEqual(5);
  // the marks that are drawn are inside the shown region and at the pixels of their points
  for (const m of await page.getByTestId('heat-marks').evaluate((svg) => [...svg.querySelectorAll('[data-marker="individual"]')].map((g) => ({ x: Number(g.getAttribute('data-x')), y: Number(g.getAttribute('data-y')) })))) {
    expect(m.x).toBeGreaterThanOrEqual(zoomed.x0 - 1e-9);
    expect(m.x).toBeLessThanOrEqual(zoomed.x1 + 1e-9);
    expect(m.y).toBeGreaterThanOrEqual(zoomed.y0 - 1e-9);
    expect(m.y).toBeLessThanOrEqual(zoomed.y1 + 1e-9);
  }
  // a drag to the right shows what lies to the left; the span stays
  const from = await heatPage(page, layout.L + 100, layout.T + 100);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 20, { steps: 5 });
  await page.mouse.up();
  const dragged = await regionOf(page);
  expect(dragged.x0).toBeLessThan(zoomed.x0);
  expect(dragged.x1 - dragged.x0).toBeCloseTo(span, 9);
  expect(dragged.y1).toBeGreaterThan(zoomed.y1);
  // out to the whole domain with the wheel, and the double-click from a zoom
  await page.mouse.wheel(0, 5000);
  expect(await regionOf(page)).toEqual(whole);
  await page.mouse.wheel(0, -400);
  expect((await regionOf(page)).x1 - (await regionOf(page)).x0).toBeLessThan(10);
  await page.mouse.dblclick(pointer.x, pointer.y);
  expect(await regionOf(page)).toEqual(whole);
});

test('zoom to population and the wheel compose; Reset view returns to the whole domain, with the surface at its start', async ({ page }) => {
  await open(page);
  for (let k = 0; k < 40; k++) await page.keyboard.press('g');
  await page.getByTestId('zoom-toggle').click();
  const popRegion = await regionOf(page);
  expect(popRegion.x1 - popRegion.x0).toBeLessThan(10);
  const layout = await layoutOf(page);
  const middle = await heatPage(page, (layout.L + layout.R) / 2, (layout.T + layout.B) / 2);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(0, -300);
  const both = await regionOf(page);
  expect(both.x1 - both.x0).toBeLessThan(popRegion.x1 - popRegion.x0);
  expect(both.x0).toBeGreaterThanOrEqual(popRegion.x0 - 1e-9);
  expect(both.x1).toBeLessThanOrEqual(popRegion.x1 + 1e-9);
  expect(both.y0).toBeGreaterThanOrEqual(popRegion.y0 - 1e-9);
  expect(both.y1).toBeLessThanOrEqual(popRegion.y1 + 1e-9);
  await expect(page.getByTestId('zoom-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('rotate-left').click();
  await page.getByTestId('surface').hover();
  await page.mouse.wheel(0, -300);
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBeGreaterThan(1);
  await page.getByTestId('reset-view').click();
  expect(await regionOf(page)).toEqual({ x0: -5, x1: 5, y0: -5, y1: 5 });
  await expect(page.getByTestId('zoom-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBe(1);
  expect(Number(await surface(page).getAttribute('data-az'))).toBeCloseTo(-0.7, 9);
  await expect(page.getByTestId('reset-view')).toBeDisabled();
});

test('the wheel brings the surface\'s camera closer, to 4× at most, and out again; drag and the arrow keys still turn it; + − and 0 do the keyboard\'s part', async ({ page }) => {
  await open(page);
  const box = (await surface(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  const z1 = Number(await surface(page).getAttribute('data-zoom'));
  expect(z1).toBeGreaterThan(1.5);
  await page.mouse.wheel(0, -20000);
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBe(4);
  await page.mouse.wheel(0, 20000);
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBe(1);
  await page.mouse.wheel(0, -300);
  const az0 = Number(await surface(page).getAttribute('data-az'));
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 340, box.y + 200, { steps: 4 });
  await page.mouse.up();
  expect(Number(await surface(page).getAttribute('data-az'))).toBeGreaterThan(az0);
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBeGreaterThan(1.5);
  const focusBox = page.getByTestId('surface-focus');
  await focusBox.focus();
  await page.keyboard.press('ArrowLeft');
  expect(Number(await surface(page).getAttribute('data-az'))).toBeLessThan(az0 + 0.5);
  const z2 = Number(await surface(page).getAttribute('data-zoom'));
  await page.keyboard.press('+');
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBeGreaterThan(z2);
  await page.keyboard.press('-');
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBeCloseTo(z2, 9);
  await page.keyboard.press('0');
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBe(1);
});

test('the keys on the heatmap: + − 0 zoom and reset, Shift and the arrows move the picture, and the plain arrows still select individuals', async ({ page }) => {
  await open(page);
  await page.getByTestId('heat-marks').focus();
  const whole = await regionOf(page);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  const z = await regionOf(page);
  expect(z.x1 - z.x0).toBeLessThan(whole.x1 - whole.x0);
  await page.keyboard.press('Shift+ArrowRight');
  const moved = await regionOf(page);
  expect(moved.x0).toBeGreaterThan(z.x0);
  expect(moved.x1 - moved.x0).toBeCloseTo(z.x1 - z.x0, 9);
  // the run did not step
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await page.keyboard.press('0');
  expect(await regionOf(page)).toEqual(whole);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('heat-marks').locator('[data-marker="individual"][data-selected="true"]')).toHaveCount(1);
});

test('the toolbar over the figures: Back, zoom to population, trails, the rotation buttons, + and − on both figures, Reset view, Graph', async ({ page }) => {
  await open(page);
  const bar = page.getByTestId('focus-toolbar');
  for (const id of ['focus-toggle', 'zoom-toggle', 'trail-0', 'trail-3', 'rotate-left', 'rotate-reset', 'zoom-in', 'zoom-out', 'reset-view', 'toggle-graph']) await expect(bar.getByTestId(id), id).toBeVisible();
  await expect(bar.getByTestId('zoom-out')).toBeDisabled();
  await expect(bar.getByTestId('reset-view')).toBeDisabled();
  await bar.getByTestId('zoom-in').click();
  const heatSpan = async () => (await regionOf(page)).x1 - (await regionOf(page)).x0;
  expect(await heatSpan()).toBeLessThan(10);
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBeGreaterThan(1);
  await expect(bar.getByTestId('reset-view')).toBeEnabled();
  await bar.getByTestId('zoom-out').click();
  expect(await heatSpan()).toBeCloseTo(10, 6);
  expect(Number(await surface(page).getAttribute('data-zoom'))).toBe(1);
  await bar.getByTestId('trail-3').click();
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(page.getByTestId('heat-marks').locator('.dot').first()).toBeVisible();
  await bar.getByTestId('toggle-graph').click();
  await expect(page.getByTestId('focus-graph')).toHaveCount(0);
  await page.getByTestId('toggle-graph').click();
  await expect(page.getByTestId('focus-graph')).toBeVisible();
  // what was chosen is kept on leaving
  await bar.getByTestId('focus-toggle').click();
  await expect(page.getByTestId('trail-3')).toHaveAttribute('aria-pressed', 'true');
});

test('zoom is kept through steps, a restart and the move between the ordinary and the focus view (the same part of the picture)', async ({ page }) => {
  await open(page, himmelblau, false, false);
  const layout = await layoutOf(page);
  const mid = await heatPage(page, layout.L + 0.8 * (layout.R - layout.L), layout.T + 0.2 * (layout.B - layout.T));
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.wheel(0, -400);
  const small = await regionOf(page);
  expect(small.x1 - small.x0).toBeLessThan(5);
  await page.getByTestId('focus-toggle').click();
  const big = await regionOf(page);
  for (const k of ['x0', 'x1', 'y0', 'y1'] as const) near(big[k], small[k], 1e-6, `region ${k} in and out of the focus view`);
  await page.keyboard.press('g');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  const kept = await regionOf(page);
  for (const k of ['x0', 'x1', 'y0', 'y1'] as const) near(kept[k], small[k], 1e-6, `region ${k} after a restart`);
  await page.getByTestId('focus-toggle').click();
  const back = await regionOf(page);
  for (const k of ['x0', 'x1', 'y0', 'y1'] as const) near(back[k], small[k], 1e-6, `region ${k} back in the panel`);
});

test('during Run the marks move at every generation and the card, the graph and the table agree on the generation', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, rastrigin);
  await page.getByRole('slider', { name: 'Playback speed' }).fill('2');
  await page.evaluate(() => {
    const seen: { g: string | null; h: string; sig: string }[] = [];
    (window as unknown as { seen: typeof seen }).seen = seen;
    const tick = () => {
      const mini = document.querySelector('svg[data-plot="fitness-mini"]');
      const head = document.querySelector('#pop-heading')?.textContent ?? '';
      const marks = [...document.querySelectorAll('[data-testid="heat-marks"] [data-marker="individual"]')].map((e) => `${e.getAttribute('data-id')}:${e.getAttribute('data-px')}`).join(',');
      seen.push({ g: mini?.getAttribute('data-now') ?? null, h: head, sig: marks });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: /Run/ }).filter({ hasText: /^▶/ }).first().click();
  await page.waitForFunction(() => Number(document.querySelector('svg[data-plot="fitness-mini"]')?.getAttribute('data-now')) >= 8, undefined, { timeout: 45_000 });
  await page.getByRole('button', { name: /Pause/ }).click();
  const seen = await page.evaluate(() => (window as unknown as { seen: { g: string | null; h: string; sig: string }[] }).seen);
  const byGeneration = new Map<string, Set<string>>();
  for (const f of seen) {
    if (f.g === null) continue;
    const said = /generation (\d+)/.exec(f.h);
    if (said) expect(said[1], 'the table and the graph in one frame').toBe(f.g);
    if (!byGeneration.has(f.g)) byGeneration.set(f.g, new Set());
    byGeneration.get(f.g)!.add(f.sig);
  }
  for (let g = 1; g <= 8; g++) expect(byGeneration.has(String(g)), `generation ${g} was drawn`).toBe(true);
  // the population's marks differ from one generation to the next
  const signatures = [...byGeneration.entries()].filter(([g]) => Number(g) >= 1 && Number(g) <= 8).map(([, s]) => [...s][0]);
  expect(new Set(signatures).size).toBeGreaterThanOrEqual(6);
});

for (const projector of [false, true]) {
  for (const [width, height] of [[1920, 1080], [1366, 768]] as const) {
    test(`the overlays and the figures stay inside their places and clear of each other${projector ? ' in projector mode' : ''} at ${width}×${height}, at every micro-step of two generations, zoomed and not`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width, height });
      await open(page, himmelblau, projector);
      await page.locator('#narr').click();
      const check = async (at: string) => {
        const b = await designBoxes(page, sels);
        for (const name of ['toolbar', 'card', 'graph'] as const) {
          expect(within(b[name]!, b.body!), `${at}: ${name} inside the body ${JSON.stringify(b[name])}`).toBe(true);
          expect(apart(b[name]!, b.heat!), `${at}: ${name} and the heatmap`).toBe(true);
          expect(apart(b[name]!, b.surface!), `${at}: ${name} and the surface`).toBe(true);
        }
        expect(apart(b.toolbar!, b.card!), `${at}: toolbar and card`).toBe(true);
        expect(apart(b.toolbar!, b.graph!), `${at}: toolbar and graph`).toBe(true);
        expect(apart(b.card!, b.graph!), `${at}: card and graph`).toBe(true);
        expect(b.toolbar!.height, `${at}: the toolbar is one row`).toBeLessThanOrEqual(60);
        expect(apart(b.body!, b.narr!), `${at}: the body and the narration`).toBe(true);
        const bad = await page.evaluate(() => {
          const out: string[] = [];
          for (const sel of ['[data-testid="focus-card"]', '[data-testid="focus-graph"]', '[data-testid="focus-toolbar"]']) {
            const el = document.querySelector(sel)!;
            if (el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1) out.push(`${sel} scrolls`);
            const box = el.getBoundingClientRect();
            for (const child of el.querySelectorAll('button, select, label, text, table, p, svg')) {
              const r = child.getBoundingClientRect();
              if (r.width === 0) continue;
              if (r.right > box.right + 1 || r.left < box.left - 1 || r.bottom > box.bottom + 1 || r.top < box.top - 1) out.push(`${sel}: ${child.tagName} ${child.textContent?.slice(0, 20)} leaves it`);
            }
          }
          const narr = document.querySelector('#narr')!;
          if (narr.scrollHeight - narr.clientHeight > 1) out.push('the narration overflows its box');
          if (document.documentElement.scrollWidth > window.innerWidth) out.push('the page scrolls sideways');
          return out;
        });
        expect(bad, at).toEqual([]);
      };
      await check('start');
      for (let k = 0; k < 2 * 40; k++) {
        await page.keyboard.press('ArrowRight');
        if (k % 4 === 0) await check(`micro-step ${k}`);
      }
      await page.getByTestId('zoom-in').click();
      await page.getByTestId('zoom-in').click();
      await page.getByTestId('zoom-toggle').click();
      await check('zoomed');
    });
  }
}

test('keyboard only: every control of the focus view is reached by Tab and named, and Esc leaves', async ({ page }) => {
  await open(page);
  const tree = await page.getByTestId('focus-toolbar').ariaSnapshot();
  expect(tree.split('\n').filter((l) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio)(\s+\[[^\]]*\])*:?\s*$/.test(l))).toEqual([]);
  await page.getByTestId('zoom-toggle').focus();
  const reached: string[] = [];
  for (let k = 0; k < 20; k++) {
    await page.keyboard.press('Tab');
    reached.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? ''));
  }
  for (const id of ['trail-0', 'rotate-left', 'zoom-in', 'toggle-graph', 'focus-toggle']) expect(reached, id).toContain(id);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
});

const unused = (l: Locator) => l;
void unused;

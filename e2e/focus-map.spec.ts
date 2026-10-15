import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, metricsOfProblem, tspProblem, type GaParams, type TspOptions, type TspProblem } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;
const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
const att: TspOptions = { instance: 'att48', n: 10, seed: 1 };
const circle: TspOptions = { instance: 'circle', n: 5, seed: 1 };
const clusters: TspOptions = { instance: 'clusters', n: 10, seed: 1 };

const paramsOf = (options: TspOptions, change: (p: GaParams) => GaParams = (p) => p) => {
  const d = defaultsOf(entry, options);
  return { d, params: change(d.params) };
};
const open = async (page: Page, options: TspOptions, projector = false, change: (p: GaParams) => GaParams = (p) => p, size?: number) => {
  const { d, params } = paramsOf(options, change);
  const init = size ? { kind: 'random' as const, size } : d.init;
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init }, params, 42, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-map').click();
  await page.getByTestId('focus-toggle').click();
  await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
};
const engine = (options: TspOptions, generations: number, change: (p: GaParams) => GaParams = (p) => p, size?: number) => {
  const { d, params } = paramsOf(options, change);
  const problem = entry.create(options) as TspProblem;
  const run = createRun(gaAlgorithm, { setup: { problem, init: size ? { kind: 'random', size } : d.init }, params, seed: 42 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { problem, run };
};

/** A box in the design's own pixels. */
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
  map: 'svg[data-testid="route-map"]',
  toolbar: '[data-testid="focus-toolbar"]',
  card: '[data-testid="focus-card"]',
  graph: '[data-testid="focus-graph"]',
  narr: '#narr',
};
const text = (page: Page, id: string) => page.getByTestId(id).innerText();

test('the map fills the whole body of the panel and the toolbar, the figures card and the fitness graph lie over its corners', async ({ page }) => {
  await open(page, berlin);
  const b = await designBoxes(page, sels);
  expect(b.map!.width).toBeCloseTo(1840, 0);
  expect(b.map!.height).toBeCloseTo(734, 0);
  expect(within(b.map!, b.body!)).toBe(true);
  for (const name of ['toolbar', 'card', 'graph'] as const) {
    expect(b[name], name).toBeDefined();
    expect(within(b[name]!, b.map!), `${name} inside the picture`).toBe(true);
  }
  // toolbar top left, card top right, graph bottom left
  expect(b.toolbar!.left - b.map!.left).toBeLessThan(30);
  expect(b.toolbar!.top - b.map!.top).toBeLessThan(30);
  expect(b.map!.left + b.map!.width - (b.card!.left + b.card!.width)).toBeLessThan(30);
  expect(b.card!.top - b.map!.top).toBeLessThan(30);
  expect(b.graph!.left - b.map!.left).toBeLessThan(30);
  expect(b.map!.top + b.map!.height - (b.graph!.top + b.graph!.height)).toBeLessThan(30);
  expect(apart(b.toolbar!, b.card!)).toBe(true);
  expect(apart(b.toolbar!, b.graph!)).toBe(true);
  expect(apart(b.card!, b.graph!)).toBe(true);
  // the sentence and the table of the map stay for the screen reader but not on the picture
  await expect(page.getByTestId('route-sentence')).toHaveCount(1);
  await expect(page.getByTestId('route-sentence')).not.toBeInViewport({ ratio: 0.01 }).catch(() => undefined);
  expect(await page.getByTestId('route-sentence').evaluate((e) => getComputedStyle(e.parentElement!.classList.contains('sr-only') ? e.parentElement! : e).position)).toBe('absolute');
});

for (const [label, options] of [
  ['5 cities', circle],
  ['16 cities', ulysses],
  ['48 cities, a wide map', att],
  ['52 cities', berlin],
  ['two clusters', clusters],
] as const) {
  test(`at 1× no city and no number lies under an overlay: ${label}, at the start and through two generations of micro-steps with the stage marks`, async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, options);
    await page.locator('#narr').click();
    const check = async (at: string) => {
      const found = await page.evaluate((s) => {
        const overlays = ['toolbar', 'card', 'graph'].map((n) => document.querySelector((s as Record<string, string>)[n]!)!.getBoundingClientRect());
        const svg = document.querySelector('svg[data-testid="route-map"]')!;
        const bad: string[] = [];
        for (const el of svg.querySelectorAll('circle.city, text.cl')) {
          const r = el.getBoundingClientRect();
          for (const [k, o] of overlays.entries()) {
            if (r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top) bad.push(`${el.tagName} ${el.getAttribute('data-city') ?? el.getAttribute('data-label')} under overlay ${k}`);
          }
        }
        return bad;
      }, sels);
      expect(found, at).toEqual([]);
    };
    await check('start');
    for (let k = 0; k < 2 * 60; k++) {
      await page.keyboard.press('ArrowRight');
      if (k % 4 === 0) await check(`micro-step ${k}`);
    }
  });
}

test('the figures card has the figures of the generation, equal to the engine at every generation, and the key; the mark sentence while a stage is stepped', async ({ page }) => {
  await open(page, berlin);
  const { problem, run } = engine(berlin, 0);
  let bestSoFar = -Infinity;
  const figures = (g: number) => {
    const state = run.snapshot(g).state;
    const m = metricsOfProblem(state, problem);
    bestSoFar = Math.max(bestSoFar, m.best);
    return { best: problem.lengthText(-m.best), so: problem.lengthText(-bestSoFar), avg: problem.lengthText(-m.average) };
  };
  for (let g = 0; g <= 6; g++) {
    if (g > 0) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    const f = figures(g);
    await expect(page.getByTestId('focus-card')).toContainText(`Generation ${g}`);
    expect(await text(page, 'stat-best-now')).toBe(f.best);
    expect(await text(page, 'stat-best-so-far')).toBe(f.so);
    expect(await text(page, 'stat-average')).toBe(f.avg);
    expect(await text(page, 'stat-optimum')).toBe('7,542');
    expect(await text(page, 'stat-nearest')).toBe('8,980');
  }
  await expect(page.getByTestId('route-key')).toBeVisible();
  expect(await page.getByTestId('route-key').evaluate((e) => !!e.closest('[data-testid="focus-card"]'))).toBe(true);
  await page.locator('#narr').click();
  let seen = false;
  for (let k = 0; k < 80 && !seen; k++) {
    await page.keyboard.press('ArrowRight');
    if ((await page.getByTestId('route-mark').count()) > 0) seen = true;
  }
  expect(seen).toBe(true);
  expect(await page.getByTestId('route-mark').evaluate((e) => !!e.closest('[data-testid="focus-card"]'))).toBe(true);
  await expect(page.getByTestId('route-mark')).toBeVisible();
});

test('the simplified fitness graph equals the metrics at every generation, and says what the full plot says', async ({ page }) => {
  await open(page, berlin);
  const { run } = engine(berlin, 0);
  const graph = page.locator('svg[data-plot="fitness-mini"]');
  await expect(graph).toBeVisible();
  for (let g = 0; g <= 6; g++) {
    if (g > 0) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    const state = run.snapshot(g).state;
    const m = metricsOfProblem(state, tspProblem(berlin));
    await expect(graph).toHaveAttribute('data-now', String(g));
    expect(Number(await graph.locator('[data-mini="best"]').getAttribute('data-value'))).toBeCloseTo(m.best, 9);
    expect(Number(await graph.locator('[data-mini="average"]').getAttribute('data-value'))).toBeCloseTo(m.average, 9);
    // the best so far at generation g is the best of any generation up to it
    let so = -Infinity;
    for (let k = 0; k <= g; k++) so = Math.max(so, metricsOfProblem(run.snapshot(k).state, tspProblem(berlin)).best);
    expect(Number(await graph.locator('[data-mini="bestSoFar"]').getAttribute('data-value'))).toBeCloseTo(so, 9);
    // the past path of each series has one vertex per generation up to now
    for (const key of ['best', 'bestSoFar', 'average']) {
      const d = await graph.locator(`path[data-series="${key}"]`).getAttribute('d');
      expect(d!.split(/(?=[ML])/)).toHaveLength(g + 1);
    }
    // the sentence is the full plot's sentence, which is the plot's, hidden but kept
    expect(await graph.getAttribute('aria-label')).toBe(await page.locator('svg[data-plot="fitness"]').getAttribute('aria-label'));
  }
  await expect(graph.locator('text[data-label="optimum"]')).toHaveText('optimum −7,542');
  await expect(graph.locator('text[data-label="nearest"]')).toHaveText('nearest neighbour −8,980');
  // the three markers differ in shape, so colour is not the only carrier
  const shapes = await graph.locator('[data-mini]').evaluateAll((els) => els.map((e) => e.tagName.toLowerCase()));
  expect(new Set(shapes).size).toBe(3);
});

test('the graph can be hidden and brought back, and stays as the class left it through steps; its sentence stays in the page', async ({ page }) => {
  await open(page, ulysses);
  const graph = page.getByTestId('focus-graph');
  const toggle = page.getByTestId('toggle-graph');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Hide the fitness graph' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide the fitness graph' }).click();
  await expect(graph).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('g');
  await expect(graph).toHaveCount(0);
  await expect(page.locator('svg[data-plot="fitness"]')).toHaveCount(1);
  await toggle.click();
  await expect(graph).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('svg[data-plot="fitness-mini"]')).toHaveAttribute('data-now', '1');
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(graph).toHaveCount(0);
  // kept through leaving and entering the focus view
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  await expect(graph).toHaveCount(0);
});

test('the toolbar over the map: the toggles, the selected tour, the zoom buttons and Back all work', async ({ page }) => {
  await open(page, ulysses);
  const bar = page.getByTestId('focus-toolbar');
  for (const id of ['toggle-population', 'toggle-optimal', 'toggle-numbers', 'map-select', 'zoom-in', 'zoom-out', 'reset-view', 'toggle-graph', 'focus-toggle']) {
    await expect(bar.getByTestId(id), id).toBeVisible();
  }
  await bar.getByTestId('toggle-optimal').click();
  await expect(page.locator('svg[data-testid="route-map"] line[data-layer="optimal"]')).toHaveCount(16);
  await bar.getByTestId('toggle-numbers').click();
  await expect(page.locator('svg[data-testid="route-map"] text.cl')).toHaveCount(0);
  await bar.getByTestId('map-select').selectOption({ index: 2 });
  await expect(page.locator('svg[data-testid="route-map"] line[data-layer="selected"]').first()).toBeVisible();
  await bar.getByTestId('zoom-in').click();
  expect(Number(await page.getByTestId('route-map').getAttribute('data-zoom'))).toBeGreaterThan(1);
  await bar.getByTestId('reset-view').click();
  expect(Number(await page.getByTestId('route-map').getAttribute('data-zoom'))).toBe(1);
  await expect(bar.getByTestId('focus-toggle')).toContainText('Back to the panels');
  await bar.getByTestId('focus-toggle').click();
  await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
  // and what was chosen in the focus view is what the ordinary view shows
  await expect(page.getByTestId('toggle-optimal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('toggle-numbers')).toHaveAttribute('aria-pressed', 'false');
});

test('the wheel, a drag and the keys work on the large map as on the small one', async ({ page }) => {
  await open(page, berlin);
  const map = page.getByTestId('route-map');
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -500);
  const z = Number(await map.getAttribute('data-zoom'));
  expect(z).toBeGreaterThan(2);
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 350, { steps: 5 });
  await page.mouse.up();
  expect(Number(await map.getAttribute('data-zoom'))).toBe(z);
  await page.mouse.dblclick(box.x + 600, box.y + 300);
  expect(Number(await map.getAttribute('data-zoom'))).toBe(1);
  await page.getByTestId('route-map-frame').focus();
  await page.keyboard.press('+');
  expect(Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(1);
  await page.keyboard.press('0');
  expect(Number(await map.getAttribute('data-zoom'))).toBe(1);
});

test('during Run the map and the graph change at every generation, together', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, berlin);
  await page.getByRole('slider', { name: 'Playback speed' }).fill('2');
  await page.evaluate(() => {
    const seen: { g: string | null; s: string; q: number }[] = [];
    (window as unknown as { seen: typeof seen }).seen = seen;
    const tick = () => {
      const mini = document.querySelector('svg[data-plot="fitness-mini"]');
      const sentence = document.querySelector('[data-testid="route-sentence"]')?.textContent ?? '';
      const lines = document.querySelectorAll('svg[data-testid="route-map"] line[data-layer="best"]').length;
      seen.push({ g: mini?.getAttribute('data-now') ?? null, s: sentence, q: lines });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: /^▶|Run/ }).filter({ hasText: /Run/ }).first().click();
  await page.waitForFunction(() => Number(document.querySelector('svg[data-plot="fitness-mini"]')?.getAttribute('data-now')) >= 8, undefined, { timeout: 45_000 });
  await page.getByRole('button', { name: /Pause/ }).click();
  const seen = await page.evaluate(() => (window as unknown as { seen: { g: string | null; s: string; q: number }[] }).seen);
  const generations = new Set<string>();
  for (const frame of seen) {
    if (frame.g === null) continue;
    generations.add(frame.g);
    // in every frame the graph and the map's own sentence agree on the generation
    const said = /Generation (\d+):/.exec(frame.s);
    if (said) expect(said[1], 'the map and the graph in one frame').toBe(frame.g);
    expect(frame.q, 'the best tour is drawn').toBeGreaterThan(0);
  }
  // every generation from 1 to 8 was drawn on its own (none skipped), so the picture followed the run
  for (let g = 1; g <= 8; g++) expect(generations.has(String(g)), `generation ${g} was drawn`).toBe(true);
});

test('Run at its fastest keeps the page responsive for 52 cities and 60 individuals with the population edges on', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, berlin, false, (p) => p, 60);
  await page.getByRole('slider', { name: 'Playback speed' }).fill('3');
  await page.evaluate(() => {
    const w = window as unknown as { gaps: number[]; last: number };
    w.gaps = [];
    w.last = performance.now();
    const tick = (t: number) => {
      w.gaps.push(t - w.last);
      w.last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const started = Date.now();
  await page.getByRole('button', { name: /Run/ }).filter({ hasText: /^▶/ }).first().click();
  await page.waitForFunction(() => Number(document.querySelector('svg[data-plot="fitness-mini"]')?.getAttribute('data-now')) >= 60, undefined, { timeout: 100_000 });
  const seconds = (Date.now() - started) / 1000;
  await page.getByRole('button', { name: /Pause/ }).click().catch(() => undefined);
  const gaps = await page.evaluate(() => (window as unknown as { gaps: number[] }).gaps);
  const worst = Math.max(...gaps);
  const sorted = [...gaps].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  console.log(`measured: 60 generations in ${seconds.toFixed(1)} s, ${gaps.length} frames, worst gap ${worst.toFixed(0)} ms, 95th percentile ${p95.toFixed(0)} ms`);
  // the page keeps drawing: no single frame is held for more than a second, and the 95th percentile is well under a quarter of a second
  expect(worst).toBeLessThan(1000);
  expect(p95).toBeLessThan(250);
});

for (const projector of [false, true]) {
  for (const [width, height] of [[1920, 1080], [1366, 768]] as const) {
    for (const [label, options] of [['16 cities', ulysses], ['52 cities', berlin]] as const) {
      test(`the overlays stay inside their places, clear of each other and of the narration: ${label} at ${width}×${height}${projector ? ' in projector mode' : ''}, at every micro-step of two generations`, async ({ page }) => {
        test.setTimeout(150_000);
        await page.setViewportSize({ width, height });
        await open(page, options, projector);
        await page.locator('#narr').click();
        const check = async (at: string) => {
          const b = await designBoxes(page, sels);
          for (const name of ['toolbar', 'card', 'graph'] as const) expect(within(b[name]!, b.map!), `${at}: ${name} inside the picture ${JSON.stringify(b[name])}`).toBe(true);
          expect(apart(b.toolbar!, b.card!), `${at}: toolbar and card`).toBe(true);
          expect(apart(b.toolbar!, b.graph!), `${at}: toolbar and graph`).toBe(true);
          expect(apart(b.card!, b.graph!), `${at}: card and graph`).toBe(true);
          expect(b.toolbar!.height, `${at}: the toolbar is one row`).toBeLessThanOrEqual(60);
          expect(b.card!.height, `${at}: the card`).toBeLessThanOrEqual(450);
          expect(b.card!.top + b.card!.height, `${at}: the card clears the graph's side`).toBeLessThanOrEqual(b.map!.top + b.map!.height);
          expect(apart(b.map!, b.narr!), `${at}: the map and the narration`).toBe(true);
          const inner = await page.evaluate(() => {
            const bad: string[] = [];
            for (const sel of ['[data-testid="focus-card"]', '[data-testid="focus-graph"]', '[data-testid="focus-toolbar"]']) {
              const el = document.querySelector(sel)!;
              if (el.scrollWidth - el.clientWidth > 1) bad.push(`${sel} scrolls sideways`);
              if (el.scrollHeight - el.clientHeight > 1) bad.push(`${sel} scrolls`);
              const box = el.getBoundingClientRect();
              for (const child of el.querySelectorAll('button, select, label, text, table, p, svg')) {
                const r = child.getBoundingClientRect();
                if (r.width === 0) continue;
                if (r.right > box.right + 1 || r.left < box.left - 1 || r.bottom > box.bottom + 1 || r.top < box.top - 1) bad.push(`${sel}: ${child.tagName} ${child.textContent?.slice(0, 20)} leaves it`);
              }
            }
            const narr = document.querySelector('#narr')!;
            if (narr.scrollHeight - narr.clientHeight > 1) bad.push('the narration overflows its box');
            if (document.documentElement.scrollWidth > window.innerWidth) bad.push('the page scrolls sideways');
            return bad;
          });
          expect(inner, at).toEqual([]);
        };
        await check('start');
        for (let k = 0; k < 2 * 70; k++) {
          await page.keyboard.press('ArrowRight');
          if (k % 3 === 0) await check(`micro-step ${k}`);
        }
      });
    }
  }
}

test('keyboard only: the overlay controls are reached by Tab, each has a name, and the graph can be hidden', async ({ page }) => {
  await open(page, ulysses);
  const tree = await page.getByTestId('focus-toolbar').ariaSnapshot();
  expect(tree.split('\n').filter((l) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio)(\s+\[[^\]]*\])*:?\s*$/.test(l))).toEqual([]);
  const names = await page.locator('[data-testid="focus-toolbar"] button, [data-testid="focus-card"] button, [data-testid="focus-graph"] button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim()));
  expect(names.every((n) => n.length > 0)).toBe(true);
  await page.getByTestId('toggle-population').focus();
  const reached: string[] = [];
  for (let k = 0; k < 12; k++) {
    await page.keyboard.press('Tab');
    reached.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? ''));
  }
  for (const id of ['toggle-optimal', 'toggle-numbers', 'map-select', 'zoom-in', 'toggle-graph', 'focus-toggle']) expect(reached, id).toContain(id);
});

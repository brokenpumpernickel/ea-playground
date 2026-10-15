import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { landscapeFunctions, type GaParams, type LandscapeOptions, type TspOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const tsp = entryOf('tsp')!;
const land = entryOf('landscape')!;
const circle: TspOptions = { instance: 'circle', n: 5, seed: 1 };
const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };

const openTsp = async (page: Page, options: TspOptions, opts: { projector?: boolean; size?: number; focus?: boolean; theme?: 'dark' } = {}) => {
  const d = defaultsOf(tsp, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: tsp.create(options), init: opts.size ? { kind: 'random', size: opts.size } : d.init }, d.params, 42, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (opts.projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== (opts.theme ?? 'light')) await page.getByRole('button', { name: /^(Dark|Light) theme$/ }).click();
  await page.getByTestId('show-map').click();
  if (opts.focus !== false) {
    await page.getByTestId('focus-toggle').click();
    await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};
const openLand = async (page: Page, options: LandscapeOptions, opts: { projector?: boolean; size?: number; focus?: boolean; theme?: 'dark' } = {}) => {
  const d = defaultsOf(land, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: land.create(options), init: { kind: 'random', size: opts.size ?? 12 } }, d.params as GaParams, 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (opts.projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== (opts.theme ?? 'light')) await page.getByRole('button', { name: /^(Dark|Light) theme$/ }).click();
  await page.getByTestId('show-landscape').click();
  if (opts.focus !== false) {
    await page.getByTestId('focus-toggle').click();
    await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};

type Box = { left: number; top: number; width: number; height: number };
const boxes = (page: Page, sels: Record<string, string>) =>
  page.evaluate((s) => {
    const c = document.querySelector('main.canvas')!.getBoundingClientRect();
    const k = c.width / 1920;
    const out: Record<string, { left: number; top: number; width: number; height: number }> = {};
    for (const [name, sel] of Object.entries(s)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[name] = { left: (r.left - c.left) / k, top: (r.top - c.top) / k, width: r.width / k, height: r.height / k };
    }
    return out;
  }, sels);
const apart = (a: Box, b: Box) => a.left + a.width <= b.left + 0.5 || b.left + b.width <= a.left + 0.5 || a.top + a.height <= b.top + 0.5 || b.top + b.height <= a.top + 0.5;
const within = (inner: Box, outer: Box, tol = 0.5) => inner.left >= outer.left - tol && inner.top >= outer.top - tol && inner.left + inner.width <= outer.left + outer.width + tol && inner.top + inner.height <= outer.top + outer.height + tol;
const base = { panel: '[data-testid="stage-panel"]', body: '#stagebody', toolbar: '[data-testid="focus-toolbar"]', card: '[data-testid="focus-card"]', graph: '[data-testid="focus-graph"]', narr: '#narr' };

/** Everything of the focus view is inside its place, nothing overlaps, nothing scrolls, the narration is whole. */
const checkGeometry = async (page: Page, at: string, figures: Record<string, string>) => {
  const b = await boxes(page, { ...base, ...figures });
  for (const name of ['toolbar', 'card', 'graph'] as const) {
    if (!b[name]) continue;
    expect(within(b[name]!, b.body!), `${at}: ${name} inside the body ${JSON.stringify(b[name])}`).toBe(true);
    for (const f of Object.keys(figures)) if (b[f]) expect(apart(b[name]!, b[f]!), `${at}: ${name} and ${f}`).toBe(true);
  }
  expect(apart(b.toolbar!, b.card!), `${at}: toolbar and card`).toBe(true);
  if (b.graph) expect(apart(b.toolbar!, b.graph), `${at}: toolbar and graph`).toBe(true);
  if (b.graph) expect(apart(b.card!, b.graph), `${at}: card and graph`).toBe(true);
  expect(b.toolbar!.height, `${at}: the toolbar is one row`).toBeLessThanOrEqual(60);
  expect(apart(b.body!, b.narr!), `${at}: the body and the narration`).toBe(true);
  expect(within(b.narr!, b.panel!), `${at}: the narration inside the panel`).toBe(true);
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const sel of ['[data-testid="focus-card"]', '[data-testid="focus-graph"]', '[data-testid="focus-toolbar"]']) {
      const el = document.querySelector(sel);
      if (!el) continue;
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
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};

/** The map's picture is the whole body and the overlays lie on it, so there is no separate figure to keep them apart from. */
const mapFigures = {};
const landFigures = { heat: 'canvas[data-testid="heatmap"]', surface: 'canvas[data-testid="surface"]' };

test.describe('names and sentences', () => {
  test('no control of the focus view is without a name: the map and the landscape, with the toolbar, the card and the graph, the menu and the drawer', async ({ page }) => {
    await openTsp(page, berlin);
    expect(await unnamed(page)).toEqual([]);
    await page.getByTestId('problem-button').click();
    expect(await unnamed(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Parameters/ }).click();
    expect(await unnamed(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await openLand(page, { function: 'rastrigin', representation: 'gray', bitsPerVariable: 8 });
    expect(await unnamed(page)).toEqual([]);
  });

  test('the figures, the graph and the groups are named: the map frame and picture, the graph, the two landscape figures, the toolbars', async ({ page }) => {
    await openTsp(page, ulysses);
    await expect(page.getByTestId('route-map-frame')).toHaveAttribute('aria-label', /Route map.*wheel/);
    expect(await page.getByTestId('route-map').getAttribute('aria-label')).toMatch(/^ulysses16: 16 cities, GEO\. Generation 0:/);
    expect(await page.locator('svg[data-plot="fitness-mini"]').getAttribute('aria-label')).toMatch(/^Fitness by generation, scale .* Generation 0:/);
    await expect(page.getByTestId('hide-graph')).toHaveAccessibleName('Hide the fitness graph');
    for (const [id, name] of [['zoom-in', 'Zoom in'], ['zoom-out', 'Zoom out']] as const) await expect(page.getByTestId(id)).toHaveAccessibleName(name);
    await expect(page.getByTestId('focus-toggle')).toHaveAccessibleName(/^Back to the panels/);
    await openLand(page, { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 });
    await expect(page.getByTestId('surface-focus')).toHaveAttribute('aria-label', /zoom with the wheel or the plus and minus keys/);
    expect(await page.locator('.heatwrap').getAttribute('aria-label')).toMatch(/^Himmelblau: fitness from/);
    expect(await page.locator('svg[data-plot="fitness-mini"]').getAttribute('aria-label')).toMatch(/^Fitness by generation/);
  });

  test('the hidden panels keep their sentences and tables for the screen reader while the focus view is open, and what is on screen is as readable as it was', async ({ page }) => {
    await openTsp(page, berlin);
    await expect(page.locator('svg[data-plot="fitness"]')).toHaveAttribute('aria-label', /Fitness by generation/);
    await expect(page.getByTestId('route-sentence')).toHaveCount(1);
    await expect(page.getByTestId('route-tours')).toHaveCount(1);
    await expect(page.locator('table[aria-label="Tours on the map"] tbody tr')).not.toHaveCount(0);
    await page.keyboard.press('g');
    // the visible card says the figures a reader of the hidden sentence is told
    const sentence = await page.getByTestId('route-sentence').textContent();
    const best = await page.getByTestId('stat-best-now').innerText();
    expect(sentence).toContain(`the best tour is ${best} long`);
  });
});

test.describe('the colour audit of the new overlays', () => {
  test('the graph tells its three series apart by shape, dash and legend as well as colour; its two reference lines by dash and by words', async ({ page }) => {
    await openTsp(page, berlin);
    for (let g = 0; g < 3; g++) await page.keyboard.press('g');
    const graph = page.locator('svg[data-plot="fitness-mini"]');
    const shapes = await graph.locator('[data-mini]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-mini')}:${e.tagName.toLowerCase()}`));
    expect(Object.fromEntries(shapes.map((s) => s.split(':') as [string, string]))).toEqual({ average: 'circle', bestSoFar: 'path', best: 'rect' });
    expect(await graph.locator('path[data-series="bestSoFar"]').getAttribute('stroke-dasharray')).toBe('7 4');
    expect(await graph.locator('path[data-series="best"]').getAttribute('stroke-dasharray')).toBe('none');
    expect(await graph.locator('line[data-line="optimum"]').getAttribute('stroke-dasharray')).toBe('2 5');
    expect(await graph.locator('line[data-line="nearest"]').getAttribute('stroke-dasharray')).toBe('9 5');
    await expect(graph.locator('text[data-label="optimum"]')).toContainText('optimum');
    await expect(graph.locator('text[data-label="nearest"]')).toContainText('nearest neighbour');
    const header = await page.locator('.mini .mh .ml').innerText();
    expect(header).toContain('●');
    expect(header).toContain('■');
    expect(header).toContain('▲');
    expect(header).toMatch(/average.*best.*best so far/);
  });

  test('a toggle says whether it is on by its ✓ and by aria-pressed, the two together, in both focus views; a disabled control is disabled, not only grey', async ({ page }) => {
    await openTsp(page, ulysses);
    for (const id of ['toggle-population', 'toggle-numbers', 'toggle-optimal', 'toggle-graph']) {
      const button = page.getByTestId(id);
      for (let k = 0; k < 2; k++) {
        const on = (await button.getAttribute('aria-pressed')) === 'true';
        expect((await button.innerText()).startsWith('✓'), `${id}: ✓ and aria-pressed agree`).toBe(on);
        await button.click();
      }
    }
    await expect(page.getByTestId('zoom-out')).toBeDisabled();
    await expect(page.getByTestId('reset-view')).toBeDisabled();
    await page.getByTestId('zoom-in').click();
    await expect(page.getByTestId('zoom-out')).toBeEnabled();
    await openLand(page, { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 });
    for (const id of ['zoom-toggle', 'toggle-graph', 'trail-0', 'trail-3']) {
      const button = page.getByTestId(id);
      const on = (await button.getAttribute('aria-pressed')) === 'true';
      if (id === 'toggle-graph') expect((await button.innerText()).startsWith('✓')).toBe(on);
      await button.click();
      expect(await button.getAttribute('aria-pressed'), id).not.toBeNull();
    }
    await expect(page.getByTestId('reset-view')).toBeEnabled();
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`the text on the overlays reads on its background (contrast of 4.5 or more) in the ${theme} theme, in projector mode and not`, async ({ page }) => {
      for (const projector of [false, true]) {
        await openTsp(page, ulysses, { projector, ...(theme === 'dark' ? { theme: 'dark' as const } : {}) });
        for (let g = 0; g < 2; g++) await page.keyboard.press('g');
        await page.locator('#narr').click();
        for (let k = 0; k < 24; k++) await page.keyboard.press('ArrowRight');
        const worst = await page.evaluate(() => {
          const parse = (value: string): [number, number, number, number] => {
            const probe = document.createElement('canvas').getContext('2d')!;
            probe.fillStyle = '#000';
            probe.fillStyle = value;
            const hex = probe.fillStyle as string;
            if (hex.startsWith('#')) return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 1];
            const m = /rgba?\(([^)]+)\)/.exec(hex)!;
            const p = m[1]!.split(',').map(Number);
            return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
          };
          const lum = ([r, g, b]: number[]) => {
            const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
          };
          const ratio = (a: number[], b: number[]) => {
            const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
            return (hi! + 0.05) / (lo! + 0.05);
          };
          const surface = parse(getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff');
          let worst = Infinity;
          let where = '';
          for (const root of document.querySelectorAll('[data-testid="focus-card"], [data-testid="focus-graph"], [data-testid="focus-toolbar"]')) {
            for (const el of root.querySelectorAll('p, th, td, caption, b, label, button, text, span')) {
              if (!(el.textContent ?? '').trim() || el.classList.contains('k') || (el.closest('[aria-hidden="true"]') && !el.matches('p'))) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0) continue;
              const colour = el instanceof SVGElement ? getComputedStyle(el).fill : getComputedStyle(el).color;
              const fg = parse(colour);
              // the overlay is 92 % surface over whatever the map has: the worst case is the surface itself under it
              const c = ratio(fg, surface);
              if (c < worst) {
                worst = c;
                where = `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 24)}" ${colour}`;
              }
            }
          }
          return { worst, where };
        });
        expect(worst.worst, `${theme}, projector ${projector}: ${worst.where}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

test.describe('keyboard only', () => {
  test('the map: enter, zoom, pan, reset, step a generation, leave, with Tab, Enter and the keys alone', async ({ page }) => {
    await openTsp(page, berlin, { focus: false });
    await page.getByTestId('show-map').focus();
    await page.keyboard.press('Enter');
    // Tab from the map's toggles to the Expand button, Enter
    await page.getByTestId('toggle-population').focus();
    for (let k = 0; k < 12; k++) {
      await page.keyboard.press('Tab');
      if ((await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'focus-toggle') break;
    }
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('focus-toggle');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
    // into the map and zoom, pan, reset
    await page.getByTestId('route-map-frame').focus();
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    const z = Number(await page.getByTestId('route-map').getAttribute('data-zoom'));
    expect(z).toBeGreaterThan(1.9);
    const cx = Number(await page.getByTestId('route-map').getAttribute('data-cx'));
    await page.keyboard.press('ArrowRight');
    expect(Number(await page.getByTestId('route-map').getAttribute('data-cx'))).toBeGreaterThan(cx);
    await page.keyboard.press('0');
    expect(Number(await page.getByTestId('route-map').getAttribute('data-zoom'))).toBe(1);
    // a whole generation with the keys, and the picture follows
    await page.keyboard.press('g');
    await expect(page.locator('svg[data-plot="fitness-mini"]')).toHaveAttribute('data-now', '1');
    await expect(page.getByTestId('route-sentence')).toContainText('Generation 1');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
    await page.keyboard.press('e');
    await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
    await page.keyboard.press('e');
    await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
  });

  test('the landscape: enter, zoom both figures, pan the heatmap, turn the surface, reset, step a generation, leave', async ({ page }) => {
    await openLand(page, { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 }, { focus: false });
    await page.keyboard.press('e');
    await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
    await page.getByTestId('heat-marks').focus();
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    const z = (await page.getByTestId('heatmap').getAttribute('data-region'))!;
    await page.keyboard.press('Shift+ArrowRight');
    expect(await page.getByTestId('heatmap').getAttribute('data-region')).not.toBe(z);
    await page.getByTestId('surface-focus').focus();
    await page.keyboard.press('+');
    expect(Number(await page.getByTestId('surface').getAttribute('data-zoom'))).toBeGreaterThan(1);
    await page.keyboard.press('ArrowLeft');
    await page.getByTestId('reset-view').focus();
    await page.keyboard.press('Enter');
    expect(Number(await page.getByTestId('surface').getAttribute('data-zoom'))).toBe(1);
    expect(await page.getByTestId('heatmap').getAttribute('data-region')).toBe('-5,5,-5,5');
    await page.getByTestId('reset-view').blur();
    await page.keyboard.press('g');
    await expect(page.locator('svg[data-plot="fitness-mini"]')).toHaveAttribute('data-now', '1');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
  });
});

test('reduced motion: entering, leaving and zooming are single jumps; nothing animates or transitions on the new elements', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTsp(page, berlin, { focus: false });
  await page.getByTestId('focus-toggle').click();
  const box = (await page.getByTestId('route-map').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  const moving = await page.evaluate(() => [...document.querySelectorAll('[data-testid="focus-toolbar"] *, [data-testid="focus-card"] *, [data-testid="focus-graph"] *, svg[data-testid="route-map"] *')].filter((e) => getComputedStyle(e).transitionDuration.split(',').some((d) => parseFloat(d) > 0) || getComputedStyle(e).animationName !== 'none').length);
  expect(moving).toBe(0);
  await openLand(page, { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 });
  const heat = (await page.getByTestId('heatmap').boundingBox())!;
  await page.mouse.move(heat.x + 200, heat.y + 150);
  await page.mouse.wheel(0, -300);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('the top bar in the focus view: the brand, the ribbon and the generation counter inside their boxes, with a three-digit generation', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openTsp(page, berlin, { projector: true });
  await page.getByRole('slider', { name: 'Playback speed' }).fill('3');
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#gen')).toContainText(/\d{3}/);
  const b = await boxes(page, { brand: '#brand', ribbon: '.stage', gen: '#gen' });
  expect(apart(b.brand!, b.ribbon!)).toBe(true);
  expect(apart(b.ribbon!, b.gen!)).toBe(true);
  expect(b.gen!.left + b.gen!.width).toBeLessThanOrEqual(1920.5);
  await checkGeometry(page, 'after Run to stop', mapFigures);
});

for (const projector of [false, true]) {
  for (const [width, height] of [[1920, 1080], [1366, 768]] as const) {
    const tag = `at ${width}×${height}${projector ? ' in projector mode' : ''}`;
    for (const [label, options, size] of [
      ['5 cities', circle, 12],
      ['16 cities, 12 individuals', ulysses, 12],
      ['52 cities, 12 individuals', berlin, 12],
      ['52 cities, 60 individuals', berlin, 60],
    ] as [string, TspOptions, number][]) {
      test(`the route map's focus view ${tag}: ${label}: the overlays, the narration and the page, at the start, in the stages, with a selection and zoomed`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height });
        await openTsp(page, options, { projector, size });
        await page.locator('#narr').click();
        await checkGeometry(page, 'start', mapFigures);
        for (let k = 0; k < 90; k++) {
          await page.keyboard.press('ArrowRight');
          if (k % 6 === 0) await checkGeometry(page, `micro-step ${k}`, mapFigures);
        }
        await page.getByTestId('map-select').selectOption({ index: 3 });
        await page.getByTestId('toggle-optimal').click();
        await checkGeometry(page, 'with a selection and the optimal tour', mapFigures);
        await page.getByTestId('zoom-in').click();
        await page.getByTestId('zoom-in').click();
        await checkGeometry(page, 'zoomed', mapFigures);
        // no marker or number outside the picture, in the big picture too
        const out = await page.evaluate(() => {
          const svg = document.querySelector('svg[data-testid="route-map"]')!;
          const box = svg.getBoundingClientRect();
          return [...svg.querySelectorAll('circle.city, text.cl, text.cross')].filter((e) => {
            const r = e.getBoundingClientRect();
            return r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5;
          }).length;
        });
        expect(out).toBe(0);
      });
    }
    for (const fn of landscapeFunctions) {
      for (const representation of ['real', 'gray'] as const) {
        test(`the landscape's focus view ${tag}: ${fn}, ${representation}: figures, overlays and narration, at the start, in two generations and zoomed`, async ({ page }) => {
          test.setTimeout(120_000);
          await page.setViewportSize({ width, height });
          await openLand(page, { function: fn, representation, bitsPerVariable: 8 }, { projector, size: 12 });
          await page.locator('#narr').click();
          await checkGeometry(page, 'start', landFigures);
          for (let k = 0; k < 2 * 18; k++) {
            await page.keyboard.press('ArrowRight');
            if (k % 6 === 0) await checkGeometry(page, `micro-step ${k}`, landFigures);
          }
          await page.getByTestId('zoom-in').click();
          await page.getByTestId('zoom-in').click();
          await page.getByTestId('zoom-toggle').click();
          await checkGeometry(page, 'zoomed', landFigures);
          await page.getByTestId('trail-5').click();
          await checkGeometry(page, 'with trails', landFigures);
        });
      }
    }
  }
}

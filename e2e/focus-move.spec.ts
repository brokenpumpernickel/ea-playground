import { expect, test, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { GaParams, LandscapeOptions, TspOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const tsp = entryOf('tsp')!;
const land = entryOf('landscape')!;
const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const himmelblau: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 };

const openTsp = async (page: Page) => {
  const d = defaultsOf(tsp, ulysses);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: tsp.create(ulysses), init: d.init }, d.params, 42, 'tsp', ulysses)));
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-map').click();
  await page.getByTestId('focus-toggle').click();
  await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};
const openLand = async (page: Page) => {
  const d = defaultsOf(land, himmelblau);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: land.create(himmelblau), init: { kind: 'random', size: 12 } }, d.params as GaParams, 7, 'landscape', himmelblau)));
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-landscape').click();
  await page.getByTestId('focus-toggle').click();
  await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};

type Box = { left: number; top: number; width: number; height: number };
const box = (page: Page, selector: string): Promise<Box> =>
  page.evaluate((sel) => {
    const c = document.querySelector('main.canvas')!.getBoundingClientRect();
    const k = c.width / 1920;
    const r = document.querySelector(sel)!.getBoundingClientRect();
    return { left: (r.left - c.left) / k, top: (r.top - c.top) / k, width: r.width / k, height: r.height / k };
  }, selector);
const scaleOf = (page: Page) => page.evaluate(() => document.querySelector('main.canvas')!.getBoundingClientRect().width / 1920);
const within = (inner: Box, outer: Box, tol = 0.75) => inner.left >= outer.left - tol && inner.top >= outer.top - tol && inner.left + inner.width <= outer.left + outer.width + tol && inner.top + inner.height <= outer.top + outer.height + tol;
const close = (a: number, b: number, tol: number, what: string) => expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(tol);

/** Drag a handle by (dx, dy) design pixels with the mouse. */
const drag = async (page: Page, handle: Locator, dx: number, dy: number) => {
  const k = await scaleOf(page);
  const r = (await handle.boundingBox())!;
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (dx * k) / 2, y + (dy * k) / 2, { steps: 4 });
  await page.mouse.move(x + dx * k, y + dy * k, { steps: 4 });
  await page.mouse.up();
};

const landscape = { graph: '[data-testid="focus-graph"]', card: '[data-testid="focus-card"]', heat: 'canvas[data-testid="heatmap"]', surface: 'canvas[data-testid="surface"]' };

test('the landscape: the fitness graph moves with its handle, to where it is put, and cannot leave the heatmap', async ({ page }) => {
  await openLand(page);
  const handle = page.getByTestId('move-graph');
  await expect(handle).toHaveAccessibleName(/Move the fitness graph/);
  const start = await box(page, landscape.graph);
  await drag(page, handle, 150, -120);
  const moved = await box(page, landscape.graph);
  close(moved.left - start.left, 150, 2, 'dx');
  close(moved.top - start.top, -120, 2, 'dy');
  expect(moved.width).toBeCloseTo(start.width, 0);
  expect(within(moved, await box(page, landscape.heat))).toBe(true);
  // dragged beyond every edge it stops at the edge of the heatmap
  const heat = await box(page, landscape.heat);
  for (const [dx, dy] of [[5000, 0], [-5000, 0], [0, 5000], [0, -5000], [5000, 5000], [-5000, -5000]] as const) {
    await drag(page, page.getByTestId('move-graph'), dx / 10, dy / 10);
    await drag(page, page.getByTestId('move-graph'), dx / 10, dy / 10);
    const b = await box(page, landscape.graph);
    expect(within(b, heat), `after (${dx}, ${dy})`).toBe(true);
  }
  // the card did not move
  const card = await box(page, landscape.card);
  expect(within(card, await box(page, landscape.surface))).toBe(true);
});

test('the landscape: the information box moves with its handle and cannot leave the surface; the other box does not move', async ({ page }) => {
  await openLand(page);
  const graphAt = await box(page, landscape.graph);
  const start = await box(page, landscape.card);
  await drag(page, page.getByTestId('move-card'), -200, 250);
  const moved = await box(page, landscape.card);
  close(moved.left - start.left, -200, 2, 'dx');
  close(moved.top - start.top, 250, 2, 'dy');
  const surface = await box(page, landscape.surface);
  expect(within(moved, surface)).toBe(true);
  for (const [dx, dy] of [[900, 0], [-900, 0], [0, 900], [0, -900]] as const) {
    await drag(page, page.getByTestId('move-card'), dx / 2, dy / 2);
    await drag(page, page.getByTestId('move-card'), dx / 2, dy / 2);
    expect(within(await box(page, landscape.card), surface), `after (${dx}, ${dy})`).toBe(true);
  }
  expect(await box(page, landscape.graph)).toEqual(graphAt);
});

test('a moved overlay stays where it was put through steps, a restart, hiding and showing, and leaving and entering the focus view; Home and a double-click put it back', async ({ page }) => {
  await openLand(page);
  const home = await box(page, landscape.graph);
  await drag(page, page.getByTestId('move-graph'), 120, -80);
  const put = await box(page, landscape.graph);
  const same = async (what: string) => {
    const b = await box(page, landscape.graph);
    close(b.left, put.left, 1, `${what} left`);
    close(b.top, put.top, 1, `${what} top`);
  };
  await page.keyboard.press('g');
  await same('a generation');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await same('a restart');
  await page.getByTestId('toggle-graph').click();
  await expect(page.getByTestId('focus-graph')).toHaveCount(0);
  await page.getByTestId('toggle-graph').click();
  await same('hiding and showing');
  await page.getByTestId('focus-toggle').click();
  await page.getByTestId('focus-toggle').click();
  await same('leaving and entering');
  await page.getByTestId('move-graph').dblclick();
  const back = await box(page, landscape.graph);
  close(back.left, home.left, 1, 'double-click left');
  close(back.top, home.top, 1, 'double-click top');
  await drag(page, page.getByTestId('move-graph'), 90, 60);
  await page.getByTestId('move-graph').focus();
  await page.keyboard.press('Home');
  const again = await box(page, landscape.graph);
  close(again.left, home.left, 1, 'Home left');
  close(again.top, home.top, 1, 'Home top');
});

test('from the keyboard: the handle is focusable, the arrows move the overlay 20 px (Shift 100) and do not step the run, Home puts it back', async ({ page }) => {
  await openLand(page);
  const handle = page.getByTestId('move-card');
  await expect(handle).toHaveAttribute('aria-label', /arrow keys.*Home/s);
  const home = await box(page, landscape.card);
  const heading = await page.locator('#pop-heading').innerText();
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  let b = await box(page, landscape.card);
  close(b.left - home.left, -20, 1.5, 'one step left');
  await page.keyboard.press('ArrowDown');
  b = await box(page, landscape.card);
  close(b.top - home.top, 20, 1.5, 'one step down');
  await page.keyboard.press('Shift+ArrowLeft');
  b = await box(page, landscape.card);
  close(b.left - home.left, -120, 1.5, 'Shift step left');
  expect(await page.locator('#pop-heading').innerText()).toBe(heading);
  await page.keyboard.press('Home');
  b = await box(page, landscape.card);
  close(b.left, home.left, 1, 'Home');
  close(b.top, home.top, 1, 'Home');
  // out of the handle the arrows step the run again
  await page.getByTestId('toggle-card').focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('#pop-heading').innerText()).not.toBe(heading);
});

test('moving an overlay does not move the picture under it, select text or scroll the page', async ({ page }) => {
  await openLand(page);
  const regionBefore = await page.getByTestId('heatmap').getAttribute('data-region');
  const azBefore = await page.getByTestId('surface').getAttribute('data-az');
  await drag(page, page.getByTestId('move-graph'), 80, -60);
  await drag(page, page.getByTestId('move-card'), -80, 60);
  expect(await page.getByTestId('heatmap').getAttribute('data-region')).toBe(regionBefore);
  expect(await page.getByTestId('surface').getAttribute('data-az')).toBe(azBefore);
  expect(await page.evaluate(() => (window.getSelection()?.toString() ?? '').length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});

const map = 'svg[data-testid="route-map"]';
const mapBoxes = { graph: '[data-testid="focus-graph"]', card: '[data-testid="focus-card"]', toolbar: '[data-testid="focus-toolbar"]', map };

test('the route map: the graph and the figures card move inside the map, below the toolbar, and stay put through steps', async ({ page }) => {
  await openTsp(page);
  const m = await box(page, map);
  const tb = await box(page, mapBoxes.toolbar);
  const graph = await box(page, mapBoxes.graph);
  await drag(page, page.getByTestId('move-graph'), 300, -100);
  const moved = await box(page, mapBoxes.graph);
  close(moved.left - graph.left, 300, 2, 'graph dx');
  expect(within(moved, m)).toBe(true);
  // above its place there is the toolbar's band: dragged up as far as it goes it stops under the toolbar
  for (let k = 0; k < 3; k++) await drag(page, page.getByTestId('move-graph'), 0, -400);
  const top = await box(page, mapBoxes.graph);
  expect(top.top).toBeGreaterThanOrEqual(tb.top + tb.height - 0.75);
  expect(within(top, m)).toBe(true);
  const card = await box(page, mapBoxes.card);
  await drag(page, page.getByTestId('move-card'), -400, 200);
  const cm = await box(page, mapBoxes.card);
  close(cm.left - card.left, -400, 2, 'card dx');
  expect(within(cm, m)).toBe(true);
  expect(cm.top).toBeGreaterThanOrEqual(tb.top + tb.height - 0.75);
  await page.keyboard.press('g');
  await page.locator('#narr').click();
  for (let k = 0; k < 30; k++) await page.keyboard.press('ArrowRight');
  const after = await box(page, mapBoxes.card);
  close(after.left, cm.left, 1, 'card left after steps');
  expect(within(after, m)).toBe(true);
});

test('the route map: a card that grows while it lies at the bottom is pulled back inside the map', async ({ page }) => {
  await openTsp(page);
  await drag(page, page.getByTestId('move-card'), 0, 2000);
  const m = await box(page, map);
  expect(within(await box(page, mapBoxes.card), m)).toBe(true);
  await page.locator('#narr').click();
  let grew = false;
  for (let k = 0; k < 120; k++) {
    await page.keyboard.press('ArrowRight');
    if ((await page.getByTestId('route-mark').count()) > 0) grew = true;
    expect(within(await box(page, mapBoxes.card), m), `micro-step ${k}`).toBe(true);
    if (grew && k > 40) break;
  }
  expect(grew).toBe(true);
});

test('every handle is named and says how to use it; none is without a name', async ({ page }) => {
  await openTsp(page);
  const tree = await page.locator('#stagebody').ariaSnapshot();
  expect(tree.split('\n').filter((l) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio)(\s+\[[^\]]*\])*:?\s*$/.test(l))).toEqual([]);
  for (const id of ['move-graph', 'move-card']) await expect(page.getByTestId(id)).toHaveAttribute('aria-label', /Move the .*\. Drag it, or use the arrow keys; Home puts it back/);
  await openLand(page);
  for (const id of ['move-graph', 'move-card']) await expect(page.getByTestId(id)).toHaveAttribute('aria-label', /Move the .*\. Drag it, or use the arrow keys; Home puts it back/);
});

test('reduced motion: a move is one jump, nothing transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLand(page);
  await drag(page, page.getByTestId('move-graph'), 100, -50);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  const transitions = await page.evaluate(() => [...document.querySelectorAll('[data-testid="focus-graph"], [data-testid="focus-card"], [data-testid="move-graph"], [data-testid="move-card"]')].filter((e) => getComputedStyle(e).transitionDuration.split(',').some((d) => parseFloat(d) > 0)).length);
  expect(transitions).toBe(0);
});

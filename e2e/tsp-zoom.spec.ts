import { expect, test, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { TspOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;
const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };

const open = async (page: Page, options: TspOptions, projector = false) => {
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, d.params, 42, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-map').click();
  await expect(page.getByTestId('route-map-view')).toBeVisible();
};

const map = (page: Page) => page.getByTestId('route-map');
const frame = (page: Page) => page.getByTestId('route-map-frame');
/** Where the cities lie in the map's own coordinates (the viewBox is 740 × 292), by city number from 1. */
const places = (page: Page) =>
  map(page).locator('circle.city').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-city')!, [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))] as [number, number]])));
/** A city's place on the page, in pixels: the middle of its dot. */
const onPage = async (page: Page, city: number) => {
  const r = (await map(page).locator(`circle.city[data-city="${city}"]`).boundingBox())!;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const note = (page: Page) => page.locator('svg[data-testid="route-map"] text.axes').textContent();
const zoomOf = async (page: Page) => Number(await map(page).getAttribute('data-zoom'));
/** The city nearest the middle of the picture. */
const middle = async (page: Page) => {
  const all = await places(page);
  return Number(Object.entries(all).sort((a, b) => Math.hypot(a[1][0] - 370, a[1][1] - 146) - Math.hypot(b[1][0] - 370, b[1][1] - 146))[0]![0]);
};
const wheelAt = async (page: Page, x: number, y: number, deltaY: number) => {
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, deltaY);
};
/** The pointer position the page itself saw at the last wheel notch (the browser rounds it to whole pixels). */
const lastPointer = (page: Page) => page.evaluate(() => (window as unknown as { pointer: { x: number; y: number } }).pointer);
const recordPointer = (page: Page) => page.evaluate(() => addEventListener('wheel', (e) => ((window as unknown as { pointer: { x: number; y: number } }).pointer = { x: e.clientX, y: e.clientY })));
/** A zoom about a point is a scaling of the page about that point: a city goes to p + (old − p) × (new zoom ÷ old zoom). */
const expectHomothety = async (page: Page, city: number, before: { x: number; y: number; zoom: number }) => {
  const p = (await lastPointer(page))!;
  const z = await zoomOf(page);
  const k = z / before.zoom;
  near(await onPage(page, city), { x: p.x + (before.x - p.x) * k, y: p.y + (before.y - p.y) * k });
};
const snapshot = async (page: Page, city: number) => ({ ...(await onPage(page, city)), zoom: await zoomOf(page) });
const near = (a: { x: number; y: number }, b: { x: number; y: number }, tol = 1.5) => {
  expect(Math.abs(a.x - b.x), `x ${a.x} vs ${b.x}`).toBeLessThanOrEqual(tol);
  expect(Math.abs(a.y - b.y), `y ${a.y} vs ${b.y}`).toBeLessThanOrEqual(tol);
};
const sizes = async (page: Page) =>
  map(page).evaluate((svg) => ({
    radii: [...svg.querySelectorAll('circle.city')].map((c) => c.getAttribute('r')),
    widths: [...svg.querySelectorAll('line')].map((l) => getComputedStyle(l).strokeWidth),
  }));

test('the map starts at 1×, with nothing said about a zoom, and is a focusable group with the keys named', async ({ page }) => {
  await open(page, berlin);
  expect(await zoomOf(page)).toBe(1);
  expect(await note(page)).toBe('x → · y ↑');
  await expect(frame(page)).toHaveAttribute('tabindex', '0');
  await expect(frame(page)).toHaveAttribute('role', 'group');
  await expect(frame(page)).toHaveAttribute('aria-label', /plus and minus keys.*arrow keys.*0 resets/i);
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  await expect(page.getByTestId('reset-view')).toBeDisabled();
});

for (const [label, options] of [
  ['16 cities', ulysses],
  ['52 cities', berlin],
] as const) {
  test(`the wheel zooms about the pointer for ${label}: the city under it stays under it, in and out, and the page does not scroll`, async ({ page }) => {
    await open(page, options);
    await page.evaluate(() => addEventListener('wheel', (e) => ((window as unknown as { prevented: boolean }).prevented = e.defaultPrevented)));
    await recordPointer(page);
    const city = await middle(page);
    const where = await onPage(page, city);
    let was = await snapshot(page, city);
    await wheelAt(page, where.x, where.y, -300);
    const z1 = await zoomOf(page);
    expect(z1).toBeGreaterThan(1.5);
    await expectHomothety(page, city, was);
    near(await onPage(page, city), where);
    expect(await page.evaluate(() => (window as unknown as { prevented: boolean }).prevented)).toBe(true);
    was = await snapshot(page, city);
    await wheelAt(page, where.x, where.y, -300);
    expect(await zoomOf(page)).toBeGreaterThan(z1);
    await expectHomothety(page, city, was);
    // a notch at another place of the picture keeps the point under that pointer, not the middle
    const box = (await map(page).boundingBox())!;
    was = await snapshot(page, city);
    await wheelAt(page, box.x + box.width * 0.8, box.y + box.height * 0.3, 120);
    await expectHomothety(page, city, was);
    await wheelAt(page, where.x, where.y, 5000);
    expect(await zoomOf(page)).toBe(1);
    expect(await note(page)).toBe(options.instance === 'berlin52' ? 'x → · y ↑' : 'longitude → · latitude ↑');
  });
}

test('the zoom stops at 40× however far the wheel turns, and says so in the corner', async ({ page }) => {
  await open(page, berlin);
  await recordPointer(page);
  const city = await middle(page);
  const where = await onPage(page, city);
  const was = await snapshot(page, city);
  await wheelAt(page, where.x, where.y, -20000);
  expect(await zoomOf(page)).toBe(40);
  expect(await note(page)).toContain('zoomed 40×, drag to move');
  await expectHomothety(page, city, was);
  await page.mouse.wheel(0, -2000);
  expect(await zoomOf(page)).toBe(40);
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
});

test('zoomed, the picture is bigger and the marks are not: dots, lines and numbers keep their sizes', async ({ page }) => {
  await open(page, berlin);
  const before = await sizes(page);
  const numberSize = () => map(page).locator('text.cl').first().evaluate((e) => getComputedStyle(e).fontSize);
  expect(await numberSize()).toBe('18px');
  const city = await middle(page);
  const where = await onPage(page, city);
  await wheelAt(page, where.x, where.y, -400);
  expect(await zoomOf(page)).toBeGreaterThan(2);
  const after = await sizes(page);
  expect(after.radii.every((r) => r === '6' || r === '9')).toBe(true);
  expect(new Set(after.radii.filter((r) => r === '6')).size).toBe(1);
  expect(new Set(after.widths)).toEqual(new Set(before.widths));
  expect(await numberSize()).toBe('18px');
});

test('the distance between two cities grows with the zoom while a dot does not', async ({ page }) => {
  await open(page, ulysses);
  const all = await places(page);
  const [a, b] = ['1', '2'].map((k) => all[k]!);
  const gap0 = Math.hypot(a![0] - b![0], a![1] - b![1]);
  const city = await middle(page);
  const where = await onPage(page, city);
  await wheelAt(page, where.x, where.y, -200);
  const z = await zoomOf(page);
  const now = await places(page);
  if (now['1'] && now['2']) {
    const gap = Math.hypot(now['1'][0] - now['2'][0], now['1'][1] - now['2'][1]);
    expect(gap / gap0).toBeCloseTo(z, 3);
  }
  expect(await map(page).locator('circle.city').first().getAttribute('r')).toMatch(/^[69]$/);
});

test('a drag moves the picture with the pointer, and cannot take it out of sight', async ({ page }) => {
  await open(page, berlin);
  const city = await middle(page);
  const where = await onPage(page, city);
  await wheelAt(page, where.x, where.y, -600);
  const z = await zoomOf(page);
  expect(z).toBeGreaterThan(3);
  const start = await onPage(page, city);
  const box = (await map(page).boundingBox())!;
  const from = { x: box.x + 200, y: box.y + 100 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 25, from.y + 12, { steps: 3 });
  await page.mouse.move(from.x + 40, from.y + 20, { steps: 3 });
  await page.mouse.up();
  near(await onPage(page, city), { x: start.x + 40, y: start.y + 20 }, 1);
  expect(await zoomOf(page)).toBe(z);
  // dragged again and again to the right and down, the picture's left and top edges reach the window's and go no further
  for (let k = 0; k < 8; k++) {
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 20, box.y + box.height - 20, { steps: 6 });
    await page.mouse.up();
  }
  expect(Number(await map(page).getAttribute('data-cx'))).toBeCloseTo(740 / (2 * z), 6);
  expect(Number(await map(page).getAttribute('data-cy'))).toBeCloseTo(292 / (2 * z), 6);
  for (let k = 0; k < 8; k++) {
    await page.mouse.move(box.x + box.width - 20, box.y + box.height - 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 20, { steps: 6 });
    await page.mouse.up();
  }
  expect(Number(await map(page).getAttribute('data-cx'))).toBeCloseTo(740 - 740 / (2 * z), 6);
  expect(Number(await map(page).getAttribute('data-cy'))).toBeCloseTo(292 - 292 / (2 * z), 6);
});

test('a double-click and the Reset view button return to the whole map; the buttons zoom about the middle', async ({ page }) => {
  await open(page, ulysses);
  const first = await places(page);
  const city = await middle(page);
  const where = await onPage(page, city);
  await wheelAt(page, where.x, where.y, -500);
  expect(await zoomOf(page)).toBeGreaterThan(2);
  await page.mouse.dblclick(where.x, where.y);
  expect(await zoomOf(page)).toBe(1);
  expect(await places(page)).toEqual(first);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const z1 = await zoomOf(page);
  expect(z1).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect(await zoomOf(page)).toBeGreaterThan(z1);
  await expect(page.getByTestId('reset-view')).toBeEnabled();
  // a button zoom is about the middle of the window: the point there stays there
  expect(await map(page).evaluate((svg) => svg.getAttribute('data-cx') + ',' + svg.getAttribute('data-cy'))).toBe('370,146');
  await page.getByRole('button', { name: 'Zoom out' }).click();
  expect(await zoomOf(page)).toBeCloseTo(z1, 5);
  await page.getByTestId('reset-view').click();
  expect(await zoomOf(page)).toBe(1);
  expect(await places(page)).toEqual(first);
});

test('from the keyboard: + and − zoom, the arrow keys move the picture (and do not step the run), 0 resets', async ({ page }) => {
  await open(page, berlin);
  const heading = await page.locator('#pop-heading').innerText();
  const narration = await page.getByTestId('narration').innerText();
  await frame(page).focus();
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  const z1 = await zoomOf(page);
  expect(z1).toBeGreaterThan(1.5);
  await page.keyboard.press('=');
  expect(await zoomOf(page)).toBeGreaterThan(z1);
  await page.keyboard.press('-');
  expect(await zoomOf(page)).toBeCloseTo(z1, 5);
  const city = await middle(page);
  const start = await onPage(page, city);
  await page.keyboard.press('ArrowLeft');
  const left = await onPage(page, city);
  expect(left.x).toBeGreaterThan(start.x + 5);
  await page.keyboard.press('ArrowUp');
  expect((await onPage(page, city)).y).toBeGreaterThan(start.y + 5);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  near(await onPage(page, city), start);
  // the arrow keys moved the picture, not the run
  expect(await page.locator('#pop-heading').innerText()).toBe(heading);
  expect(await page.getByTestId('narration').innerText()).toBe(narration);
  await page.keyboard.press('0');
  expect(await zoomOf(page)).toBe(1);
  // out of the map's focus the arrow keys step as ever
  await page.getByTestId('show-map').focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.getByTestId('narration').innerText()).not.toBe(narration);
});

test('at 1× the arrow keys have nothing to move, so with the map focused they still step the run', async ({ page }) => {
  await open(page, berlin);
  const narration = await page.getByTestId('narration').innerText();
  await frame(page).focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.getByTestId('narration').innerText()).not.toBe(narration);
  expect(await zoomOf(page)).toBe(1);
});

test('zoom and pan are kept through steps, a generation, play, scrubbing, the other tab and a restart; another instance starts over', async ({ page }) => {
  await open(page, ulysses);
  const city = await middle(page);
  const where = await onPage(page, city);
  await wheelAt(page, where.x, where.y, -500);
  await frame(page).focus();
  await page.keyboard.press('ArrowLeft');
  const z = await zoomOf(page);
  const spot = await onPage(page, city);
  const same = async (what: string) => {
    expect(await zoomOf(page), what).toBeCloseTo(z, 9);
    near(await onPage(page, city), spot);
    expect(await note(page), what).toContain('zoomed');
  };
  await page.getByTestId('narration').click();
  await page.keyboard.press('ArrowRight');
  await same('a micro-step');
  await page.keyboard.press('g');
  await same('a generation');
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await same('play');
  await page.getByTestId('scrub').focus();
  await page.keyboard.press('Home');
  await same('scrubbing back');
  await page.keyboard.press('End');
  await same('scrubbing forward');
  await page.getByTestId('show-stage').click();
  await page.getByTestId('show-map').click();
  await same('the other tab');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await same('a restart with the same instance');
  // another instance: the zoom starts over
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#instance').selectOption('berlin52');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('problem-chip')).toHaveText('berlin52');
  await page.getByTestId('show-map').click();
  expect(await zoomOf(page)).toBe(1);
  expect(await note(page)).toBe('x → · y ↑');
});

test('the map says its zoom in its name and its sentence; at 1× they are the sentence alone', async ({ page }) => {
  await open(page, berlin);
  const plain = await page.getByTestId('route-sentence').innerText();
  await expect(map(page)).toHaveAttribute('aria-label', plain);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const z = await zoomOf(page);
  const shown = Math.round(z * 10) / 10;
  await expect(page.getByTestId('route-sentence')).toHaveText(`${plain} Zoomed ${shown}×: a part of the map is shown.`);
  await expect(map(page)).toHaveAttribute('aria-label', `${plain} Zoomed ${shown}×: a part of the map is shown.`);
  await page.getByTestId('reset-view').click();
  await expect(page.getByTestId('route-sentence')).toHaveText(plain);
});

test('zoomed, the stage marks still show: the child edges and the sentence of the mark, then the removed and added edges and the crosses', async ({ page }) => {
  await open(page, ulysses);
  const city = await middle(page);
  const where = await onPage(page, city);
  await wheelAt(page, where.x, where.y, -250);
  await page.getByTestId('narration').click();
  const seen = new Set<string>();
  for (let k = 0; k < 140; k++) {
    await page.keyboard.press('ArrowRight');
    for (const layer of ['child', 'removed', 'added']) if ((await map(page).locator(`line[data-layer="${layer}"]`).count()) > 0) seen.add(layer);
    if (seen.has('child') && seen.has('removed')) break;
  }
  expect(seen.has('child')).toBe(true);
  expect(await page.getByTestId('route-mark').count()).toBe(1);
  expect(await zoomOf(page)).toBeGreaterThan(1);
});

test('reduced motion: a zoom is one jump, nothing animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, berlin);
  const city = await middle(page);
  const where = await onPage(page, city);
  await wheelAt(page, where.x, where.y, -300);
  const running = await page.evaluate(() => document.getAnimations().length);
  expect(running).toBe(0);
  const transitions = await map(page).evaluate((svg) => [...svg.querySelectorAll('*')].filter((e) => getComputedStyle(e).transitionDuration.split(',').some((d) => parseFloat(d) > 0)).length);
  expect(transitions).toBe(0);
});

test('no control of the zoom is without a name, and none is a mouse-only control', async ({ page }) => {
  await open(page, berlin);
  const tree = await page.locator('.rmview .lbar').ariaSnapshot();
  expect(tree.split('\n').filter((l) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio)(\s+\[[^\]]*\])*:?\s*$/.test(l))).toEqual([]);
  for (const name of ['Zoom in', 'Zoom out', 'Reset view']) await expect(page.getByRole('button', { name })).toHaveCount(1);
});

const inside = async (loc: Locator, within: Locator, what: string) => {
  const frameBox = (await within.boundingBox())!;
  const boxes = await loc.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })));
  for (const b of boxes) {
    expect(b.l, `${what} left`).toBeGreaterThanOrEqual(frameBox.x - 0.5);
    expect(b.r, `${what} right`).toBeLessThanOrEqual(frameBox.x + frameBox.width + 0.5);
    expect(b.t, `${what} top`).toBeGreaterThanOrEqual(frameBox.y - 0.5);
    expect(b.b, `${what} bottom`).toBeLessThanOrEqual(frameBox.y + frameBox.height + 0.5);
  }
  return boxes.length;
};

for (const projector of [false, true]) {
  for (const [width, height] of [[1920, 1080], [1366, 768]] as const) {
    for (const [label, options] of [['16 cities', ulysses], ['52 cities', berlin]] as const) {
      test(`no dot, ring, ✕ or number lies outside the picture at any zoom or pan: ${label} at ${width}×${height}${projector ? ' in projector mode' : ''}`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height });
        await open(page, options, projector);
        // a stage with rings and crosses on the map: the end of the first mutation, and the map zoomed in on the way
        const city = await middle(page);
        const where = await onPage(page, city);
        const box = (await map(page).boundingBox())!;
        const svg = map(page);
        let counted = 0;
        for (const [dy, drag] of [[0, [0, 0]], [-250, [0, 0]], [-250, [-150, 60]], [-300, [200, -90]], [-400, [-3000, 3000]], [-300, [3000, 3000]], [900, [0, 0]]] as const) {
          if (dy !== 0) await wheelAt(page, where.x, where.y, dy);
          if (drag[0] !== 0 || drag[1] !== 0) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2 + Math.max(-box.width / 2 + 3, Math.min(box.width / 2 - 3, drag[0])), box.y + box.height / 2 + Math.max(-box.height / 2 + 3, Math.min(box.height / 2 - 3, drag[1])), { steps: 6 });
            await page.mouse.up();
          }
          counted += await inside(svg.locator('circle.city'), svg, 'dots');
          await inside(svg.locator('text.cl'), svg, 'numbers');
          await inside(svg.locator('text.axes'), svg, 'the note');
          await inside(svg.locator('text.cross'), svg, 'crosses');
        }
        expect(counted).toBeGreaterThan(0);
        // with stage marks: step into a mutation of the first generation and look again at a zoom
        await page.getByTestId('reset-view').click();
        await page.getByRole('button', { name: 'Zoom in' }).click();
        await page.getByRole('button', { name: 'Zoom in' }).click();
        await page.getByTestId('narration').click();
        for (let k = 0; k < 120; k++) {
          await page.keyboard.press('ArrowRight');
          if (k % 7 === 0) {
            await inside(svg.locator('circle.city'), svg, 'dots in a stage');
            await inside(svg.locator('text.cl'), svg, 'numbers in a stage');
            await inside(svg.locator('text.cross'), svg, 'crosses in a stage');
          }
        }
      });
    }
  }
}

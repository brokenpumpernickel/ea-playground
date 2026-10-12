import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { landscapeFunctions, landscapeProblem, type LandscapeFunction, type LandscapeOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { landscapeInfoOf } from '../src/ui/landscape-context';
import { defaultView, dragBy, rasterise, rotate, surfaceMesh, viewLimits } from '../src/ui/surface-projection';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const options = (fn: LandscapeFunction): LandscapeOptions => ({ function: fn, representation: 'real', bitsPerVariable: 8 });

const open = async (page: Page, fn: LandscapeFunction = 'two-peaks', projector = false) => {
  const opts = options(fn);
  const d = defaultsOf(entry, opts);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(opts), init: { kind: 'random', size: 12 } }, d.params, 7, 'landscape', opts)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-landscape').click();
  await expect(page.getByTestId('surface')).toBeVisible();
};
const camera = async (page: Page) => {
  const canvas = page.getByTestId('surface');
  return { az: Number(await canvas.getAttribute('data-az')), el: Number(await canvas.getAttribute('data-el')) };
};
const pixels = (page: Page, at: [number, number][]) =>
  page.getByTestId('surface').evaluate((canvas, points) => {
    const ctx = (canvas as HTMLCanvasElement).getContext('2d')!;
    return points.map(([x, y]) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)]);
  }, at);

test('the surface sits beside the heatmap, starts at the mock’s camera, and has named buttons for left, right, up, down and reset', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  expect(await camera(page)).toEqual(defaultView);
  const names = ['Rotate the surface left', 'Rotate the surface right', 'Tilt the surface up', 'Tilt the surface down', 'Reset the view of the surface'];
  for (const name of names) await expect(page.getByRole('button', { name })).toBeVisible();
  const heat = (await page.getByTestId('heatmap').boundingBox())!;
  const surf = (await page.getByTestId('surface').boundingBox())!;
  expect(surf.x).toBeGreaterThan(heat.x + heat.width - 1);
  expect(Math.abs(surf.y - heat.y)).toBeLessThan(2);
});

test('the buttons turn it by the model’s steps and reset returns it; the tilt stops at its limits', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  let want = defaultView;
  for (const [name, action] of [['Rotate the surface left', 'left'], ['Rotate the surface right', 'right'], ['Rotate the surface right', 'right'], ['Tilt the surface up', 'up'], ['Tilt the surface down', 'down'], ['Tilt the surface down', 'down']] as const) {
    await page.getByRole('button', { name }).click();
    want = rotate(want, action);
    expect(await camera(page)).toEqual(want);
  }
  for (let k = 0; k < 20; k++) await page.getByRole('button', { name: 'Tilt the surface up' }).click();
  expect((await camera(page)).el).toBe(viewLimits.maxElevation);
  await page.getByRole('button', { name: 'Reset the view of the surface' }).click();
  expect(await camera(page)).toEqual(defaultView);
});

test('the arrow keys turn it while it has focus, and do nothing to the run (the stepping keys stay for the rest of the screen)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await page.getByTestId('surface-focus').focus();
  const before = await page.getByTestId('narration').innerText();
  let want = defaultView;
  for (const [key, action] of [['ArrowLeft', 'left'], ['ArrowRight', 'right'], ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowDown', 'down']] as const) {
    await page.keyboard.press(key);
    want = rotate(want, action);
    expect(await camera(page)).toEqual(want);
  }
  expect(await page.getByTestId('narration').innerText()).toBe(before); // the arrow keys did not step the run
  await page.getByRole('button', { name: 'Reset the view of the surface' }).click();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowRight'); // with the focus elsewhere the arrow steps the run as always
  expect(await page.getByTestId('narration').innerText()).not.toBe(before);
});

test('dragging turns it by the distance dragged', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  const box = (await page.getByTestId('surface').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y - 20, { steps: 4 });
  await page.mouse.up();
  const want = dragBy(defaultView, 40, -20);
  const got = await camera(page);
  expect(got.az).toBeCloseTo(want.az, 6);
  expect(got.el).toBeCloseTo(want.el, 6);
  // moving the mouse with no button down does nothing
  await page.mouse.move(x + 100, y + 50);
  expect(await camera(page)).toEqual(got);
});

for (const fn of landscapeFunctions) {
  test(`${fn}: pixels at the projected positions of cells are the colours of those cells, for the starting camera and a turned one; the optimum is marked`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await open(page, fn);
    const info = landscapeInfoOf(landscapeProblem(options(fn)));
    for (const turn of [0, 2]) {
      for (let k = 0; k < turn; k++) await page.getByRole('button', { name: 'Rotate the surface right' }).click();
      await page.getByRole('button', { name: 'Tilt the surface down' }).click().catch(() => undefined);
      const view = await camera(page);
      const mesh = surfaceMesh(info, view, 520, 300);
      const ids = rasterise(mesh);
      // the centre of each of 300 cells, where nothing nearer covers it
      const wanted: { at: [number, number]; colour: readonly number[] }[] = [];
      for (let k = 0; k < mesh.quads.length && wanted.length < 300; k += 2) {
        const q = mesh.quads[k]!;
        const cx = Math.round(q.pts.reduce((s, p) => s + p.sx, 0) / 4);
        const cy = Math.round(q.pts.reduce((s, p) => s + p.sy, 0) / 4);
        if (cx < 2 || cy < 2 || cx > 517 || cy > 297) continue;
        if (ids.data[cy * 520 + cx] !== k + 1) continue;
        // a cell only a few pixels across is mostly its own edge line, which darkens its centre
        const area = Math.abs(q.pts.reduce((sum, p, n) => sum + (p.sx * q.pts[(n + 1) % 4]!.sy - q.pts[(n + 1) % 4]!.sx * p.sy), 0)) / 2;
        if (area < 24) continue;
        // a cell whose neighbours are very different colours (Rastrigin’s many small hills) is smoothed into them by the canvas
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => mesh.quads[mesh.codeOf(q.i + di!, q.j + dj!) - 1]).filter((n) => n !== undefined);
        if (near.some((n) => n!.colour.some((v, c) => Math.abs(v - q.colour[c]!) > 40))) continue;
        // away from the optimum mark
        if (info.optima.some((o) => Math.hypot(mesh.project(o.x, o.y, info.fitnessAt(o.x, o.y)).sx - cx, mesh.project(o.x, o.y, info.fitnessAt(o.x, o.y)).sy - cy) < 14)) continue;
        wanted.push({ at: [cx, cy], colour: q.colour });
      }
      expect(wanted.length).toBeGreaterThan(25);
      const got = await pixels(page, wanted.map((w) => w.at));
      let off = 0;
      got.forEach((p, k) => {
        // a cell's edge is drawn over its fill with a faint line and the canvas smooths it, so the centre is the cell's colour to a few levels
        if (p.some((v, c) => Math.abs(v - wanted[k]!.colour[c]!) > 30)) off++;
      });
      expect(off / wanted.length, `cells whose centre is not their colour (turn ${turn})`).toBeLessThan(0.1);
      // the optimum mark: white at its projected point
      const o = info.optima[0]!;
      const p = mesh.project(o.x, o.y, info.fitnessAt(o.x, o.y));
      if (p.sx > 10 && p.sx < 510 && p.sy > 10 && p.sy < 290) {
        const [centre] = await pixels(page, [[p.sx, p.sy]]);
        centre!.forEach((v) => expect(v).toBeGreaterThan(225));
      }
    }
  });
}

test('the surface keeps its size from generation to generation and when it is turned', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  const size = async () => {
    const b = (await page.getByTestId('surface').boundingBox())!;
    return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
  };
  const first = await size();
  expect(first[2]).toBe(524); // 520 and its 2 px border
  expect(first[3]).toBe(304);
  for (let g = 0; g < 4; g++) {
    await page.keyboard.press('g');
    expect(await size()).toEqual(first);
  }
  await page.getByRole('button', { name: 'Rotate the surface left' }).click();
  expect(await size()).toEqual(first);
});

test('a restart returns the surface to the starting camera; switching tabs and back keeps what was turned', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await page.getByRole('button', { name: 'Rotate the surface right' }).click();
  const turned = await camera(page);
  await page.getByTestId('show-stage').click();
  await page.getByTestId('show-landscape').click();
  expect(await camera(page)).toEqual(turned);
  await page.getByRole('button', { name: /New/ }).click();
  await page.getByTestId('show-landscape').click();
  expect(await camera(page)).toEqual(defaultView);
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const projector of [false, true]) {
    test(`at ${width}×${height}${projector ? ' in projector mode' : ''}: heatmap, surface and controls fit the panel for every function, in the starting camera and the extreme ones, with the narration clear`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const fn of landscapeFunctions) {
        await open(page, fn, projector);
        for (const action of [null, 'Tilt the surface up', 'Tilt the surface down', 'Rotate the surface left']) {
          if (action) for (let k = 0; k < 12; k++) await page.getByRole('button', { name: action }).click();
          const problems = await page.evaluate(() => {
            const out: string[] = [];
            const body = document.querySelector('#stagebody')!.getBoundingClientRect();
            const narr = document.querySelector('#narr')!.getBoundingClientRect();
            for (const el of document.querySelectorAll('.lview, .lview canvas, .lview .lsent, .lview .lbar, .lview figure, .lview .lbar button')) {
              const r = el.getBoundingClientRect();
              if (r.right > body.right + 1 || r.bottom > body.bottom + 1 || r.left < body.left - 1) out.push(`${el.tagName.toLowerCase()}.${el.className} leaves the stage body`);
              if (r.bottom > narr.top + 1 && r.top < narr.bottom) out.push(`${el.tagName.toLowerCase()}.${el.className} runs into the narration`);
            }
            const [heat, surf] = [...document.querySelectorAll('.lview canvas')].map((c) => c.getBoundingClientRect());
            if (heat && surf && heat.right > surf.left + 1) out.push('the two views overlap');
            const view = document.querySelector('.lview')!;
            if (view.scrollHeight > view.clientHeight + 1) out.push(`view scrolls ${view.scrollHeight}>${view.clientHeight}`);
            const bar = document.querySelector('.lbar')!;
            const tops = new Set([...bar.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top)));
            if (tops.size > 1) out.push('the toolbar wraps onto several lines');
            if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
            return out;
          });
          expect(problems, `${fn} ${action ?? 'start'}`).toEqual([]);
        }
      }
    });
  }
}

test('the other problems have no surface', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('surface')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rotate the surface left' })).toHaveCount(0);
});

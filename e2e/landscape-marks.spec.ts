import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeProblem, type GaParams, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { heatLayout, pixelOf } from '../src/ui/heatmap-draw';
import { canvasSize } from '../src/ui/landscape-canvas';
import { landscapeInfoOf } from '../src/ui/landscape-context';
import { isHidden, rasterise, surfaceMesh } from '../src/ui/surface-projection';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const real: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 8 };

const paramsOf = (options: LandscapeOptions, change: (p: GaParams) => GaParams = (p) => p): GaParams => change({ ...defaultsOf(entry, options).params, elites: 2 });
const open = async (page: Page, options: LandscapeOptions = real, size = 12, change: (p: GaParams) => GaParams = (p) => p, projector = false, init?: string[]) => {
  await page.goto('about:blank');
  await page.goto(
    url + encodeConfig(configOf({ problem: entry.create(options), init: init ? { kind: 'explicit', chromosomes: init } : { kind: 'random', size } }, paramsOf(options, change), 7, 'landscape', options)),
  );
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const engineRun = (options: LandscapeOptions, change: (p: GaParams) => GaParams = (p) => p, size = 12, init?: string[]) =>
  createRun(gaAlgorithm, { setup: { problem: landscapeProblem(options), init: init ? { kind: 'explicit', chromosomes: init } : { kind: 'random', size } }, params: paramsOf(options, change), seed: 7 });
const showLandscape = async (page: Page) => {
  await page.getByTestId('show-landscape').click();
  await expect(page.getByTestId('heat-marks')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // so the stepping keys reach the screen, not the tab button
};
const shapeOf = (page: Page, layer: 'heat-marks' | 'surface-marks', id: number) => page.getByTestId(layer).locator(`[data-marker="individual"][data-id="${id}"] .body, [data-marker="individual"][data-id="${id}"] .ghost`).first();
const markers = (page: Page, layer: 'heat-marks' | 'surface-marks', kind: 'individual' | 'child' = 'individual') =>
  page.getByTestId(layer).evaluate(
    (svg, wanted) =>
      [...svg.querySelectorAll(`[data-marker="${wanted}"]`)].map((g) => ({
        id: g.getAttribute('data-id') === null ? null : Number(g.getAttribute('data-id')),
        offspring: g.getAttribute('data-offspring') === null ? null : Number(g.getAttribute('data-offspring')),
        shape: g.getAttribute('data-shape'),
        x: Number(g.getAttribute('data-x')),
        y: Number(g.getAttribute('data-y')),
        px: Number(g.getAttribute('data-px')),
        py: Number(g.getAttribute('data-py')),
        selected: g.getAttribute('data-selected') === 'true',
        hidden: g.getAttribute('data-hidden') === 'true',
        clamped: g.getAttribute('data-clamped'),
      })),
    kind,
  );

test('both views mark every individual of the population shown at its decoded point, in every generation, for the real pair and for both codings', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const options of [real, { ...real, representation: 'plain' as const }, { ...real, representation: 'gray' as const }]) {
    const change = (p: GaParams): GaParams => (options.representation === 'real' ? p : { ...p, crossover: { enabled: true, operator: 'one-point', probability: 0.9 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.05 } });
    await open(page, options, 12, change);
    await showLandscape(page);
    const run = engineRun(options, change);
    for (let g = 0; g <= 3; g++) {
      if (g > 0) {
        await page.keyboard.press('g');
        run.forwardCycle();
      }
      const state = run.snapshot(g).state;
      for (const layer of ['heat-marks', 'surface-marks'] as const) {
        const got = await markers(page, layer);
        for (const m of got) {
          const i = state.population.find((x) => x.id === m.id)!;
          expect(i, `${options.representation} generation ${g} ${layer}: individual ${m.id}`).toBeDefined();
          expect([m.x, m.y]).toEqual(i.values);
        }
        // everyone is drawn unless the surface hides it off the picture (the heatmap shows the whole landscape, so all are there)
        if (layer === 'heat-marks') expect(got.map((m) => m.id)).toEqual(state.population.map((i) => i.id));
        else expect(got.length).toBeGreaterThan(state.population.length - 4);
      }
      const heat = await markers(page, 'heat-marks');
      const elites = run.events(g).flatMap((e) => (e.stage === 'replacement' ? e.elites : []));
      expect(heat.filter((m) => m.shape === 'diamond').map((m) => m.id).sort()).toEqual([...elites].sort());
      const best = state.population.reduce((b, i) => (i.fitness > b.fitness ? i : b));
      if (!elites.includes(best.id)) expect(heat.find((m) => m.shape === 'star')?.id).toBe(best.id);
    }
  }
});

test('on the heatmap the markers are at the pixels the heatmap gives their points, inside the plot', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await showLandscape(page);
  await page.keyboard.press('g');
  const layout = heatLayout(canvasSize.width, canvasSize.height);
  const region = { x0: -5, x1: 5, y0: -5, y1: 5 };
  for (const m of await markers(page, 'heat-marks')) {
    const at = pixelOf(layout, region, m.x, m.y);
    expect(m.px).toBeCloseTo(at.px, 6);
    expect(m.py).toBeCloseTo(at.py, 6);
    expect(m.px).toBeGreaterThanOrEqual(layout.L - 0.5);
    expect(m.px).toBeLessThanOrEqual(layout.R);
    expect(m.py).toBeGreaterThanOrEqual(layout.T - 0.5);
    expect(m.py).toBeLessThanOrEqual(layout.B);
  }
});

test('a click on a marker highlights that individual on both views and in the table and the sentence; a click on a table row or its keyboard equivalent does the same; again clears it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await showLandscape(page);
  const target = (await markers(page, 'heat-marks'))[3]!;
  await shapeOf(page, 'heat-marks', target.id!).click();
  const selected = async () => ({
    heat: (await markers(page, 'heat-marks')).filter((m) => m.selected).map((m) => m.id),
    surface: (await markers(page, 'surface-marks')).filter((m) => m.selected).map((m) => m.id),
    rows: await page.locator('tr.sel').evaluateAll((rows) => rows.map((r) => Number(r.getAttribute('data-id')))),
  });
  expect(await selected()).toEqual({ heat: [target.id], surface: [target.id], rows: [target.id] });
  await expect(page.getByTestId('population-sentence')).toContainText(`Individual ${target.id} is selected`);
  await expect(page.getByTestId(`select-${target.id}`)).toHaveAttribute('aria-pressed', 'true');
  // the same by the table
  const other = (await markers(page, 'heat-marks'))[6]!;
  await page.getByTestId(`select-${other.id}`).click();
  expect(await selected()).toEqual({ heat: [other.id], surface: [other.id], rows: [other.id] });
  await page.getByTestId(`select-${other.id}`).click();
  expect(await selected()).toEqual({ heat: [], surface: [], rows: [] });
  // and from the surface
  const onSurface = (await markers(page, 'surface-marks'))[2]!;
  await shapeOf(page, 'surface-marks', onSurface.id!).click();
  expect((await selected()).heat).toEqual([onSurface.id]);
});

test('the keyboard selects: with the heatmap’s marks focused the arrow keys move the selection through the individuals, Home and End jump, Escape clears; the row buttons work with Enter', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await showLandscape(page);
  const ids = (await markers(page, 'heat-marks')).map((m) => m.id!);
  await page.getByTestId('heat-marks').focus();
  const narration = await page.getByTestId('narration').innerText();
  const current = async () => (await markers(page, 'heat-marks')).find((m) => m.selected)?.id;
  await page.keyboard.press('ArrowRight');
  expect(await current()).toBe(ids[0]);
  await page.keyboard.press('ArrowRight');
  expect(await current()).toBe(ids[1]);
  await page.keyboard.press('ArrowLeft');
  expect(await current()).toBe(ids[0]);
  await page.keyboard.press('ArrowLeft');
  expect(await current()).toBe(ids[ids.length - 1]); // wraps round
  await page.keyboard.press('Home');
  expect(await current()).toBe(ids[0]);
  await page.keyboard.press('End');
  expect(await current()).toBe(ids[ids.length - 1]);
  await page.keyboard.press('Escape');
  expect(await current()).toBeUndefined();
  await expect(page.locator('#drawer')).toHaveCount(0); // Escape did not touch anything else
  await page.getByTestId(`select-${ids[4]}`).focus();
  await page.keyboard.press('Enter');
  expect(await current()).toBe(ids[4]);
  // with the arrow keys used on the marks, the run did not step
  expect(await page.getByTestId('narration').innerText()).toBe(narration);
});

test('the selection starts over with the run', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await showLandscape(page);
  const id = (await markers(page, 'heat-marks'))[1]!.id;
  await page.getByTestId(`select-${id}`).click();
  await page.getByRole('button', { name: /New/ }).click();
  await expect(page.locator('tr.sel')).toHaveCount(0);
  await page.getByTestId('show-landscape').click();
  expect((await markers(page, 'heat-marks')).filter((m) => m.selected)).toEqual([]);
});

test('the stage marks follow the micro-steps: the pair’s parents are squares marked A and B, offspring appear as triangles as they are made, a mutated one has an arrow from where it was, and a clamped step is noted', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const change = (p: GaParams): GaParams => ({ ...p, crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 3 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.9, sigma: 0.9 } });
  await open(page, real, 10, change);
  const run = engineRun(real, change, 10);
  run.forwardCycle();
  const pairing = run.events(1).flatMap((e) => (e.stage === 'pairing' ? [e] : []));
  const crossover = run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
  const mutation = run.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
  await showLandscape(page);
  // into generation 1: selection and pairing are complete, then the crossover micro-steps
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 2; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight'); // enters the crossover stage (no pair made yet)
  for (let k = 1; k <= crossover.length; k++) {
    await page.keyboard.press('ArrowRight');
    const heat = await markers(page, 'heat-marks');
    const squares = heat.filter((m) => m.shape === 'square');
    expect(squares.map((m) => m.id).sort()).toEqual([...new Set([pairing[k - 1]!.parentAId, pairing[k - 1]!.parentBId])].sort());
    const kids = await markers(page, 'heat-marks', 'child');
    expect(kids.map((c) => c.offspring)).toEqual(crossover.slice(0, k).flatMap((e) => e.children.filter((c) => !c.discarded).map((c) => c.offspring)));
    for (const c of kids) {
      const event = crossover.flatMap((e) => e.children).find((x) => x.offspring === c.offspring)!;
      expect([c.x, c.y]).toEqual([event.chromosome[0], event.chromosome[1]]);
      expect(c.clamped).toBe((event.clamped ?? []).some(Boolean) ? (event.clamped ?? []).flatMap((x, g) => (x ? [g + 1] : [])).join(',') : null);
    }
    // the same offspring on the surface
    expect((await markers(page, 'surface-marks', 'child')).length).toBeGreaterThan(kids.length - 3);
  }
  // mutation: enter the stage, then the micro-steps
  await page.keyboard.press('ArrowRight');
  let arrows = 0;
  let clamped = 0;
  for (let k = 1; k <= mutation.length; k++) {
    await page.keyboard.press('ArrowRight');
    const kids = await markers(page, 'heat-marks', 'child');
    const e = mutation[k - 1]!;
    const mine = kids.find((c) => c.offspring === e.offspring)!;
    expect([mine.x, mine.y]).toEqual([e.after[0], e.after[1]]);
    const arrow = await page.getByTestId('heat-marks').getByTestId('mutation-arrow').count();
    expect(arrow).toBe(e.decision === 'mutated' ? 1 : 0);
    arrows += arrow;
    if ((e.gaussian ?? []).some((s) => s.clamped)) {
      clamped++;
      expect(mine.clamped).toBe((e.gaussian ?? []).filter((s) => s.clamped).map((s) => s.gene).join(','));
    }
  }
  expect(arrows).toBeGreaterThan(2);
  expect(clamped).toBeGreaterThan(0);
});

test('trails: the last 1, 3 or 5 generations as fading dots at the recorded positions, nothing at the start, off by default, following the cursor', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  const run = engineRun(real);
  for (let g = 0; g < 5; g++) run.forwardCycle();
  for (let g = 0; g < 5; g++) await page.keyboard.press('g');
  await showLandscape(page);
  await expect(page.getByTestId('trail-0')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('heat-marks').locator('.trail')).toHaveCount(0);
  for (const [n, expectedGens] of [[1, [4]], [3, [2, 3, 4]], [5, [0, 1, 2, 3, 4]]] as const) {
    await page.getByTestId(`trail-${n}`).click();
    const trails = await page.getByTestId('heat-marks').locator('.trail').evaluateAll((els) => els.map((el) => ({ generation: Number(el.getAttribute('data-generation')), dots: el.querySelectorAll('circle').length, opacity: Number((el as HTMLElement).style.opacity) })));
    expect(trails.map((t) => t.generation)).toEqual(expectedGens);
    trails.forEach((t) => expect(t.dots).toBe(run.snapshot(t.generation).state.population.length));
    for (let k = 1; k < trails.length; k++) expect(trails[k]!.opacity).toBeGreaterThan(trails[k - 1]!.opacity);
    expect(await page.getByTestId('surface-marks').locator('.trail').count()).toBe(expectedGens.length);
  }
  // scrubbing the cursor back (the history strip) shows the trails of that generation
  await page.getByRole('button', { name: /Back/ }).click();
  const gens = await page.getByTestId('heat-marks').locator('.trail').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-generation'))));
  expect(gens.length).toBeGreaterThan(0);
  expect(Math.max(...gens)).toBeLessThanOrEqual(4);
});

test('the marks follow the history cursor: stepping back shows the earlier population, and the text alternative and the table of positions say the same', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  const run = engineRun(real);
  for (let g = 0; g < 3; g++) {
    run.forwardCycle();
    await page.keyboard.press('g');
  }
  await showLandscape(page);
  await page.getByRole('button', { name: /Back/ }).click(); // one micro-step back from the live end: inside generation 3, so the table shows its parents, generation 2
  const shown = Number((await page.locator('h2#pop-heading').innerText()).match(/generation (\d+)/)![1]);
  expect(shown).toBe(2);
  const state = run.snapshot(shown).state;
  expect((await markers(page, 'heat-marks')).map((m) => m.id)).toEqual(state.population.map((i) => i.id));
  const best = state.population.reduce((b, i) => (i.fitness > b.fitness ? i : b));
  await expect(page.getByTestId('population-sentence')).toContainText(`Generation ${shown}: ${state.population.length} individuals; the best is individual ${best.id}`);
  const rows = await page.getByTestId('positions-table').locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
  expect(rows).toHaveLength(state.population.length);
  rows.forEach((r, k) => {
    const i = state.population[k]!;
    expect(r.slice(0, 4)).toEqual([String(i.id), i.values![0]!.toFixed(3), i.values![1]!.toFixed(3), i.fitness.toFixed(3)]);
  });
});

test('on the surface a marker behind a ridge is a dashed ring with no label, as the projection says; one in front is not', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const init = ['3 4.9', '3 -3', '3 3', '-2.5 -2.5'];
  await open(page, real, 4, (p) => p, false, init);
  await showLandscape(page);
  // look along +y at a low angle: three turns to the right from the starting azimuth, and the tilt all the way down
  for (let k = 0; k < 3; k++) await page.getByRole('button', { name: 'Rotate the surface right' }).click();
  for (let k = 0; k < 12; k++) await page.getByRole('button', { name: 'Tilt the surface down' }).click();
  const canvas = page.getByTestId('surface');
  const view = { az: Number(await canvas.getAttribute('data-az')), el: Number(await canvas.getAttribute('data-el')) };
  const info = landscapeInfoOf(landscapeProblem(real));
  const mesh = surfaceMesh(info, view, canvasSize.width, canvasSize.height);
  const ids = rasterise(mesh);
  const lift = (mesh.fmax - mesh.fmin) * 0.012;
  const got = await markers(page, 'surface-marks');
  expect(got.length).toBeGreaterThan(0);
  let hidden = 0;
  for (const m of got) {
    const q = mesh.project(m.x, m.y, info.fitnessAt(m.x, m.y) + lift);
    const want = isHidden(mesh, ids, { x: m.x, y: m.y }, q.sx, q.sy);
    expect(m.hidden, `individual ${m.id} at (${m.x}, ${m.y})`).toBe(want);
    if (want) hidden++;
  }
  expect(hidden).toBeGreaterThan(0);
  expect(got.some((m) => !m.hidden)).toBe(true);
  // a hidden marker has no label
  await expect(page.getByTestId('surface-marks').locator('[data-hidden="true"] .lab')).toHaveCount(0);
});

test('every control of the landscape view has a name, and the marks are hidden from screen readers (the sentence and the table speak for them)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await showLandscape(page);
  const tree = await page.locator('body').ariaSnapshot();
  const unnamed = tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
  expect(unnamed).toEqual([]);
  expect(await page.getByTestId('surface-marks').getAttribute('aria-hidden')).toBe('true');
  await expect(page.getByTestId('heat-marks')).toHaveAttribute('aria-label', /select the previous or next individual/);
  for (const n of [0, 1, 3, 5]) await expect(page.getByTestId(`trail-${n}`)).toHaveAttribute('aria-pressed', /true|false/);
});

test('with reduced motion nothing moves: the marks appear where they are, and stepping and rotating work as usual', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await open(page);
  await showLandscape(page);
  await page.keyboard.press('g');
  expect((await markers(page, 'heat-marks')).length).toBe(12);
  const animated = await page.evaluate(() => document.getAnimations().length);
  expect(animated).toBe(0);
  await page.getByRole('button', { name: 'Rotate the surface left' }).click();
  expect((await markers(page, 'surface-marks')).length).toBeGreaterThan(5);
  await context.close();
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const size of [12, 60]) {
    test(`at ${width}×${height} in projector mode with ${size} individuals: at every micro-step of two generations the landscape view fits its panel, every mark is inside its picture, and the narration is clear`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, real, size, (p) => ({ ...p, elites: 2 }), true);
      await showLandscape(page);
      await page.getByTestId('trail-3').click();
      const check = async (what: string) => {
        const problems = await page.evaluate(() => {
          const out: string[] = [];
          const body = document.querySelector('#stagebody')!.getBoundingClientRect();
          const narr = document.querySelector('#narr')!.getBoundingClientRect();
          for (const el of document.querySelectorAll('.lview, .lview canvas, .lview .lsent, .lview .lkey, .lview .lbar, .lview figure')) {
            const r = el.getBoundingClientRect();
            if (r.right > body.right + 1 || r.bottom > body.bottom + 1 || r.left < body.left - 1) out.push(`${el.tagName.toLowerCase()}.${el.className} leaves the stage body`);
            if (r.bottom > narr.top + 1 && r.top < narr.bottom) out.push(`${el.tagName.toLowerCase()}.${el.className} runs into the narration`);
          }
          const view = document.querySelector('.lview')!;
          if (view.scrollHeight > view.clientHeight + 1) out.push(`view scrolls ${view.scrollHeight}>${view.clientHeight}`);
          const tops = new Set([...document.querySelectorAll('.lbar button')].map((b) => Math.round(b.getBoundingClientRect().top)));
          if (tops.size > 1) out.push('the toolbar wraps');
          for (const [layer, canvasSelector] of [['heat-marks', '[data-testid="heatmap"]'], ['surface-marks', '[data-testid="surface"]']] as const) {
            const svg = document.querySelector(`[data-testid="${layer}"]`)!;
            const canvas = document.querySelector(canvasSelector) as HTMLCanvasElement; // its own pixels: the whole screen is scaled to fit the window
            for (const mark of svg.querySelectorAll('[data-marker], .dot')) {
              const px = Number(mark.getAttribute('data-px') ?? mark.getAttribute('cx'));
              const py = Number(mark.getAttribute('data-py') ?? mark.getAttribute('cy'));
              if (Number.isNaN(px)) continue;
              if (px < 0 || px > canvas.width || py < 0 || py > canvas.height) out.push(`${layer}: a mark is outside its picture at ${px},${py}`);
            }
          }
          if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
          return out;
        });
        expect(problems, what).toEqual([]);
      };
      await check('start');
      for (let k = 0; k < 2 * 40; k++) {
        await page.keyboard.press('ArrowRight');
        await check(`micro-step ${k + 1}`);
      }
    });
  }
}

test('the other problems have no marks, no trails and no selection buttons', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('heat-marks')).toHaveCount(0);
  await expect(page.locator('.idbtn')).toHaveCount(0);
});

test('a restart keeps the landscape view, with its trails, zoom and rotated surface; the selection starts over; another problem without a landscape starts the views over', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await showLandscape(page);
  await page.getByTestId('trail-3').click();
  await page.getByTestId('zoom-toggle').click();
  await page.getByTestId('rotate-left').click();
  const surface = await page.getByTestId('surface').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await page.getByTestId(`select-${(await markers(page, 'heat-marks'))[1]!.id}`).click();
  // a new seed restarts the run
  await page.getByRole('button', { name: /New/ }).click();
  await expect(page.getByTestId('heat-marks')).toBeVisible();
  await expect(page.getByTestId('show-landscape')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('trail-3')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('zoom-toggle')).toHaveAttribute('aria-pressed', 'true');
  expect((await markers(page, 'heat-marks')).filter((m) => m.selected)).toEqual([]);
  // a restart through the drawer (another function) keeps it too, and the surface keeps its turn
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#function').selectOption('rastrigin');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('heat-marks')).toBeVisible();
  await expect(page.getByTestId('trail-3')).toHaveAttribute('aria-pressed', 'true');
  // a problem without a landscape: its views are gone, and a landscape started again opens on the stage view
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('show-landscape')).toHaveCount(0);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Landscape/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('show-stage')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('show-landscape').click();
  await expect(page.getByTestId('trail-0')).toHaveAttribute('aria-pressed', 'true');
});

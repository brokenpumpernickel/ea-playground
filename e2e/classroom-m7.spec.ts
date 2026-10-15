import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeProblem, metricsOfProblem, tspProblem, type GaParams, type LandscapeOptions, type TspOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { pointAt } from '../src/ui/heatmap-draw';
import { tourInfoOf, tourStatsLines } from '../src/ui/tour-cells';

const url = pathToFileURL(resolve('dist/index.html')).href;
// the screenshots of this scenario are written only with SHOTS=1, so an ordinary run leaves the files alone
const shots = resolve('.scratch/milestone-7-bigger-views/screenshots');
const shoot = async (page: Page, name: string) => {
  if (process.env.SHOTS !== '1') return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png` });
};

const tsp = entryOf('tsp')!;
const land = entryOf('landscape')!;
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
const himmelblau: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 };

test('the seventh classroom scenario: open a TSP run, switch the numbers off, zoom with the wheel, expand the map, Run with it open, leave, expand the landscape and zoom it', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const d = defaultsOf(tsp, berlin);
  const params: GaParams = d.params;
  await page.goto(url + encodeConfig(configOf({ problem: tsp.create(berlin), init: d.init }, params, 42, 'tsp', berlin)));
  await page.getByRole('button', { name: 'Projector mode' }).click();
  const problem = tspProblem(berlin);
  const info = tourInfoOf(problem);
  const run = createRun(gaAlgorithm, { setup: { problem, init: d.init }, params, seed: 42 }, { eventCacheSize: 0 });
  const summary = async () => (await page.getByTestId('summary').innerText()).replace(/\s*\n\s*/g, '');
  const expectSame = async (g: number) => expect(await summary()).toBe(tourStatsLines(info, metricsOfProblem(run.snapshot(g).state, problem)).join(''));

  // 1. a few generations in the ordinary panels, then the route map, with its numbers switched off
  for (let g = 1; g <= 5; g++) {
    await page.keyboard.press('g');
    run.forwardCycle();
  }
  await expectSame(5);
  await page.getByTestId('show-map').click();
  await expect(page.locator('svg[data-testid="route-map"] text.cl')).toHaveCount(52);
  await page.getByTestId('toggle-numbers').click();
  await expect(page.locator('svg[data-testid="route-map"] text.cl')).toHaveCount(0);
  await expect(page.locator('svg[data-testid="route-map"] circle.city')).toHaveCount(52);
  await shoot(page, 'classroom-1-numbers-off');

  // 2. the numbers back on, and the wheel zooms into the crowded middle: the numbers at full size, the point under the pointer kept
  await page.getByTestId('toggle-numbers').click();
  const map = page.getByTestId('route-map');
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -400);
  const zoom = Number(await map.getAttribute('data-zoom'));
  expect(zoom).toBeGreaterThan(2);
  await expect(page.locator('svg[data-testid="route-map"] text.axes')).toContainText('zoomed');
  expect(await page.locator('svg[data-testid="route-map"] text.cl').first().evaluate((e) => getComputedStyle(e).fontSize)).toBe('18px');
  await shoot(page, 'classroom-2-zoomed');

  // 3. expand: the map takes the whole centre, the panels are out of sight and still there; the zoom is the same part of the picture
  await page.keyboard.press('e');
  await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  expect(Number(await map.getAttribute('data-zoom'))).toBeCloseTo(zoom, 6);
  await expect(page.locator('#pop-heading')).toBeHidden();
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 5');
  await expect(page.getByTestId('focus-card')).toContainText('Generation 5');
  await page.keyboard.press('Home').catch(() => undefined);
  await page.getByTestId('reset-view').click();
  await shoot(page, 'classroom-3-focus');

  // 4. Run with the focus view open: the map, the card and the graph follow, and they are the engine's
  await page.getByRole('slider', { name: 'Playback speed' }).fill('2');
  await page.getByRole('button', { name: /Run/ }).filter({ hasText: /^▶/ }).first().click();
  await page.waitForFunction(() => Number(document.querySelector('svg[data-plot="fitness-mini"]')?.getAttribute('data-now')) >= 12, undefined, { timeout: 60_000 });
  await page.getByRole('button', { name: /Pause/ }).click();
  const g = Number(await page.locator('svg[data-plot="fitness-mini"]').getAttribute('data-now'));
  while (run.lastCycle < g) run.forwardCycle();
  await expectSame(g);
  const best = metricsOfProblem(run.snapshot(g).state, problem).best;
  expect(await page.getByTestId('stat-best-now').innerText()).toBe(problem.lengthText(-best));
  await expect(page.locator('svg[data-plot="fitness-mini"]')).toHaveAttribute('aria-label', await page.locator('svg[data-plot="fitness"]').getAttribute('aria-label') as string);
  await shoot(page, 'classroom-4-run');

  // 5. a step in the focus view with the stage marks, then leave with Esc: the panels come back at the same generation
  await page.locator('#narr').click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
  await expect(page.locator('#pop-heading')).toBeVisible();
  await expect(page.locator('#pop-heading')).toContainText(`generation ${g}`);

  // 6. the landscape, from its link: expand, zoom the heatmap and the surface, and everything is the engine's
  const ld = defaultsOf(land, himmelblau);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: land.create(himmelblau), init: ld.init }, ld.params, 42, 'landscape', himmelblau)));
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
  const lrun = createRun(gaAlgorithm, { setup: { problem: landscapeProblem(himmelblau), init: ld.init }, params: ld.params as GaParams, seed: 42 }, { eventCacheSize: 0 });
  for (let k = 0; k < 8; k++) {
    await page.keyboard.press('g');
    lrun.forwardCycle();
  }
  await page.getByTestId('show-landscape').click();
  await page.getByTestId('trail-3').click();
  await page.keyboard.press('e');
  await expect(page.getByTestId('stage-panel')).toHaveAttribute('data-focus', 'true');
  const heat = page.getByTestId('heatmap');
  const [L, T, R, B] = ((await heat.getAttribute('data-plot')) ?? '').split(',').map(Number);
  const layout = { L: L!, T: T!, R: R!, B: B! };
  const hbox = (await heat.boundingBox())!;
  await page.mouse.move(hbox.x + hbox.width * 0.4, hbox.y + hbox.height * 0.4);
  await page.mouse.wheel(0, -300);
  const [x0, x1, y0, y1] = ((await heat.getAttribute('data-region')) ?? '').split(',').map(Number);
  expect(x1! - x0!).toBeLessThan(10);
  const sbox = (await page.getByTestId('surface').boundingBox())!;
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
  await page.mouse.wheel(0, -300);
  expect(Number(await page.getByTestId('surface').getAttribute('data-zoom'))).toBeGreaterThan(1);
  // the marks drawn are the engine's individuals, at the pixels of the zoomed region
  const state = lrun.snapshot(8).state;
  const marks = await page.getByTestId('heat-marks').evaluate((svg) => [...svg.querySelectorAll('[data-marker="individual"]')].map((e) => ({ id: Number(e.getAttribute('data-id')), x: Number(e.getAttribute('data-x')), y: Number(e.getAttribute('data-y')), px: Number(e.getAttribute('data-px')), py: Number(e.getAttribute('data-py')) })));
  expect(marks.length).toBeGreaterThan(0);
  for (const m of marks) {
    expect([m.x, m.y]).toEqual(state.population.find((i) => i.id === m.id)!.values);
    const back = pointAt(layout, { x0: x0!, x1: x1!, y0: y0!, y1: y1! }, m.px, m.py);
    expect(back.x).toBeCloseTo(m.x, 3);
    expect(back.y).toBeCloseTo(m.y, 3);
  }
  const lm = metricsOfProblem(state, landscapeProblem(himmelblau));
  expect(Number(await page.locator('svg[data-plot="fitness-mini"] [data-mini="best"]').getAttribute('data-value'))).toBeCloseTo(lm.best, 9);
  await shoot(page, 'classroom-5-landscape');
  await page.getByTestId('reset-view').click();
  expect(await heat.getAttribute('data-region')).toBe('-5,5,-5,5');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stage-panel')).not.toHaveAttribute('data-focus', 'true');
});

test('the same scenario at 1366 × 768 without scrolling: the map expanded, zoomed and stepped', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const d = defaultsOf(tsp, berlin);
  await page.goto(url + encodeConfig(configOf({ problem: tsp.create(berlin), init: d.init }, d.params, 42, 'tsp', berlin)));
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-map').click();
  await page.keyboard.press('e');
  const box = (await page.getByTestId('route-map').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await page.keyboard.press('g');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await shoot(page, 'classroom-6-1366');
});

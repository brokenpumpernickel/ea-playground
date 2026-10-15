import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { GaParams, LandscapeOptions, TspOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

// Screenshots for the review of milestone 7: written only with SHOTS=1 so that an ordinary run leaves the folder alone.
test.skip(!process.env.SHOTS, 'set SHOTS=1 to write the screenshots');

const url = pathToFileURL(resolve('dist/index.html')).href;
const dir = resolve('.scratch/milestone-7-bigger-views/screenshots');
const tsp = entryOf('tsp')!;
const land = entryOf('landscape')!;
const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
const himmelblau: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 };

const shoot = async (page: Page, name: string) => {
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
};
const openTsp = async (page: Page, options: TspOptions, generations: number, size: [number, number], projector = true, dark = false) => {
  await page.setViewportSize({ width: size[0], height: size[1] });
  const d = defaultsOf(tsp, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: tsp.create(options), init: d.init }, d.params, 42, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== (dark ? 'dark' : 'light')) await page.getByRole('button', { name: /^(Dark|Light) theme$/ }).click();
  for (let g = 0; g < generations; g++) await page.keyboard.press('g');
  await page.getByTestId('show-map').click();
  await page.getByTestId('focus-toggle').click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};
const openLand = async (page: Page, options: LandscapeOptions, generations: number, size: [number, number], projector = true) => {
  await page.setViewportSize({ width: size[0], height: size[1] });
  const d = defaultsOf(land, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: land.create(options), init: { kind: 'random', size: 14 } }, d.params as GaParams, 42, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== 'light') await page.getByRole('button', { name: /^(Dark|Light) theme$/ }).click();
  for (let g = 0; g < generations; g++) await page.keyboard.press('g');
  await page.getByTestId('show-landscape').click();
  await page.getByTestId('trail-3').click();
  await page.getByTestId('focus-toggle').click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};

test('m7-01 the route map of ulysses16 in the focus view', async ({ page }) => {
  await openTsp(page, ulysses, 60, [1920, 1080]);
  await shoot(page, 'm7-01-map-ulysses16');
});

test('m7-02 berlin52 in the focus view: the crowded middle, the numbers colliding', async ({ page }) => {
  await openTsp(page, berlin, 60, [1920, 1080]);
  await shoot(page, 'm7-02-map-berlin52');
});

test('m7-03 berlin52 zoomed in on the crowded middle, the numbers readable', async ({ page }) => {
  await openTsp(page, berlin, 60, [1920, 1080]);
  const box = (await page.getByTestId('route-map').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.55);
  await page.mouse.wheel(0, -700);
  await shoot(page, 'm7-03-map-berlin52-zoomed');
});

test('m7-04 the map during crossover with the origin of each edge, in the focus view', async ({ page }) => {
  await openTsp(page, ulysses, 5, [1920, 1080]);
  await page.locator('#narr').click();
  for (let k = 0; k < 80 && (await page.getByTestId('route-mark').count()) === 0; k++) await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('route-mark')).toBeVisible();
  await shoot(page, 'm7-04-map-crossover');
});

test('m7-05 the map without the graph and without the numbers', async ({ page }) => {
  await openTsp(page, berlin, 60, [1920, 1080]);
  await page.getByTestId('toggle-graph').click();
  await page.getByTestId('toggle-numbers').click();
  await shoot(page, 'm7-05-map-clean');
});

test('m7-06 the landscape in the focus view with trails', async ({ page }) => {
  await openLand(page, himmelblau, 12, [1920, 1080]);
  await shoot(page, 'm7-06-landscape');
});

test('m7-07 the landscape zoomed: the heatmap inside the population, the surface closer', async ({ page }) => {
  await openLand(page, himmelblau, 12, [1920, 1080]);
  await page.getByTestId('zoom-toggle').click();
  const heat = (await page.getByTestId('heatmap').boundingBox())!;
  await page.mouse.move(heat.x + heat.width * 0.4, heat.y + heat.height * 0.4);
  await page.mouse.wheel(0, -300);
  const surf = (await page.getByTestId('surface').boundingBox())!;
  await page.mouse.move(surf.x + surf.width / 2, surf.y + surf.height / 2);
  await page.mouse.wheel(0, -300);
  await shoot(page, 'm7-07-landscape-zoomed');
});

test('m7-08 the map in the dark theme', async ({ page }) => {
  await openTsp(page, ulysses, 40, [1920, 1080], true, true);
  await shoot(page, 'm7-08-map-dark');
});

test('m7-09 the map on a 1366 × 768 laptop in projector mode', async ({ page }) => {
  await openTsp(page, berlin, 60, [1366, 768]);
  await shoot(page, 'm7-09-map-1366');
});

test('m7-10 the landscape on a 1366 × 768 laptop in projector mode', async ({ page }) => {
  await openLand(page, himmelblau, 12, [1366, 768]);
  await shoot(page, 'm7-10-landscape-1366');
});

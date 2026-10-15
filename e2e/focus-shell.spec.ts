import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { GaParams, LandscapeOptions, TspOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };

const openTsp = async (page: Page, options: TspOptions, projector = false) => {
  const entry = entryOf('tsp')!;
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, d.params, 42, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-map').click();
  await expect(page.getByTestId('route-map-view')).toBeVisible();
};
const openLandscape = async (page: Page, projector = false) => {
  const entry = entryOf('landscape')!;
  const options: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 };
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, d.params as GaParams, 42, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-landscape').click();
  await expect(page.getByTestId('landscape-view')).toBeVisible();
};

const toggle = (page: Page) => page.getByTestId('focus-toggle');
const stagePanel = (page: Page) => page.getByTestId('stage-panel');
const canvas = (page: Page) => page.locator('main.canvas');
/** An element's box in the design's own pixels (the canvas is 1920 × 1080 and scaled to the window). */
const designBox = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const c = document.querySelector('main.canvas')!.getBoundingClientRect();
    const k = c.width / 1920;
    const r = document.querySelector(sel)!.getBoundingClientRect();
    return { left: (r.left - c.left) / k, top: (r.top - c.top) / k, width: r.width / k, height: r.height / k };
  }, selector);
const near = (got: { left: number; top: number; width: number; height: number }, want: { left: number; top: number; width: number; height: number }) => {
  for (const key of ['left', 'top', 'width', 'height'] as const) expect(Math.abs(got[key] - want[key]), `${key}: ${JSON.stringify(got)}`).toBeLessThanOrEqual(1);
};
const FOCUS = { left: 24, top: 172, width: 1872, height: 830 };
const STAGE = { left: 24, top: 172, width: 1096, height: 574 };

const hiddenWhileFocused = ['#pop-heading', '#legend', '#fitness-heading', '#diversity-heading', '#allele-heading'];

test('the Expand button is in the corner of the route map and of the landscape, named and with its key', async ({ page }) => {
  await openTsp(page, ulysses);
  await expect(toggle(page)).toBeVisible();
  await expect(toggle(page)).toContainText('Expand');
  await expect(toggle(page)).toHaveAttribute('aria-keyshortcuts', 'E');
  await expect(page.getByRole('button', { name: /^Expand/ })).toHaveCount(1);
  await openLandscape(page);
  await expect(toggle(page)).toContainText('Expand');
  await expect(toggle(page)).toHaveAttribute('aria-keyshortcuts', 'E');
});

test('the stage view of a problem has nothing to expand: no button, and E does nothing', async ({ page }) => {
  await openTsp(page, ulysses);
  await page.getByTestId('show-stage').click();
  await expect(toggle(page)).toHaveCount(0);
  await page.keyboard.press('e');
  await expect(canvas(page)).not.toHaveClass(/focused/);
  await expect(stagePanel(page)).not.toHaveAttribute('data-focus', 'true');
});

for (const [label, how] of [
  ['the button', async (page: Page) => toggle(page).click()],
  ['E', async (page: Page) => page.keyboard.press('e')],
] as const) {
  test(`entering with ${label} gives the route map the whole area; leaving with the button, E and Esc gives it back`, async ({ page }) => {
    await openTsp(page, berlin);
    near(await designBox(page, '[data-testid="stage-panel"]'), STAGE);
    await how(page);
    await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
    await expect(canvas(page)).toHaveClass(/focused/);
    near(await designBox(page, '[data-testid="stage-panel"]'), FOCUS);
    await expect(toggle(page)).toContainText('Back to the panels');
    await expect(page.getByTestId('route-map')).toBeVisible();
    // every other panel is out of the way, and still in the page
    for (const sel of hiddenWhileFocused) {
      await expect(page.locator(sel), sel).toBeHidden();
      await expect(page.locator(sel), sel).toHaveCount(1);
    }
    await toggle(page).click();
    await expect(canvas(page)).not.toHaveClass(/focused/);
    near(await designBox(page, '[data-testid="stage-panel"]'), STAGE);
    for (const sel of hiddenWhileFocused) await expect(page.locator(sel), sel).toBeVisible();
    await page.keyboard.press('e');
    await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
    await page.keyboard.press('e');
    await expect(stagePanel(page)).not.toHaveAttribute('data-focus', 'true');
    await page.keyboard.press('e');
    await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
    await page.keyboard.press('Escape');
    await expect(stagePanel(page)).not.toHaveAttribute('data-focus', 'true');
    for (const sel of hiddenWhileFocused) await expect(page.locator(sel), sel).toBeVisible();
  });
}

test('while it is open the top bar, the transport, the speed control, the history strip and the narration stay', async ({ page }) => {
  await openTsp(page, ulysses);
  await toggle(page).click();
  for (const sel of ['#brand', '.stage', '#gen', '#transport', '#tier', '.history', '[data-testid="scrub"]', '[data-testid="narration"]']) await expect(page.locator(sel).first(), sel).toBeVisible();
  const map = (await page.getByTestId('route-map').boundingBox())!;
  const narr = (await page.getByTestId('narration').boundingBox())!;
  expect(narr.y).toBeGreaterThanOrEqual(map.y + map.height - 1);
  const panel = (await stagePanel(page).boundingBox())!;
  expect(narr.y + narr.height).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
  // the map takes most of the area: much larger than the 740 × 292 of the ordinary panel
  expect(map.width).toBeGreaterThan(1300);
  expect(map.height).toBeGreaterThan(450);
});

test('the hidden panels are still there: their tables, plots and sentences are in the page and keep up with the run', async ({ page }) => {
  await openTsp(page, ulysses);
  const rowsBefore = await page.locator('section[aria-labelledby="pop-heading"] tbody tr [data-bits]').count();
  expect(rowsBefore).toBeGreaterThan(5);
  await toggle(page).click();
  await expect(page.locator('section[aria-labelledby="pop-heading"] tbody tr [data-bits]')).toHaveCount(rowsBefore);
  await expect(page.locator('svg[data-plot="fitness"]')).toHaveCount(1);
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await page.keyboard.press('g');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  await expect(page.getByTestId('route-sentence')).toContainText('Generation 1');
  await toggle(page).click();
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
});

test('the focus view is kept across steps and restarts, and the map keeps its toggles and zoom in and out of it', async ({ page }) => {
  await openTsp(page, berlin);
  await page.getByTestId('toggle-optimal').click();
  await page.getByTestId('toggle-numbers').click();
  const box = (await page.getByTestId('route-map').boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 120);
  await page.mouse.wheel(0, -400);
  const zoom = Number(await page.getByTestId('route-map').getAttribute('data-zoom'));
  const frac = async () => ({ x: Number(await page.getByTestId('route-map').getAttribute('data-cx')) / Number(await page.getByTestId('route-map').getAttribute('width')), y: Number(await page.getByTestId('route-map').getAttribute('data-cy')) / Number(await page.getByTestId('route-map').getAttribute('height')) });
  const was = await frac();
  expect(zoom).toBeGreaterThan(2);
  await toggle(page).click();
  // the same part of the map, at the same zoom, in the bigger picture
  expect(Number(await page.getByTestId('route-map').getAttribute('data-zoom'))).toBeCloseTo(zoom, 6);
  const now = await frac();
  expect(now.x).toBeCloseTo(was.x, 2);
  expect(now.y).toBeCloseTo(was.y, 2);
  await expect(page.getByTestId('toggle-optimal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('toggle-numbers')).toHaveAttribute('aria-pressed', 'false');
  for (let k = 0; k < 6; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('g');
  await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
  await expect(page.getByTestId('toggle-optimal')).toHaveAttribute('aria-pressed', 'true');
  expect(Number(await page.getByTestId('route-map').getAttribute('data-zoom'))).toBeCloseTo(zoom, 6);
  await toggle(page).click();
  expect(Number(await page.getByTestId('route-map').getAttribute('data-zoom'))).toBeCloseTo(zoom, 6);
  const back = await frac();
  expect(back.x).toBeCloseTo(was.x, 2);
});

test('another problem starts the focus view over: back in the panels', async ({ page }) => {
  await openTsp(page, ulysses);
  await toggle(page).click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Landscape/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  await expect(canvas(page)).not.toHaveClass(/focused/);
  near(await designBox(page, '[data-testid="stage-panel"]'), STAGE);
  await page.getByTestId('show-landscape').click();
  await toggle(page).click();
  await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /TSP/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(canvas(page)).not.toHaveClass(/focused/);
  await page.getByTestId('show-map').click();
  await expect(toggle(page)).toContainText('Expand');
});

test('Run, Step, Stage, Generation, Run to stop and the history strip all work inside it', async ({ page }) => {
  await openTsp(page, ulysses);
  await toggle(page).click();
  const heading = () => page.locator('#pop-heading').innerText();
  const narration = () => page.getByTestId('narration').innerText();
  const n0 = await narration();
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  expect(await narration()).not.toBe(n0);
  await page.getByRole('button', { name: /^Stage/ }).click();
  await page.getByRole('button', { name: /^Generation/ }).click();
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  // Run, at the fastest speed: the generation counter moves on its own and the map follows
  await page.getByRole('slider', { name: 'Playback speed' }).fill('2');
  const sentences = new Set<string>();
  await page.getByRole('button', { name: /Run/ }).filter({ hasText: /^▶/ }).first().click();
  for (let k = 0; k < 200; k++) {
    sentences.add(await page.getByTestId('route-sentence').innerText());
    if (sentences.size >= 4) break;
    await page.waitForTimeout(40);
  }
  if (await page.getByRole('button', { name: /Pause/ }).count()) await page.getByRole('button', { name: /Pause/ }).click();
  expect(sentences.size).toBeGreaterThanOrEqual(3);
  const stopped = await heading();
  expect(Number(/generation (\d+)/.exec(stopped)![1])).toBeGreaterThan(1);
  // the history strip: back to the start and forward again
  await page.getByTestId('scrub').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await expect(page.getByTestId('route-sentence')).toContainText('Generation 0');
  await page.keyboard.press('End');
  await expect(page.locator('#pop-heading')).toHaveText(stopped);
  // Run to stop: through to the stop criterion, with the focus view still open
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#gen')).toContainText(/limit|complete|stop/i);
  await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
  expect(Number(/generation (\d+)/.exec(await heading())![1])).toBeGreaterThanOrEqual(Number(/generation (\d+)/.exec(stopped)![1]));
});

test('E is not taken while typing in a field, and Esc closes the drawer before it leaves the focus view', async ({ page }) => {
  await openTsp(page, ulysses);
  await toggle(page).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#instance').focus();
  await page.keyboard.press('e');
  await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#drawer')).toHaveCount(0);
  await expect(stagePanel(page)).toHaveAttribute('data-focus', 'true');
  await page.keyboard.press('Escape');
  await expect(stagePanel(page)).not.toHaveAttribute('data-focus', 'true');
});

test('the landscape: Expand gives the heatmap and the surface the whole area, and gives it back', async ({ page }) => {
  await openLandscape(page);
  await toggle(page).click();
  near(await designBox(page, '[data-testid="stage-panel"]'), FOCUS);
  for (const sel of hiddenWhileFocused) await expect(page.locator(sel), sel).toBeHidden();
  await expect(page.getByTestId('heatmap')).toBeVisible();
  await expect(page.getByTestId('surface')).toBeVisible();
  await page.keyboard.press('g');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  await page.keyboard.press('Escape');
  near(await designBox(page, '[data-testid="stage-panel"]'), STAGE);
});

for (const projector of [false, true]) {
  for (const [width, height] of [[1920, 1080], [1366, 768]] as const) {
    for (const [label, options] of [['16 cities', ulysses], ['52 cities', berlin]] as const) {
      test(`geometry of the focus view, ${label} at ${width}×${height}${projector ? ' in projector mode' : ''}: everything inside the panel, nothing overlapping, the narration inside its box at every micro-step of two generations`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height });
        await openTsp(page, options, projector);
        await toggle(page).click();
        await page.getByRole('button', { name: /Optimal tour/ }).click();
        await page.locator('#narr').click();
        const check = async (at: string) => {
          const problems = await page.evaluate(() => {
            const out: string[] = [];
            const panel = document.querySelector('[data-testid="stage-panel"]')!.getBoundingClientRect();
            const inside = (r: DOMRect, what: string) => {
              if (r.width === 0 && r.height === 0) return;
              if (r.left < panel.left - 0.5 || r.right > panel.right + 0.5 || r.top < panel.top - 0.5 || r.bottom > panel.bottom + 0.5) out.push(`${what} leaves the panel`);
            };
            const view = document.querySelector('[data-testid="route-map-view"]')!;
            for (const child of view.children) if (!child.classList.contains('sr-only')) inside(child.getBoundingClientRect(), `.${child.className}`);
            for (const b of view.querySelectorAll('button, select')) inside(b.getBoundingClientRect(), `control "${b.textContent?.trim()}"`);
            const svg = document.querySelector('svg[data-testid="route-map"]')!;
            const box = svg.getBoundingClientRect();
            for (const c of svg.querySelectorAll('circle.city')) {
              const r = c.getBoundingClientRect();
              if (r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom) out.push(`city ${c.getAttribute('data-city')} leaves the picture`);
            }
            for (const t of svg.querySelectorAll('text')) {
              const r = t.getBoundingClientRect();
              if (r.width === 0) continue;
              if (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) out.push(`text "${t.textContent}" leaves the picture`);
            }
            const narr = document.querySelector('#narr')!;
            if (narr.scrollHeight - narr.clientHeight > 1) out.push('the narration overflows its box');
            inside(narr.getBoundingClientRect(), 'the narration');
            const nr = narr.getBoundingClientRect();
            for (const el of view.querySelectorAll('.lsent, .lkey, .rmstats')) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.bottom > nr.top + 1 && r.top < nr.bottom - 1 && r.left < nr.right && r.right > nr.left) out.push(`${el.className} runs into the narration`);
            }
            if (document.documentElement.scrollWidth > window.innerWidth) out.push('the page scrolls sideways');
            return out;
          });
          expect(problems, at).toEqual([]);
        };
        await check('at the start');
        for (let k = 0; k < 2 * 70; k++) {
          await page.keyboard.press('ArrowRight');
          if (k % 3 === 0) await check(`micro-step ${k}`);
        }
      });
    }
  }
}

import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { TspOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;

const open = async (page: Page, options: TspOptions, projector = false) => {
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, d.params, 42, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('show-map').click();
  await expect(page.getByTestId('route-map-view')).toBeVisible();
};
const numbers = (page: Page) => page.locator('svg[data-testid="route-map"] text.cl');
const dots = (page: Page) => page.locator('svg[data-testid="route-map"] circle.city');
const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };

for (const [label, options, count, size] of [
  ['16 cities', ulysses, 16, '13'],
  ['52 cities', berlin, 52, '9'],
] as const) {
  test(`the city numbers are on by default for ${label}, one beside every dot, at the size of milestone 6`, async ({ page }) => {
    await open(page, options);
    await expect(page.getByTestId('toggle-numbers')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('toggle-numbers')).toHaveText('✓ City numbers');
    await expect(numbers(page)).toHaveCount(count);
    await expect(numbers(page).first()).toHaveAttribute('font-size', size);
    expect(await numbers(page).evaluateAll((els) => els.map((e) => e.textContent))).toEqual(Array.from({ length: count }, (_, k) => String(k + 1)));
  });

  test(`switched off, no number is drawn for ${label} and every dot stays; the map's name and sentence do not change`, async ({ page }) => {
    await open(page, options);
    const map = page.getByTestId('route-map');
    const sentence = await page.getByTestId('route-sentence').innerText();
    const name = await map.getAttribute('aria-label');
    await page.getByTestId('toggle-numbers').click();
    await expect(page.getByTestId('toggle-numbers')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('toggle-numbers')).toHaveText('City numbers');
    await expect(numbers(page)).toHaveCount(0);
    await expect(dots(page)).toHaveCount(count);
    expect(await dots(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-city')))).toEqual(Array.from({ length: count }, (_, k) => String(k + 1)));
    await expect(page.getByTestId('route-sentence')).toHaveText(sentence);
    await expect(map).toHaveAttribute('aria-label', name!);
    await page.getByTestId('toggle-numbers').click();
    await expect(numbers(page)).toHaveCount(count);
  });
}

test('switched off, the numbers stay off through steps, a stage, the other tab and a restart', async ({ page }) => {
  await open(page, ulysses);
  await page.getByTestId('toggle-numbers').click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('g');
  await expect(page.getByTestId('toggle-numbers')).toHaveAttribute('aria-pressed', 'false');
  await expect(numbers(page)).toHaveCount(0);
  // through a crossover and a mutation step, whose marks add rings and ✕ but no number
  for (let k = 0; k < 40; k++) {
    await page.keyboard.press('ArrowRight');
    expect(await numbers(page).count()).toBe(0);
  }
  await page.getByTestId('show-stage').click();
  await page.getByTestId('show-map').click();
  await expect(page.getByTestId('toggle-numbers')).toHaveAttribute('aria-pressed', 'false');
  await expect(numbers(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await expect(page.getByTestId('route-map-view')).toBeVisible();
  await expect(page.getByTestId('toggle-numbers')).toHaveAttribute('aria-pressed', 'false');
  await expect(numbers(page)).toHaveCount(0);
});

test('a problem without a tour starts the numbers over (on)', async ({ page }) => {
  await open(page, ulysses);
  await page.getByTestId('toggle-numbers').click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Landscape/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /TSP/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByTestId('show-map').click();
  await expect(page.getByTestId('toggle-numbers')).toHaveAttribute('aria-pressed', 'true');
  await expect(numbers(page).first()).toBeVisible();
});

test('the toggle works from the keyboard and has a name', async ({ page }) => {
  await open(page, ulysses);
  await page.getByTestId('toggle-numbers').focus();
  await page.keyboard.press('Space');
  await expect(numbers(page)).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(numbers(page)).toHaveCount(16);
  await expect(page.getByRole('button', { name: 'City numbers' })).toHaveCount(1);
});

test('the toggle fits the toolbar without scrolling or overlap at both sizes, in projector mode and not', async ({ page }) => {
  for (const projector of [false, true]) {
    for (const [width, height] of [[1920, 1080], [1366, 768]] as const) {
      await page.setViewportSize({ width, height });
      await open(page, berlin, projector);
      const boxes = await page.locator('.rmview .lbar button, .rmview .lbar select, .rmview .lbar label').evaluateAll((els) => els.map((e) => ({ r: e.getBoundingClientRect(), name: e.textContent })));
      const panel = (await page.locator('.rmview').boundingBox())!;
      for (const b of boxes) {
        expect(b.r.left, `${b.name} at ${width}`).toBeGreaterThanOrEqual(panel.x - 0.5);
        expect(b.r.right, `${b.name} at ${width}`).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!.r;
          const b = boxes[j]!.r;
          const overlap = a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
          expect(overlap, `${boxes[i]!.name} over ${boxes[j]!.name}`).toBe(false);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});

import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { canonicalRoute, formatTour, gaAlgorithm, tspPlaces, type GaParams, type TspOptions, type TspProblem } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { thumbnail, wholeTourUpTo } from '../src/ui/tour-cells';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;

const errorsOf = (page: Page) => {
  const found: string[] = [];
  page.on('pageerror', (e) => found.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && found.push(m.text()));
  return found;
};

const roulette: GaParams['selection'] = { method: 'roulette', chain: [{ step: 'shift' }, { step: 'rank' }] };
const configFor = (options: TspOptions, size: number, seed: number, selection?: GaParams['selection']) => {
  const d = defaultsOf(entry, options);
  const params = selection ? { ...d.params, selection } : d.params;
  return { d: { ...d, params }, init: { kind: 'random' as const, size }, config: configOf({ problem: entry.create(options), init: { kind: 'random', size } }, params, seed, 'tsp', options) };
};
const open = async (page: Page, options: TspOptions, size = 12, seed = 42, selection?: GaParams['selection'], projector = false) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configFor(options, size, seed, selection).config));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
/** The engine's population after g generations. */
const engineAt = (options: TspOptions, size: number, g: number, seed = 42) => {
  const { d, init } = configFor(options, size, seed);
  const problem = entry.create(options) as TspProblem;
  const run = createRun(gaAlgorithm, { setup: { problem, init }, params: d.params, seed });
  for (let k = 0; k < g; k++) run.forwardCycle();
  return { problem, population: run.snapshot(g).state.population };
};

const INSTANCES: [string, TspOptions][] = [
  ['5 cities', { instance: 'circle', n: 5, seed: 1 }],
  ['14 cities', { instance: 'burma14', n: 10, seed: 1 }],
  ['16 cities', { instance: 'ulysses16', n: 10, seed: 1 }],
  ['22 cities', { instance: 'ulysses22', n: 10, seed: 1 }],
  ['48 cities', { instance: 'att48', n: 10, seed: 1 }],
  ['52 cities', { instance: 'berlin52', n: 10, seed: 1 }],
];

test.describe('the cells, the thumbnails and the detail are the engine’s', () => {
  for (const [label, options] of INSTANCES) {
    test(`${label}: every row of the table is the engine’s tour, length and gap, at generations 0 to 3`, async ({ page }) => {
      const errors = errorsOf(page);
      await open(page, options);
      for (let g = 0; g <= 3; g++) {
        if (g > 0) await page.keyboard.press('g');
        await expect(page.locator('#pop-heading')).toHaveText(`Population · generation ${g}`);
        const { problem, population } = engineAt(options, 12, g);
        const n = problem.chromosomeLength;
        const rows = page.locator('table.tsp tbody tr');
        await expect(rows).toHaveCount(12);
        for (let k = 0; k < 12; k++) {
          const row = rows.nth(k);
          const individual = population[k]!;
          const text = formatTour(individual.chromosome);
          await expect(row).toHaveAttribute('data-id', String(individual.id));
          await expect(row.locator('.bits')).toHaveAttribute('data-bits', text);
          const tour = individual.chromosome;
          const length = problem.lengthOf(tour);
          await expect(row.locator('td[data-col="length"]')).toHaveText(problem.lengthText(length));
          await expect(row.locator('td[data-col="gap"]')).toHaveText(problem.gapText(length));
          const cells = row.locator('.bit.tour');
          if (n <= wholeTourUpTo) {
            await expect(cells).toHaveText(tour.map((c) => String(c + 1)));
            await expect(row.locator('.thumb')).toHaveCount(0);
          } else {
            await expect(cells).toHaveCount(0);
            await expect(row.locator('[data-part="head"]')).toHaveText(tour.slice(0, 7).map((c) => c + 1).join(' '));
            await expect(row.locator('[data-part="hidden"]')).toHaveText(`… ${n - 10} more …`);
            await expect(row.locator('[data-part="tail"]')).toHaveText(tour.slice(-3).map((c) => c + 1).join(' '));
            const path = await row.locator('.thumb').getAttribute('data-path');
            expect(path).toBe(thumbnail(tspPlaces(problem.instance), tour).path);
            expect(path!.split(/[ML]/).filter((p) => p.trim() !== '')).toHaveLength(n);
          }
        }
      }
      expect(errors).toEqual([]);
    });
  }

  test('the accessible name of a tour says the whole route, back to its first city, its length and its gap; a hidden table lists every tour in full', async ({ page }) => {
    const options = INSTANCES[5]![1];
    await open(page, options);
    const { problem, population } = engineAt(options, 12, 0);
    const first = population[0]!.chromosome;
    const length = problem.lengthOf(first);
    const label = await page.locator('table.tsp tbody tr').first().locator('.bits').getAttribute('aria-label');
    expect(label).toBe(`Tour of 52 cities, in the order visited: ${first.map((c) => c + 1).join(', ')}, then back to ${first[0]! + 1}. Length ${problem.lengthText(length)}, ${problem.gapText(length)} over the optimum 7,542.`);
    const hidden = page.getByTestId('tours-table');
    await expect(hidden.locator('tbody tr')).toHaveCount(12);
    await expect(hidden.locator('tbody tr').first().locator('td').first()).toHaveText(first.map((c) => c + 1).join(', '));
    await expect(hidden.locator('tbody tr').first().locator('td').nth(1)).toHaveText(problem.lengthText(length));
    expect(await hidden.evaluate((el) => getComputedStyle(el).position)).toBe('absolute');
  });
});

test.describe('selecting an individual', () => {
  test('a tour of more than 16 cities has its canonical route written out under the table, with a hint until one is selected', async ({ page }) => {
    const options = INSTANCES[5]![1];
    await open(page, options);
    await page.keyboard.press('g');
    const detail = page.getByTestId('route-detail');
    await expect(detail).toContainText('Click an individual’s number');
    const { population } = engineAt(options, 12, 1);
    const pick = population[2]!;
    await page.getByTestId(`select-${pick.id}`).click();
    const route = canonicalRoute(pick.chromosome).map((c) => c + 1);
    await expect(detail).toHaveAttribute('data-route', route.join(' '));
    await expect(detail).toContainText(`Individual ${pick.id} · canonical route ${route.join(' → ')} → 1`);
    await expect(detail).toContainText(`the chromosome starts at city ${pick.chromosome[0]! + 1}`);
    await expect(page.locator(`tr[data-id="${pick.id}"]`)).toHaveClass(/sel/);
    await expect(page.getByTestId(`select-${pick.id}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`tr[data-id="${pick.id}"]`)).toContainText('▸');
    await expect(page.locator('tr.sel')).toHaveCount(1);
    await page.getByTestId(`select-${pick.id}`).click();
    await expect(page.locator('tr.sel')).toHaveCount(0);
    await expect(detail).toContainText('Click an individual’s number');
  });

  test('a tour of up to 16 cities has the route box only once one is selected, and the keyboard selects too', async ({ page }) => {
    const options = INSTANCES[2]![1];
    await open(page, options);
    const detail = page.getByTestId('route-detail');
    await expect(detail).toHaveCount(0);
    const button = page.locator('[data-testid^="select-"]').nth(1);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(detail).toHaveCount(1);
    await expect(detail).toContainText('canonical route 1 → ');
    await expect(page.locator('tr.sel')).toHaveCount(1);
    await page.keyboard.press('Space');
    await expect(detail).toHaveCount(0);
  });

  test('a rotation and a reversal of a tour show as the same route', async ({ page }) => {
    const options: TspOptions = { instance: 'circle', n: 6, seed: 1 };
    const d = defaultsOf(entry, options);
    const config = configOf({ problem: entry.create(options), init: { kind: 'explicit', chromosomes: ['1 2 3 4 5 6', '4 3 2 1 6 5', '6 5 4 3 2 1'] } }, d.params, 42, 'tsp', options);
    await page.goto('about:blank');
    await page.goto(url + encodeConfig(config));
    const routes: string[] = [];
    for (const k of [0, 1, 2]) {
      await page.locator('[data-testid^="select-"]').nth(k).click();
      routes.push((await page.getByTestId('route-detail').getAttribute('data-route'))!);
    }
    expect(routes).toEqual(['1 2 3 4 5 6', '1 2 3 4 5 6', '1 2 3 4 5 6']);
    await expect(page.getByTestId('distinct')).toHaveText('1 of 3 distinct routes');
  });
});

for (const projector of [false, true]) {
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  test.describe(`at ${width}×${height}${projector ? ' in projector mode' : ''}`, () => {
    for (const [label, options] of INSTANCES) {
      for (const size of [12, 60]) {
        test(`${label}, ${size} individuals: nothing in the table, its route box or its legend overflows; every cell has one size`, async ({ page }) => {
          await page.setViewportSize({ width, height });
          await open(page, options, size, 42, undefined, projector);
          await page.keyboard.press('g');
          const pick = page.locator('[data-testid^="select-"]').nth(1);
          const measure = () =>
            page.evaluate(() => {
              const panel = document.querySelector('section.panel[aria-labelledby="pop-heading"]')!.getBoundingClientRect();
              const wrap = document.querySelector('.tablewrap')!;
              const box = document.querySelector('[data-testid="route-detail"]');
              const legend = document.querySelector('#legend')!.getBoundingClientRect();
              const rect = (e: Element) => e.getBoundingClientRect();
              const cells = [...document.querySelectorAll('table.tsp .bit.tour')].map((c) => [Math.round(rect(c).width * 10) / 10, Math.round(rect(c).height * 10) / 10]);
              const thumbs = [...document.querySelectorAll('table.tsp .thumb')].map((c) => [Math.round(rect(c).width), Math.round(rect(c).height)]);
              const chr = [...document.querySelectorAll('table.tsp tbody tr td:nth-child(2) .bits')].map((c) => rect(c).right - rect(c.closest('td')!).right);
              return {
                wrapOverflowX: wrap.scrollWidth - wrap.clientWidth,
                panelInsideViewport: panel.left >= 0 && panel.right <= window.innerWidth && panel.bottom <= window.innerHeight,
                boxOverflowY: box ? box.scrollHeight - box.clientHeight : 0,
                boxInsidePanel: box ? rect(box).left >= panel.left && rect(box).right <= panel.right && rect(box).bottom <= panel.bottom + 0.5 : true,
                legendInsideViewport: legend.right <= window.innerWidth && legend.left >= 0,
                legendHeight: legend.height,
                cellSizes: [...new Set(cells.map((c) => c.join('×')))],
                thumbSizes: [...new Set(thumbs.map((c) => c.join('×')))],
                chromosomeFits: chr.every((d) => d <= 0.5),
                headerRight: document.querySelector('[data-testid="table-summary"]')!.getBoundingClientRect().right <= panel.right,
              };
            });
          for (const selected of [false, true]) {
            if (selected) await pick.click();
            const m = await measure();
            const where = `${label}, ${size}, selected=${selected}`;
            expect(m.wrapOverflowX, `${where}: horizontal overflow of the table`).toBeLessThanOrEqual(1);
            expect(m.panelInsideViewport, `${where}: panel inside the window`).toBe(true);
            expect(m.boxOverflowY, `${where}: route text overflows its box`).toBeLessThanOrEqual(1);
            expect(m.boxInsidePanel, `${where}: route box inside the panel`).toBe(true);
            expect(m.legendInsideViewport, `${where}: legend inside the window`).toBe(true);
            expect(m.chromosomeFits, `${where}: a tour leaves its cell`).toBe(true);
            expect(m.headerRight, `${where}: the heading's figures leave the panel`).toBe(true);
            expect(m.cellSizes.length, `${where}: cell sizes ${m.cellSizes}`).toBeLessThanOrEqual(1);
            expect(m.thumbSizes.length, `${where}: thumbnail sizes ${m.thumbSizes}`).toBeLessThanOrEqual(1);
          }
        });
      }
    }

    for (const [label, options] of [INSTANCES[2]!, INSTANCES[5]!]) {
      for (const [method, selection] of [['tournament', undefined], ['roulette', roulette]] as const) {
        test(`${label}, ${method}: the columns of the table keep their widths and the tours their cells at every micro-step of two generations`, async ({ page }) => {
          await page.setViewportSize({ width, height });
          await open(page, options, 12, 42, selection, projector);
          const widths: string[] = [];
          let sawWeights = false;
          let sawLength = false;
          for (let k = 0; k < 2 * 40; k++) {
            await page.keyboard.press('ArrowRight');
            const g = await page.evaluate(() => {
              const wrap = document.querySelector('.tablewrap')!;
              const panel = document.querySelector('section.panel[aria-labelledby="pop-heading"]')!.getBoundingClientRect();
              const heads = [...document.querySelectorAll('table.tsp thead th')];
              const row = document.querySelector('table.tsp tbody tr td:nth-child(2) .bits')!.getBoundingClientRect();
              return {
                widths: heads.map((h) => Math.round(h.getBoundingClientRect().width * 10) / 10).join(','),
                columns: heads.length,
                headerHeight: Math.round(heads[0]!.getBoundingClientRect().height),
                overflow: wrap.scrollWidth - wrap.clientWidth,
                inside: heads.every((h) => h.getBoundingClientRect().right <= panel.right + 1),
                weights: !!document.querySelector('table.tsp td[data-col="weight"]'),
                length: !!document.querySelector('table.tsp td[data-col="length"]'),
                cellLeft: Math.round(row.left),
                cellRight: Math.round(row.right),
              };
            });
            expect(g.overflow, `micro-step ${k + 1}: horizontal overflow`).toBeLessThanOrEqual(1);
            expect(g.inside, `micro-step ${k + 1}: a column leaves the panel`).toBe(true);
            expect(g.columns).toBe(5);
            if (g.weights) sawWeights = true;
            if (g.length) sawLength = true;
            widths.push(`${g.widths} | header ${g.headerHeight} | cell starts at ${g.cellLeft}`);
          }
          expect(new Set(widths).size, `column widths, header height or the start of the cells moved: ${[...new Set(widths)].join(' || ')}`).toBe(1);
          expect(sawLength).toBe(true);
          expect(sawWeights, 'roulette weights were on show at some micro-step, and only with roulette').toBe(method === 'roulette');
        });
      }
    }
  });
}
}

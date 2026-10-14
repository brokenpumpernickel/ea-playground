import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { edgeKey, gaAlgorithm, metricsOfProblem, tourEdgeSet, tspInstance, tspPlaces, type CrossoverEvent, type GaParams, type MutationEvent, type TspOptions, type TspProblem } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;
type Op = 'ox' | 'pmx' | 'cx';

const SIZES: [string, TspOptions][] = [
  ['5 cities', { instance: 'circle', n: 5, seed: 1 }],
  ['16 cities (GEO)', { instance: 'ulysses16', n: 10, seed: 1 }],
  ['52 cities', { instance: 'berlin52', n: 10, seed: 1 }],
];

const errorsOf = (page: Page) => {
  const found: string[] = [];
  page.on('pageerror', (e) => found.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && found.push(m.text()));
  return found;
};
const paramsFor = (options: TspOptions, change: (p: GaParams) => GaParams) => {
  const d = defaultsOf(entry, options);
  return { d, params: change(d.params) };
};
const open = async (page: Page, options: TspOptions, change: (p: GaParams) => GaParams = (p) => p, seed = 42) => {
  const { d, params } = paramsFor(options, change);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, params, seed, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
};
const engine = (options: TspOptions, change: (p: GaParams) => GaParams, generations: number, seed = 42) => {
  const { d, params } = paramsFor(options, change);
  const problem = entry.create(options) as TspProblem;
  const run = createRun(gaAlgorithm, { setup: { problem, init: d.init }, params, seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { problem, run };
};
const op = (o: Op, pc = 0.9) => (p: GaParams): GaParams => ({ ...p, crossover: { ...p.crossover, operator: o, probability: pc } });
const mut = (pm = 0.6) => (p: GaParams): GaParams => ({ ...p, mutation: { ...p.mutation, operator: 'inversion', probability: pm } });
const both = (...fs: ((p: GaParams) => GaParams)[]) => (p: GaParams) => fs.reduce((q, f) => f(q), p);
const key1 = (a: number, b: number) => `${Math.min(a, b) + 1}-${Math.max(a, b) + 1}`;
const keysOfTour = (tour: readonly number[]) => [...tourEdgeSet(tour)].map((k) => k.split('-').map(Number)).map(([a, b]) => key1(a!, b!)).sort();
const layerKeys = async (page: Page, layer: string) => (await page.locator(`svg[data-testid="route-map"] line[data-layer="${layer}"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-edge')!))).sort();
const openMap = async (page: Page) => {
  await page.getByTestId('show-map').click();
  await expect(page.getByTestId('route-map-view')).toBeVisible();
};

const walk = async (page: Page, visit: (at: { stage: string; micro: number; cycle: number }) => Promise<void>, presses = 2 * 80) => {
  for (let k = 0; k < presses; k++) {
    await page.keyboard.press('ArrowRight');
    const heading = await page.locator('#stage-heading').innerText();
    const narration = await page.getByTestId('narration').innerText();
    const micro = /Micro-step (\d+) of/.exec(narration);
    const parents = /Parents · generation (\d+)/.exec(await page.locator('#pop-heading').innerText());
    await visit({ stage: heading.replace(/^Route map · /, '').replace(/^Stage \d · /, '').toLowerCase(), micro: micro ? Number(micro[1]) : 0, cycle: parents ? Number(parents[1]) + 1 : 0 });
  }
};

test('the Route map is the second view of the stage panel of a TSP run, and no other problem has it', async ({ page }) => {
  const errors = errorsOf(page);
  await open(page, SIZES[1]![1]);
  await expect(page.getByTestId('show-stage')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('route-map-view')).toHaveCount(0);
  await openMap(page);
  await expect(page.locator('#stage-heading')).toHaveText('Route map');
  await expect(page.getByTestId('show-map')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('narration')).toBeVisible();
  await page.getByTestId('show-stage').click();
  await expect(page.getByTestId('route-map-view')).toHaveCount(0);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('show-map')).toHaveCount(0);
  await expect(page.getByTestId('route-map-view')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('every drawn edge belongs to the tour it should', () => {
  for (const [label, options] of SIZES) {
    test(`${label}: the population’s edges and their widths, the best, selected and optimal tours, at generations 0, 1, 4 and 8`, async ({ page }) => {
      await open(page, options);
      await openMap(page);
      for (const generation of [0, 1, 4, 8]) {
        while (Number((/generation (\d+)/.exec(await page.getByTestId('summary').innerText()) ?? [])[1] ?? -1) < generation) await page.keyboard.press('g');
        await expect(page.locator('#pop-heading')).toHaveText(`Population · generation ${generation}`);
        const { problem, run } = engine(options, (p) => p, generation);
        const population = run.snapshot(generation).state.population;
        const N = population.length;
        const counts = new Map<string, number>();
        for (const i of population) for (const k of keysOfTour(i.chromosome)) counts.set(k, (counts.get(k) ?? 0) + 1);
        const drawn = await page.locator('svg[data-testid="route-map"] line[data-layer="population"]').evaluateAll((els) => els.map((e) => ({ key: e.getAttribute('data-edge')!, count: Number(e.getAttribute('data-count')), width: parseFloat((e as HTMLElement).style.strokeWidth) })));
        expect(drawn.map((d) => d.key).sort()).toEqual([...counts.keys()].sort());
        for (const d of drawn) {
          expect(d.count, `edge ${d.key}`).toBe(counts.get(d.key));
          expect(d.width).toBeCloseTo(1 + (5 * d.count) / N, 2);
        }
        // the best tour: the highest fitness, the first of equals
        let best = population[0]!;
        for (const i of population) if (i.fitness > best.fitness) best = i;
        expect(await layerKeys(page, 'best')).toEqual(keysOfTour(best.chromosome));
        await expect(page.getByTestId('route-map')).toHaveAttribute('data-bestid', String(best.id));
        // the figures beside the map are the metrics'
        const m = metricsOfProblem(run.snapshot(generation).state, problem);
        await expect(page.getByTestId('stat-best-now')).toHaveText(problem.lengthText(0 - m.best));
        await expect(page.getByTestId('stat-best-so-far')).toHaveText(problem.lengthText(0 - m.bestSoFar));
        await expect(page.getByTestId('stat-average')).toHaveText(problem.lengthText(0 - m.average));
        await expect(page.getByTestId('stat-optimum')).toHaveText(problem.lengthText(problem.instance.optimum));
        await expect(page.getByTestId('stat-nearest')).toHaveText(problem.lengthText(problem.instance.nearestNeighbour.length));
      }
    });

    test(`${label}: the selected individual’s tour is orange and dotted and the same individual is highlighted in the table; the optimal tour is a toggle`, async ({ page }) => {
      await open(page, options);
      for (let g = 0; g < 2; g++) await page.keyboard.press('g');
      await openMap(page);
      expect(await layerKeys(page, 'selected')).toEqual([]);
      const { run } = engine(options, (p) => p, 2);
      const picked = run.snapshot(2).state.population[3]!;
      await page.getByTestId(`select-${picked.id}`).click();
      expect(await layerKeys(page, 'selected')).toEqual(keysOfTour(picked.chromosome));
      await expect(page.locator('tr.sel')).toHaveAttribute('data-id', String(picked.id));
      const row = page.getByTestId('route-tours').locator('tbody tr', { hasText: 'selected individual' });
      await expect(row.locator('td').first()).toHaveText(String(picked.id));
      await expect(row.locator('td').nth(1)).toHaveText(new RegExp(`^1, `));
      // the optimal tour, on request
      expect(await layerKeys(page, 'optimal')).toEqual([]);
      await page.getByTestId('toggle-optimal').click();
      await expect(page.getByTestId('toggle-optimal')).toHaveAttribute('aria-pressed', 'true');
      expect(await layerKeys(page, 'optimal')).toEqual(keysOfTour(tspInstance(options).optimalTour));
      await page.getByTestId('toggle-optimal').click();
      expect(await layerKeys(page, 'optimal')).toEqual([]);
      // the population's edges, on by default and off on request
      await page.getByTestId('toggle-population').click();
      await expect(page.getByTestId('toggle-population')).toHaveAttribute('aria-pressed', 'false');
      expect(await layerKeys(page, 'population')).toEqual([]);
      expect((await layerKeys(page, 'best')).length).toBeGreaterThan(0);
    });
  }

  test('cities are drawn where their coordinates say: GEO with longitude across and latitude up, EUC_2D and ATT at their coordinates, one scale in both directions', async ({ page }) => {
    for (const [instance, rule] of [['ulysses16', 'GEO'], ['berlin52', 'EUC_2D'], ['att48', 'ATT']] as const) {
      await open(page, { instance, n: 10, seed: 1 });
      await openMap(page);
      const places = tspPlaces(tspInstance({ instance, n: 10, seed: 1 }));
      const circles = await page.locator('svg[data-testid="route-map"] circle.city').evaluateAll((els) => els.map((e) => ({ city: Number(e.getAttribute('data-city')), x: Number(e.getAttribute('cx')), y: Number(e.getAttribute('cy')) })));
      expect(circles, rule).toHaveLength(places.length);
      circles.sort((a, b) => a.city - b.city);
      // x is an affine function of the first place coordinate, y of minus the second, with one scale
      const sx = (circles[1]!.x - circles[0]!.x) / (places[1]![0] - places[0]![0]);
      const sy = (circles[1]!.y - circles[0]!.y) / -(places[1]![1] - places[0]![1]);
      if (Math.abs(places[1]![0] - places[0]![0]) > 1e-9 && Math.abs(places[1]![1] - places[0]![1]) > 1e-9) expect(sx).toBeCloseTo(sy, 6);
      for (const [k, c] of circles.entries()) {
        expect(c.x, `${rule} city ${k + 1} across`).toBeCloseTo(circles[0]!.x + sx * (places[k]![0] - places[0]![0]), 3);
        expect(c.y, `${rule} city ${k + 1} up`).toBeCloseTo(circles[0]!.y - sx * (places[k]![1] - places[0]![1]), 3);
      }
      await expect(page.locator('svg[data-testid="route-map"] .axes')).toHaveText(rule === 'GEO' ? 'longitude → · latitude ↑' : 'x → · y ↑');
    }
  });
});

test.describe('the stage marks are the events at the cursor', () => {
  for (const o of ['ox', 'pmx', 'cx'] as Op[]) {
    for (const [label, options] of [SIZES[1]!, SIZES[2]!]) {
      test(`${o.toUpperCase()}, ${label}: crossover marks (the child’s edges by origin, the ringed slice) and mutation marks (removed, added, unchanged, ringed ends) at every micro-step of two generations`, async ({ page }) => {
        const change = both(op(o), mut());
        await open(page, options, change);
        await openMap(page);
        const { run } = engine(options, change, 2);
        const seen = { crossover: 0, mutated: 0, unchanged: 0, origins: new Set<string>() };
        await walk(page, async ({ stage, micro, cycle }) => {
          if (micro === 0 || cycle < 1) return;
          if (stage === 'crossover') {
            const events = run.events(cycle).filter((e): e is CrossoverEvent => e.stage === 'crossover');
            const event = events[micro - 1]!;
            const parents = run.snapshot(cycle - 1).state.population;
            const a = parents.find((i) => i.id === event.parentAId)!.chromosome;
            const b = parents.find((i) => i.id === event.parentBId)!.chromosome;
            const child = event.children[0]!.chromosome;
            const inA = tourEdgeSet(a);
            const inB = tourEdgeSet(b);
            const drawn = await page.locator('svg[data-testid="route-map"] line[data-layer="child"]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-edge')!, e.getAttribute('data-origin')!]));
            expect(drawn.map((d) => d[0]).sort()).toEqual(keysOfTour(child));
            const counts = { shared: 0, fromA: 0, fromB: 0, new: 0 };
            for (const [k, origin] of drawn) {
              const zero = k!.split('-').map((c) => Number(c) - 1) as [number, number];
              const ek = edgeKey(zero[0], zero[1]);
              const expected = inA.has(ek) && inB.has(ek) ? 'shared' : inA.has(ek) ? 'fromA' : inB.has(ek) ? 'fromB' : 'new';
              expect(origin, `edge ${k}`).toBe(expected);
              counts[expected]++;
              seen.origins.add(expected);
            }
            await expect(page.getByTestId('route-mark')).toContainText(`${counts.shared} shared by both parents, ${counts.fromA} from A only, ${counts.fromB} from B only, ${counts.new} new.`);
            const ringed = await page.locator('svg[data-testid="route-map"] circle.city.ringed').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-city'))).sort((x, y) => x - y));
            const expectedRing = event.cuts ? child.slice(event.cuts[0], event.cuts[1]).map((c) => c + 1).sort((x, y) => x - y) : [];
            expect(ringed).toEqual(expectedRing);
            expect(await layerKeys(page, 'best')).toEqual([]);
            expect(await layerKeys(page, 'selected')).toEqual([]);
            seen.crossover++;
          } else if (stage === 'mutation') {
            const event = run.events(cycle).filter((e): e is MutationEvent => e.stage === 'mutation')[micro - 1]!;
            const added = new Set((event.edges?.added ?? []).map((e) => key1(e[0], e[1])));
            const after = keysOfTour(event.after);
            expect(await layerKeys(page, 'removed')).toEqual((event.edges?.removed ?? []).map((e) => key1(e[0], e[1])).sort());
            expect(await layerKeys(page, 'added')).toEqual([...added].sort());
            expect(await layerKeys(page, 'unchanged')).toEqual(after.filter((k) => !added.has(k)));
            const ringed = await page.locator('svg[data-testid="route-map"] circle.city.ringed').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-city'))).sort((x, y) => x - y));
            const ends = new Set([...(event.edges?.removed ?? []), ...(event.edges?.added ?? [])].flat().map((c) => c + 1));
            expect(ringed).toEqual([...ends].sort((x, y) => x - y));
            await expect(page.locator('svg[data-testid="route-map"] g.re-population')).toHaveClass(/dim/);
            if (event.decision === 'mutated') seen.mutated++;
            else seen.unchanged++;
          }
        });
        expect(seen.crossover, 'crossover steps were seen').toBeGreaterThan(8);
        expect(seen.mutated, 'mutated offspring were seen').toBeGreaterThan(3);
        expect(seen.unchanged, 'unchanged offspring were seen').toBeGreaterThan(0);
        expect([...seen.origins].length, 'several origins were seen').toBeGreaterThan(1);
      });
    }
  }
});

test('the text alternative: the map is named by a sentence, which is also on the screen, and a table lists the tours in full', async ({ page }) => {
  const options = SIZES[2]![1];
  await open(page, options);
  for (let g = 0; g < 3; g++) await page.keyboard.press('g');
  await openMap(page);
  const { problem, run } = engine(options, (p) => p, 3);
  const population = run.snapshot(3).state.population;
  const best = population.reduce((p, i) => (i.fitness > p.fitness ? i : p));
  const everyone = [...tourEdgeSet(best.chromosome)].filter((k) => population.every((i) => tourEdgeSet(i.chromosome).has(k))).length;
  const sentence = `berlin52: 52 cities, EUC_2D. Generation 3: the best tour is ${problem.lengthText(problem.lengthOf(best.chromosome))} long, ${problem.gapText(problem.lengthOf(best.chromosome))} over the optimum 7,542; ${everyone} ${everyone === 1 ? 'edge is' : 'edges are'} in every individual.`;
  await expect(page.getByTestId('route-sentence')).toHaveText(sentence);
  await expect(page.getByTestId('route-map')).toHaveAttribute('aria-label', sentence);
  const rows = page.getByTestId('route-tours').locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator('th')).toHaveText('best of the generation');
  const route = (await rows.first().locator('td').nth(1).innerText()).split(', ').map(Number);
  expect(route).toHaveLength(52);
  expect(route[0]).toBe(1);
  expect([...route].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, k) => k + 1));
  await page.getByTestId('toggle-optimal').click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1).locator('th')).toHaveText('optimal tour');
  await expect(rows.nth(1).locator('td').nth(2)).toHaveText('7,542');
});

test('a restart keeps the route map with its toggles; a problem without a tour starts the views over', async ({ page }) => {
  await open(page, SIZES[1]![1]);
  await openMap(page);
  await page.getByTestId('toggle-optimal').click();
  await page.getByTestId('toggle-population').click();
  await page.keyboard.press('g');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByTestId('route-map-view')).toBeVisible();
  await expect(page.getByTestId('toggle-optimal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('toggle-population')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Landscape/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /TSP/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('route-map-view')).toHaveCount(0);
  await expect(page.getByTestId('show-stage')).toHaveAttribute('aria-pressed', 'true');
});

test('the tabs and the toggles are reachable and work from the keyboard', async ({ page }) => {
  await open(page, SIZES[1]![1]);
  await page.getByTestId('show-map').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('route-map-view')).toBeVisible();
  await page.getByTestId('toggle-optimal').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('toggle-optimal')).toHaveAttribute('aria-pressed', 'true');
  expect((await layerKeys(page, 'optimal')).length).toBe(16);
  const tree = await page.locator('#stagebody').ariaSnapshot();
  expect(tree.split('\n').filter((l) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(l))).toEqual([]);
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  test.describe(`at ${width}×${height}`, () => {
    for (const [label, options] of SIZES) {
      for (const o of ['ox', 'cx'] as Op[]) {
        test(`${o.toUpperCase()}, ${label}: with the map open, at every micro-step of two generations, every marker and label is inside the picture and nothing leaves the panel`, async ({ page }) => {
          await page.setViewportSize({ width, height });
          await open(page, options, both(op(o), mut()));
          await openMap(page);
          await page.getByTestId('toggle-optimal').click();
          await page.locator('[data-testid^="select-"]').nth(1).click();
          await walk(page, async ({ stage }) => {
            const problems = await page.evaluate(() => {
              const out: string[] = [];
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
              const panel = document.querySelector('section.panel[aria-labelledby="stage-heading"]')!.getBoundingClientRect();
              const body = document.querySelector('#stagebody')!;
              const bodyBox = body.getBoundingClientRect();
              if (body.scrollWidth - body.clientWidth > 1) out.push('the view scrolls sideways');
              const view = document.querySelector('[data-testid="route-map-view"]')!;
              for (const child of view.children) {
                const r = child.getBoundingClientRect();
                if (r.width === 0 || child.classList.contains('sr-only')) continue;
                if (r.right > bodyBox.right + 1 || r.bottom > bodyBox.bottom + 1 || r.left < bodyBox.left - 1) out.push(`${child.className || child.tagName} leaves the stage body`);
              }
              const narr = document.querySelector('#narr')!;
              if (narr.scrollHeight - narr.clientHeight > 1) out.push('the narration overflows its box');
              const nr = narr.getBoundingClientRect();
              if (nr.bottom > panel.bottom + 1) out.push('the narration leaves the panel');
              const stats = document.querySelector('.rmstats')!.getBoundingClientRect();
              if (stats.right > bodyBox.right + 1) out.push('the figures leave the stage body');
              const sentence = document.querySelector('[data-testid="route-sentence"]')!;
              if (sentence.getBoundingClientRect().bottom > nr.top + 1) out.push('the sentence runs into the narration');
              const mark = document.querySelector('[data-testid="route-mark"]');
              if (mark && mark.getBoundingClientRect().bottom > nr.top + 1) out.push('the mark sentence runs into the narration');
              return out;
            });
            expect(problems, stage).toEqual([]);
          });
        });
      }
    }
  });
}

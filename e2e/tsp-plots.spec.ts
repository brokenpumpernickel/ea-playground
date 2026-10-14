import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, metricsOfProblem, tspCatalogue, type TspOptions, type TspProblem } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;
const num = (v: number) => String(Math.round(v * 1000) / 1000);

const SIZES: [string, TspOptions][] = [
  ['5 cities', { instance: 'circle', n: 5, seed: 1 }],
  ['16 cities', { instance: 'ulysses16', n: 10, seed: 1 }],
  ['48 cities', { instance: 'att48', n: 10, seed: 1 }],
  ['52 cities', { instance: 'berlin52', n: 10, seed: 1 }],
];

const open = async (page: Page, options: TspOptions, seed = 42) => {
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, d.params, seed, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
};
const engine = (options: TspOptions, generations: number, seed = 42) => {
  const d = defaultsOf(entry, options);
  const problem = entry.create(options) as TspProblem;
  const run = createRun(gaAlgorithm, { setup: { problem, init: d.init }, params: d.params, seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { problem, run };
};
const generate = async (page: Page, generations: number) => {
  for (let g = 0; g < generations; g++) await page.keyboard.press('g');
  await expect(page.locator('#pop-heading')).toHaveText(`Population · generation ${generations}`);
};
const length = (problem: TspProblem, fitness: number) => problem.lengthText(0 - fitness);

test.describe('the plotted and printed values are the metrics', () => {
  for (const [label, options] of SIZES) {
    test(`${label}: every recorded generation’s average, best, best so far and diversity, and the distinct routes`, async ({ page }) => {
      await open(page, options);
      await generate(page, 12);
      const { problem, run } = engine(options, 12);
      for (let g = 0; g <= 12; g++) {
        const m = metricsOfProblem(run.snapshot(g).state, problem);
        const read = (series: string) => page.locator(`svg[data-plot="fitness"] [data-series="${series}"][data-gen="${g}"]`).first().getAttribute('data-value');
        expect(Number(await read('average')), `average at ${g}`).toBeCloseTo(m.average, 9);
        expect(Number(await read('best')), `best at ${g}`).toBe(m.best);
        expect(Number(await read('bestSoFar')), `best so far at ${g}`).toBe(m.bestSoFar);
        const div = page.locator(`svg[data-plot="diversity"] circle[data-series="diversity"][data-gen="${g}"]`);
        expect(Number(await div.getAttribute('data-value')), `diversity at ${g}`).toBeCloseTo(m.diversity, 12);
        expect(Number(await div.getAttribute('data-distinct')), `distinct routes at ${g}`).toBe(m.tour!.distinctRoutes);
      }
      // the hidden table has the same numbers, one row per generation
      const rows = page.getByTestId('metrics-table').locator('tbody tr');
      await expect(rows).toHaveCount(13);
      for (const g of [0, 5, 12]) {
        const m = metricsOfProblem(run.snapshot(g).state, problem);
        const cells = await rows.nth(g).locator('td').allInnerTexts();
        expect(cells).toEqual([String(g), num(m.average), num(m.worst), num(m.best), num(m.bestSoFar), num(m.diversity), String(m.tour!.distinctRoutes)]);
      }
    });

    test(`${label}: the edge-agreement bars, the counts and the lines under the plots, at generations 0, 3 and 9`, async ({ page }) => {
      await open(page, options);
      for (const generation of [0, 3, 9]) {
        while (Number((/generation (\d+)/.exec(await page.getByTestId('summary').innerText()) ?? [])[1] ?? -1) < generation) await page.keyboard.press('g');
        const { problem, run } = engine(options, generation);
        const m = metricsOfProblem(run.snapshot(generation).state, problem);
        const N = run.snapshot(generation).state.population.length;
        const route = m.tour!.bestRoute;
        const shares = m.tour!.agreement;
        const bars = page.locator('[data-testid="edge-bars"] .eg');
        await expect(bars).toHaveCount(route.length);
        for (let k = 0; k < route.length; k++) {
          const bar = bars.nth(k);
          const a = route[k]! + 1;
          const b = route[(k + 1) % route.length]! + 1;
          await expect(bar).toHaveAttribute('data-edge', `${a}-${b}`);
          expect(Number(await bar.getAttribute('data-share'))).toBeCloseTo(shares[k]!, 12);
          await expect(bar).toHaveAttribute('data-count', String(Math.round(shares[k]! * N)));
        }
        // the bar's height follows its share
        const heights = await bars.locator('.bar').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        const tallest = Math.max(...heights);
        const best = Math.max(...shares);
        for (const [k, h] of heights.entries()) expect(h / tallest, `bar ${k + 1}`).toBeCloseTo((shares[k]! * 56 + 3) / (best * 56 + 3), 1);
        const inEvery = shares.filter((s) => s >= 1).length;
        const half = shares.filter((s) => s >= 0.5).length;
        const mean = shares.reduce((s, x) => s + x, 0) / shares.length;
        await expect(page.getByTestId('agreement-line')).toHaveText(`${inEvery} of ${shares.length} edges are in every individual · ${half} in at least half · mean agreement ${mean.toFixed(2)}`);
        await expect(page.getByTestId('distinct')).toHaveText(`${m.tour!.distinctRoutes} of ${N} distinct routes`);
        // two lines, one under the other (a line break between them is not text)
        await expect(page.getByTestId('summary')).toHaveText(
          `generation ${generation} · best now ${length(problem, m.best)} · best so far ${length(problem, m.bestSoFar)} (gap ${problem.gapText(0 - m.bestSoFar)})` +
            `average ${length(problem, m.average)} · worst ${length(problem, m.worst)} · evaluations ${m.evaluations}`,
        );
        await expect(page.getByTestId('summary').locator('br')).toHaveCount(1);
        // the hidden table lists every edge with its count
        const table = page.getByTestId('edge-table').locator('tbody tr');
        await expect(table).toHaveCount(route.length);
        await expect(table.first().locator('td').first()).toHaveText(`${Math.round(shares[0]! * N)} of ${N}`);
      }
    });
  }

  test('the bars carry their share as a printed figure up to 16 edges and are unlabelled beyond, where the table and the line carry the numbers', async ({ page }) => {
    await open(page, SIZES[1]![1]);
    expect(await page.locator('[data-testid="edge-bars"] .eg b').count()).toBe(16);
    await open(page, SIZES[3]![1]);
    expect(await page.locator('[data-testid="edge-bars"] .eg b').count()).toBe(0);
  });
});

test.describe('the reference lines of the fitness plot', () => {
  test('the optimum and the nearest-neighbour tour are lines at their fitness, with labels in words, and the axis speaks in lengths', async ({ page }) => {
    await open(page, SIZES[3]![1]);
    await generate(page, 2);
    const svg = page.locator('svg[data-plot="fitness"]');
    await expect(svg.locator('line[data-optimum]')).toHaveAttribute('data-optimum', '-7542');
    await expect(svg.locator('line[data-nearest]')).toHaveAttribute('data-nearest', '-8980');
    await expect(svg.locator('text[data-label="optimum"]')).toHaveText('optimum −7,542');
    await expect(svg.locator('text[data-label="nearest"]')).toHaveText('nearest neighbour −8,980');
    const ticks = (await svg.locator('text').evaluateAll((els) => els.map((e) => e.textContent ?? ''))).filter((t) => /^[−0-9,]+$/.test(t) && t.includes('0'));
    expect(ticks).toContain('0');
    expect(ticks.some((t) => /^−\d{1,3},\d{3}$/.test(t)), `tick labels ${ticks.join(' ')}`).toBe(true);
    expect(await svg.getAttribute('aria-label')).toContain('Optimum −7,542, nearest neighbour −8,980.');
  });

  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
  ] as const) {
    const every: [string, TspOptions][] = [
      ...tspCatalogue.filter((c) => c.kind === 'tsplib').map((c): [string, TspOptions] => [c.id, { instance: c.id, n: 10, seed: 1 }]),
      ['clusters', { instance: 'clusters', n: 10, seed: 1 }],
      ['circle 5', { instance: 'circle', n: 5, seed: 1 }],
      ['circle 15', { instance: 'circle', n: 15, seed: 1 }],
      ['random 5', { instance: 'random', n: 5, seed: 3 }],
      ['random 15', { instance: 'random', n: 15, seed: 2 }],
    ];
    test(`at ${width}×${height}: for every instance, early and late in a run, the labels never meet each other, a line or the edge of the picture, and every tick label is whole`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const [label, options] of every) {
        await open(page, options);
        for (const generation of [0, 25]) {
          while (Number((/generation (\d+)/.exec(await page.getByTestId('summary').innerText()) ?? [])[1] ?? -1) < generation) await page.keyboard.press('g');
          const problems = await page.evaluate(() => {
            const out: string[] = [];
            const svg = document.querySelector('svg[data-plot="fitness"]')!;
            const box = svg.getBoundingClientRect();
            const rect = (e: Element) => e.getBoundingClientRect();
            const opt = svg.querySelector('text[data-label="optimum"]')!;
            const nn = svg.querySelector('text[data-label="nearest"]')!;
            const optLine = rect(svg.querySelector('line[data-optimum]')!);
            const nnLine = rect(svg.querySelector('line[data-nearest]')!);
            const a = rect(opt);
            const b = rect(nn);
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push('the two labels meet');
            if (a.bottom > optLine.top + 1) out.push('the optimum label is not above its line');
            if (b.top < nnLine.bottom - 1) out.push('the nearest-neighbour label is not below its line');
            for (const t of [a, b]) if (t.left < box.left || t.right > box.right || t.top < box.top || t.bottom > box.bottom) out.push('a reference label leaves the picture');
            // the optimum's label does not sit on the nearest-neighbour line, nor the other label on the optimum's
            if (a.bottom > nnLine.top - 0.5 && a.top < nnLine.bottom + 0.5 && a.left < nnLine.right) out.push('the optimum label sits on the nearest-neighbour line');
            if (b.top < optLine.bottom + 0.5 && b.bottom > optLine.top - 0.5) out.push('the nearest-neighbour label sits on the optimum line');
            for (const t of svg.querySelectorAll('text')) {
              const r = rect(t);
              if (r.width === 0) continue;
              if (r.left < box.left + 0.5 || r.right > box.right - 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) out.push(`text "${t.textContent}" is cut by the picture`);
            }
            const ticks = [...svg.querySelectorAll('text')].filter((t) => /^[−0-9,.]+$/.test(t.textContent!) && Number(t.getAttribute('x')) < 80);
            const l = Math.min(...ticks.map((t) => rect(t).left));
            if (l < box.left + 2) out.push('a tick label touches the left edge');
            return out;
          });
          expect(problems, `${label} at generation ${generation}`).toEqual([]);
        }
      }
    });
  }
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  test.describe(`at ${width}×${height}`, () => {
    for (const [label, options] of SIZES) {
      test(`${label}: the three panels keep their places and their text stays inside them at every micro-step of two generations`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await open(page, options);
        const seen = new Set<string>();
        for (let k = 0; k < 2 * 52; k++) {
          await page.keyboard.press('ArrowRight');
          const found = await page.evaluate(() => {
            const out: string[] = [];
            const panels = [...document.querySelectorAll('section.panel.plot')].map((p) => p.getBoundingClientRect());
            const places = panels.map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`).join(' | ');
            for (const p of document.querySelectorAll('section.panel.plot')) {
              const r = p.getBoundingClientRect();
              for (const el of p.querySelectorAll('.ph .legend, .summary, .spkey, .sphist, .edgebars')) {
                const e = el.getBoundingClientRect();
                if (e.right > r.right + 1 || e.bottom > r.bottom + 1 || e.left < r.left - 1) out.push(`${el.className} leaves its panel`);
              }
              const head = p.querySelector('.ph')!;
              const legend = head.querySelector('.legend');
              const h2 = head.querySelector('h2')!;
              if (legend && legend.getBoundingClientRect().left < h2.getBoundingClientRect().right) out.push('the legend runs into the heading');
            }
            const edge = document.querySelector('.edgebars');
            const spkey = document.querySelector('.spkey');
            const sphist = document.querySelector('.sphist');
            const summary = document.querySelector('[data-testid="summary"]');
            if (edge && spkey && sphist && summary) {
              const a = edge.getBoundingClientRect();
              const b = spkey.getBoundingClientRect();
              const c = sphist.getBoundingClientRect();
              const d = summary.getBoundingClientRect();
              if (b.top < a.bottom - 1 || c.top < b.bottom - 1 || d.top < c.bottom - 1) out.push('the lines under the bars run into each other');
            }
            return { places, out };
          });
          expect(found.out).toEqual([]);
          seen.add(found.places);
        }
        expect(seen.size, `the panels moved: ${[...seen].join(' || ')}`).toBe(1);
      });
    }
  });
}

test('the other problems keep their strip: the allele bars and no nearest-neighbour line', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('.allele')).toHaveCount(1);
  await expect(page.locator('.edgebars')).toHaveCount(0);
  await expect(page.locator('svg[data-plot="fitness"] line[data-nearest]')).toHaveCount(0);
  await expect(page.locator('#allele-heading')).toHaveText('Share of 1s per gene');
  await expect(page.getByTestId('distinct')).toHaveText(/ of \d+ distinct$/);
});

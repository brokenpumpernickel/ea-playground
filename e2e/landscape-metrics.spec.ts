import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeProblem, metricsOfProblem, type GaParams, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { plotModel } from '../src/ui/plot-models';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { spreadPanel, statsLines } from '../src/ui/spread-model';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const real: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 8 };
const bitsParams = (p: GaParams): GaParams => ({ ...p, crossover: { enabled: true, operator: 'one-point', probability: 0.9 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.05 } });
const paramsOf = (options: LandscapeOptions): GaParams => {
  const p = { ...defaultsOf(entry, options).params, elites: 2 };
  return options.representation === 'real' ? p : bitsParams(p);
};
const open = async (page: Page, options: LandscapeOptions = real, projector = false, size = 12) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size } }, paramsOf(options), 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const engineRun = (options: LandscapeOptions, size = 12) =>
  createRun(gaAlgorithm, { setup: { problem: landscapeProblem(options), init: { kind: 'random', size } }, params: paramsOf(options), seed: 7 });
const numbers = (text: string) => (text.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
/** Values read from the points of one series of one plot, by generation. */
const seriesOf = (page: Page, plot: string, series: string) =>
  page.locator(`[data-plot="${plot}"] [data-series="${series}"][data-gen]`).evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-gen')), Number(e.getAttribute('data-value'))] as const));

for (const representation of ['real', 'gray'] as const) {
  test(`${representation}: every plotted point and every printed figure of the bottom strip is the engine's, for every recorded generation`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const options: LandscapeOptions = { ...real, representation };
    await open(page, options);
    const run = engineRun(options);
    const problem = landscapeProblem(options);
    for (let g = 0; g <= 6; g++) {
      if (g > 0) {
        await page.keyboard.press('g');
        run.forwardCycle();
      }
      const metrics = Array.from({ length: g + 1 }, (_, k) => metricsOfProblem(run.snapshot(k).state, problem));
      // the fitness plot: three lines, one point each generation, on the axis the model says
      for (const [series, pick] of [['average', (m: (typeof metrics)[0]) => m.average], ['best', (m: (typeof metrics)[0]) => m.best], ['bestSoFar', (m: (typeof metrics)[0]) => m.bestSoFar]] as const) {
        const got = await seriesOf(page, 'fitness', series);
        expect(got.map(([k]) => k)).toEqual(metrics.map((_, k) => k));
        got.forEach(([k, value]) => expect(value, `${series} at ${k}`).toBeCloseTo(pick(metrics[k]!), 9));
      }
      // the diversity plot: the decoded measure, and for the binary coding the Hamming one beside it
      const diversity = await seriesOf(page, 'diversity', 'diversity');
      diversity.forEach(([k, value]) => expect(value).toBeCloseTo(metrics[k]!.decoded!.diversity, 9));
      const hamming = await seriesOf(page, 'diversity', 'hamming');
      if (representation === 'real') expect(hamming).toEqual([]);
      else {
        expect(hamming.map(([k]) => k)).toEqual(metrics.map((_, k) => k));
        hamming.forEach(([k, value]) => expect(value).toBeCloseTo(metrics[k]!.diversity, 9));
      }
      // and each is drawn at its height on the 0 to 1 axis (the plot's 28 to 138 in its own units)
      const heights = await page.evaluate(() => {
        const svg = document.querySelector('[data-plot="diversity"]')!;
        const decoded = [...svg.querySelectorAll('circle[data-series="diversity"]')].map((c) => ({ value: Number(c.getAttribute('data-value')), y: Number(c.getAttribute('cy')) }));
        const hamming = [...svg.querySelectorAll('path[data-series="hamming"][data-gen]')].map((p) => ({ value: Number(p.getAttribute('data-value')), y: Number(p.getAttribute('d')!.match(/^M[-0-9.e]+,([-0-9.e]+)/)![1]) + 8 }));
        return { decoded, hamming };
      });
      for (const dot of [...heights.decoded, ...heights.hamming]) expect(dot.y).toBeCloseTo(138 - 110 * dot.value, 3);
      // the spread panel: bars and printed history are the standard deviations as shares of the ranges
      const panel = spreadPanel(plotModel(run, g, problem.knownOptimumFitness))!;
      for (const [name, now, recent] of [['x', panel.now.x, panel.recent.x], ['y', panel.now.y, panel.recent.y]] as const) {
        const row = page.locator(`[data-testid="spread"] .srow[data-var="${name}"]`);
        expect(Number(await row.getAttribute('data-value'))).toBeCloseTo(now, 9);
        expect(await row.locator('.sval').innerText()).toBe(now.toFixed(2));
        const history = (await page.locator(`[data-testid="spread"] .shist[data-var="${name}"]`).getAttribute('data-history'))!.split(',').map(Number);
        expect(history).toHaveLength(recent.length);
        history.forEach((v, k) => expect(v).toBeCloseTo(recent[k]!, 9));
        const printed = (await page.locator(`[data-testid="spread"] .shist[data-var="${name}"]`).innerText()).split(': ')[1]!.split(' ').map(Number);
        expect(printed).toEqual(recent.map((v) => Number(v.toFixed(2))));
      }
      // the stats lines
      const want = statsLines(metrics[g]!);
      const lines = (await page.getByTestId('summary').innerText()).split('\n').map((s) => s.trim());
      // the two fitness lines are the engine's; the third is the peak readout (its numbers are tested in peak-occupancy.spec.ts)
      expect(lines[2]).toMatch(/^near: place 1 \d+ · place 2 \d+ · place 3 \d+ · place 4 \d+$/);
      const got = lines.slice(0, 2);
      expect(got.map((s) => s.replace(/-?\d+(\.\d+)?/g, '#'))).toEqual(want.map((s) => s.replace(/-?\d+(\.\d+)?/g, '#')));
      got.forEach((line, k) => numbers(line).forEach((v, n) => expect(v).toBeCloseTo(numbers(want[k]!)[n]!, 2)));
      // the axis: the model's ticks, with the floor below zero for a minimised function
      const model = plotModel(run, g, problem.knownOptimumFitness);
      const ticks = await page.locator('[data-plot="fitness"] text[text-anchor="end"]').evaluateAll((els) => els.filter((e) => Number(e.getAttribute('x')) < 70).map((e) => Number(e.textContent)));
      expect(ticks).toEqual(model.yTicks.map((v) => Math.round(v * 1000) / 1000));
      // and the points are drawn where the axis says: a straight line through the first and last tick marks
      const drawn = await page.evaluate(() => {
        const svg = document.querySelector('[data-plot="fitness"]')!;
        const labels = [...svg.querySelectorAll('text[text-anchor="end"]')].filter((e) => Number(e.getAttribute('x')) < 70);
        const rule = (e: Element) => ({ value: Number(e.textContent), y: Number(e.getAttribute('y')) - 6 });
        const dots = [...svg.querySelectorAll('circle[data-series="average"]')].map((c) => ({ value: Number(c.getAttribute('data-value')), y: Number(c.getAttribute('cy')) }));
        return { low: rule(labels[0]!), high: rule(labels[labels.length - 1]!), dots };
      });
      for (const dot of drawn.dots) {
        const expectedY = drawn.low.y + ((dot.value - drawn.low.value) / (drawn.high.value - drawn.low.value)) * (drawn.high.y - drawn.low.y);
        expect(dot.y).toBeCloseTo(expectedY, 3);
      }
    }
    expect(await page.locator('#allele-heading').innerText()).toBe('Spread');
    await expect(page.getByTestId('distinct')).toContainText(/\d+ of 12 distinct/);
    // the table for anyone who cannot read a chart carries the same numbers, to three decimals
    const rows = await page.getByTestId('metrics-table').locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent)));
    expect(rows).toHaveLength(7);
    const m6 = metricsOfProblem(run.snapshot(6).state, problem);
    expect(Number(rows[6]![1])).toBeCloseTo(m6.average, 2);
    expect(Number(rows[6]![5])).toBeCloseTo(m6.decoded!.diversity, 2);
  });
}

test('the optimum sits at the top of the axis of a minimised function and is labelled under its line, with fitness = −f said in the legend; a maximised function keeps the floor at zero', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, real);
  await expect(page.locator('[data-plot="fitness"] line[data-optimum]')).toHaveAttribute('data-optimum', '0');
  const geometry = await page.evaluate(() => {
    const svg = document.querySelector('[data-plot="fitness"]')!;
    const line = svg.querySelector('line[data-optimum]')!.getBoundingClientRect();
    const label = [...svg.querySelectorAll('text')].find((t) => t.textContent?.startsWith('optimum'))!.getBoundingClientRect();
    const now = [...svg.querySelectorAll('text')].find((t) => t.textContent === 'now')!.getBoundingClientRect();
    return { lineY: line.top, labelTop: label.top, nowBottom: now.bottom };
  });
  expect(geometry.labelTop).toBeGreaterThan(geometry.lineY); // under the line, clear of "now" above it
  await expect(page.locator('#fitness-heading + .legend, .plot .legend').first()).toContainText('fitness = −f');
  await open(page, { ...real, function: 'single-peak' });
  await expect(page.locator('[data-plot="fitness"] text[text-anchor="end"]').first()).toBeVisible();
  await expect(page.locator('.plot .legend').first()).not.toContainText('fitness = −f');
  const ticks = await page.locator('[data-plot="fitness"] text[text-anchor="end"]').evaluateAll((els) => els.filter((e) => Number(e.getAttribute('x')) < 70).map((e) => e.textContent));
  expect(ticks[0]).toBe('0');
});

test('the other problems keep their strips: the share of 1s per gene, no spread, no Hamming line, the fitness axis from zero', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(url);
  await expect(page.locator('#allele-heading')).toHaveText('Share of 1s per gene');
  await expect(page.locator('.allele')).toBeVisible();
  await expect(page.getByTestId('spread')).toHaveCount(0);
  await expect(page.locator('[data-plot="diversity"] [data-series="hamming"]')).toHaveCount(0);
  const ticks = await page.locator('[data-plot="fitness"] text[text-anchor="end"]').evaluateAll((els) => els.filter((e) => Number(e.getAttribute('x')) < 70).map((e) => e.textContent));
  expect(ticks).toEqual(['0', '250', '500', '750', '1000']);
  await expect(page.getByTestId('summary')).toContainText('generation 0 · best now');
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [representation, projector] of [['real', true], ['gray', true], ['real', false]] as const) {
    test(`at ${width}×${height}${projector ? ' in projector mode' : ''} with the ${representation} coding: the three panels keep their widths, and nothing in them overflows, from generation 0 to 8`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, { ...real, representation }, projector, 40);
      const measure = () =>
        page.evaluate(() => {
          const out: string[] = [];
          const panels = [...document.querySelectorAll('section.plot')] as HTMLElement[];
          for (const panel of panels) {
            const r = panel.getBoundingClientRect();
            for (const el of panel.querySelectorAll('.spread, .spread > *, .spread .shist, .summary, .legend, .ph h2, svg')) {
              const c = el.getBoundingClientRect();
              if (c.right > r.right + 1 || c.bottom > r.bottom + 1 || c.left < r.left - 1) out.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className?.toString?.()} leaves its panel`);
              if (el.scrollWidth > el.clientWidth + 1 && !(el instanceof SVGElement)) out.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className} is wider than its box (${el.scrollWidth}>${el.clientWidth})`);
            }
            const spread = panel.querySelector('.spread');
            if (spread && spread.scrollHeight > spread.clientHeight + 1) out.push(`the spread panel is taller than its box (${spread.scrollHeight}>${spread.clientHeight})`);
            const summary = panel.querySelector('.summary') as HTMLElement | null;
            const peakline = summary?.querySelector('.peakline');
            // two lines of figures, and the peak readout as a third line of its own, none wrapped
            if (summary && summary.getBoundingClientRect().height > (parseFloat(getComputedStyle(summary).lineHeight) || 24) * 2 + (peakline ? peakline.getBoundingClientRect().height : 0) + 4) out.push('the summary wraps');
            const legend = panel.querySelector('.ph .legend') as HTMLElement | null;
            const head = panel.querySelector('.ph') as HTMLElement | null;
            if (legend && head && legend.getBoundingClientRect().right > head.getBoundingClientRect().right + 1) out.push('the legend leaves the header');
          }
          if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
          return { problems: out, widths: panels.map((p) => Math.round(p.getBoundingClientRect().width)) };
        });
      const first = await measure();
      expect(first.problems, 'start').toEqual([]);
      for (let g = 1; g <= 8; g++) {
        await page.keyboard.press('g');
        const now = await measure();
        expect(now.problems, `generation ${g}`).toEqual([]);
        expect(now.widths, `generation ${g}`).toEqual(first.widths);
      }
    });
  }
}

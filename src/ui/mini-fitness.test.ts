import { describe, expect, test } from 'vitest';
import { gaAlgorithm, tspProblem, type GaEvent, type GaParams, type GaSetup, type RunState, type TspOptions } from '../engine';
import { createRun, type Run } from '../run';
import { miniFitness, miniSize } from './mini-fitness';
import { defaultsOf, entryOf } from './problems';
import { fitnessSummary, plotModel } from './plot-models';
import { tourInfoOf, tourPlotExtras } from './tour-cells';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const entry = entryOf('tsp')!;
const options: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
const run = (generations: number): GaRun => {
  const d = defaultsOf(entry, options);
  const r: GaRun = createRun(gaAlgorithm, { setup: { problem: entry.create(options), init: { kind: 'random', size: 12 } }, params: d.params, seed: 5 });
  for (let g = 0; g < generations; g++) r.forwardCycle();
  return r;
};
const problem = tspProblem(options);
const extras = tourPlotExtras(tourInfoOf(problem));
const model = (now: number, generations = 12) => plotModel(run(generations), now, problem.knownOptimumFitness, false, undefined, extras);
const vertices = (path: string) => (path === '' ? [] : path.split(/(?=[ML])/).map((c) => c.slice(1).split(',').map(Number) as [number, number]));

describe('the simplified fitness graph', () => {
  test('has the size it is given and a plot box inside it', () => {
    const g = miniFitness(model(6));
    expect(g.width).toBe(miniSize.width);
    expect(g.height).toBe(miniSize.height);
    expect(g.plot.left).toBeGreaterThanOrEqual(0);
    expect(g.plot.right).toBeLessThanOrEqual(g.width);
    expect(g.plot.top).toBeGreaterThanOrEqual(0);
    expect(g.plot.bottom).toBeLessThanOrEqual(g.height);
  });

  test('draws the three series: best of the generation, best so far and the average, each up to now and dimmed after', () => {
    const m = model(6);
    const g = miniFitness(m);
    expect(g.series.map((s) => s.key)).toEqual(['average', 'bestSoFar', 'best']);
    for (const s of g.series) {
      expect(vertices(s.past), s.key).toHaveLength(7); // generations 0 to 6
      expect(vertices(s.future), s.key).toHaveLength(m.points.length - 6); // generations 6 to the end (the joint belongs to both)
    }
  });

  test('every vertex is the plot point of its generation: x by generation, y by fitness, higher fitness higher up', () => {
    const m = model(12);
    const g = miniFitness(m);
    for (const [key, pick] of [
      ['best', (k: number) => m.points[k]!.best],
      ['bestSoFar', (k: number) => m.points[k]!.bestSoFar],
      ['average', (k: number) => m.points[k]!.average],
    ] as const) {
      const coords = vertices(g.series.find((s) => s.key === key)!.past);
      expect(coords).toHaveLength(m.points.length);
      coords.forEach(([x, y], k) => {
        expect(x).toBeCloseTo(g.plot.left + ((g.plot.right - g.plot.left) * m.points[k]!.generation) / m.xMax, 6);
        expect(y).toBeCloseTo(g.plot.bottom - ((g.plot.bottom - g.plot.top) * (pick(k) - m.yMin)) / (m.yMax - m.yMin), 6);
        expect(y).toBeGreaterThanOrEqual(g.plot.top - 1e-9);
        expect(y).toBeLessThanOrEqual(g.plot.bottom + 1e-9);
      });
    }
    // a fitness that went up moved up the picture (a smaller y)
    const best = vertices(g.series.find((s) => s.key === 'bestSoFar')!.past);
    expect(m.points.at(-1)!.bestSoFar).toBeGreaterThan(m.points[0]!.bestSoFar);
    expect(best.at(-1)![1]).toBeLessThan(best[0]![1]);
  });

  test('marks the generation it is at: the "now" line at its x and a marker of each series, a different shape for each, on its value', () => {
    for (const now of [0, 5, 12]) {
      const m = model(now);
      const g = miniFitness(m);
      expect(g.now.x).toBeCloseTo(g.plot.left + ((g.plot.right - g.plot.left) * now) / m.xMax, 6);
      expect(new Set(g.series.map((s) => s.marker)).size).toBe(3);
      for (const s of g.series) {
        const point = m.points[now]!;
        const value = s.key === 'best' ? point.best : s.key === 'bestSoFar' ? point.bestSoFar : point.average;
        expect(s.at.value).toBe(value);
        expect(s.at.x).toBeCloseTo(g.now.x, 9);
      }
    }
  });

  test('draws the optimum and the nearest-neighbour lines with their words, the labels apart from each other and inside the picture', () => {
    const m = model(4);
    const g = miniFitness(m);
    expect(g.lines.map((l) => l.key)).toEqual(['optimum', 'nearest']);
    expect(g.lines[0]!.text).toBe('optimum −7,542');
    expect(g.lines[1]!.text).toBe('nearest neighbour −8,980');
    for (const l of g.lines) {
      expect(l.y).toBeGreaterThanOrEqual(g.plot.top - 1e-9);
      expect(l.y).toBeLessThanOrEqual(g.plot.bottom + 1e-9);
      expect(l.labelY - 14).toBeGreaterThanOrEqual(0);
      expect(l.labelY).toBeLessThanOrEqual(g.height);
    }
    const [a, b] = [g.lines[0]!, g.lines[1]!];
    expect(Math.abs(a.labelY - b.labelY)).toBeGreaterThanOrEqual(14);
  });

  test('has the ends of the axis in words, the generation range, and the sentence of the full plot', () => {
    const m = model(7);
    const g = miniFitness(m);
    expect(g.yLabels.top.text).toBe(m.format!(m.yMax));
    expect(g.yLabels.bottom.text).toBe(m.format!(m.yMin));
    expect(g.xLabels).toEqual({ left: '0', right: String(m.xMax) });
    expect(g.sentence).toBe(fitnessSummary(m));
    expect(g.sentence).toContain('Generation 7:');
    expect(g.sentence).toContain('Optimum −7,542, nearest neighbour −8,980.');
  });

  test('a run still at generation 0, and a model without reference lines, draw without NaN', () => {
    for (const m of [model(0, 0), plotModel(run(3), 3, undefined)]) {
      const text = JSON.stringify(miniFitness(m));
      expect(text).not.toContain('NaN');
      expect(text).not.toContain('Infinity');
    }
    expect(miniFitness(plotModel(run(3), 3, undefined)).lines).toEqual([]);
  });
});

describe('the sentence of the fitness plot', () => {
  test('reads as it has always read, for any model', () => {
    expect(fitnessSummary(model(3))).toMatch(/^Fitness by generation, scale −[\d,]+ to 0\. Generation 3: average −[\d,]+(\.\d+)?, best of generation −[\d,]+(\.\d+)?, best so far −[\d,]+(\.\d+)?\. Optimum −7,542, nearest neighbour −8,980\.$/);
  });
});

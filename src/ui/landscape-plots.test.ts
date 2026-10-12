import { describe, expect, test } from 'vitest';
import { gaAlgorithm, landscapeProblem, metricsOfProblem, type GaEvent, type GaParams, type GaSetup, type LandscapeOptions, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { plotModel } from './plot-models';
import { spreadPanel, statsLines } from './spread-model';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const params = (o: Partial<GaParams> = {}): GaParams => ({
  selection: { method: 'tournament', size: 3 },
  crossover: { enabled: true, operator: 'blx-alpha', probability: 0.9, alpha: 0.5 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.2, sigma: 0.1 },
  elites: 1,
  stop: { generationLimit: 100 },
  ...o,
});
const make = (options: Partial<LandscapeOptions>, generations = 8, p: GaParams = params(), size = 12) => {
  const full: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 6, ...options };
  const problem = landscapeProblem(full);
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size } }, params: p, seed: 9 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { run, problem };
};
const bits = (): GaParams => params({ crossover: { enabled: true, operator: 'one-point', probability: 0.9 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.05 } });

describe('the fitness axis for a fitness that can be negative', () => {
  test('a minimised function’s fitness runs from below zero up to its optimum at the top: round quarter ticks, and the optimum is on the axis', () => {
    const { run, problem } = make({ function: 'himmelblau' });
    const model = plotModel(run, 4, problem.knownOptimumFitness);
    const worst = Math.min(...model.points.map((p) => p.min));
    expect(worst).toBeLessThan(0);
    expect(worst).toBeLessThan(-300); // this seed’s worst is in (-400, -300), so the floor is the next round value, -400
    expect(model.yMin).toBe(-400);
    expect(model.yMax).toBe(0);
    expect(model.yTicks).toEqual([-400, -300, -200, -100, 0]);
    expect(worst).toBeGreaterThanOrEqual(model.yMin);
    expect(model.optimum).toBe(0);
  });

  test('Rastrigin: the lowest fitness of the run sets the floor to the next nice value', () => {
    const { run, problem } = make({ function: 'rastrigin' });
    const model = plotModel(run, 0, problem.knownOptimumFitness);
    const worst = Math.min(...model.points.map((p) => p.min));
    expect(model.yMin).toBeLessThanOrEqual(worst);
    expect(model.yMin).toBeGreaterThan(worst - Math.abs(worst)); // not absurdly low
    expect(model.yTicks).toHaveLength(5);
    expect(model.yTicks[0]).toBe(model.yMin);
    expect(model.yTicks[4]).toBe(0);
  });

  test('the axes do not depend on the cursor, so scrubbing never rescales the plot', () => {
    const { run, problem } = make({ function: 'himmelblau' });
    const a = plotModel(run, 0, problem.knownOptimumFitness);
    const b = plotModel(run, 8, problem.knownOptimumFitness);
    expect([a.yMin, a.yMax, a.yTicks]).toEqual([b.yMin, b.yMax, b.yTicks]);
  });

  test('a maximised function is as before: from 0 up to a nice ceiling over the optimum', () => {
    const { run, problem } = make({ function: 'single-peak' });
    const model = plotModel(run, 3, problem.knownOptimumFitness);
    expect(model.yMin).toBe(0);
    expect(model.yMax).toBe(1);
    expect(model.yTicks).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  test('the other problems’ plots have a floor of zero and the same ticks as ever', async () => {
    const { goldberg } = await import('../engine');
    const run: GaRun = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 6 } }, params: { ...params(), crossover: { enabled: true, operator: 'one-point', probability: 0.8 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.05 } }, seed: 42 });
    run.forwardCycle();
    const model = plotModel(run, 1, goldberg.knownOptimumFitness);
    expect(model.yMin).toBe(0);
    expect(model.yTicks).toEqual([0, 250, 500, 750, 1000]);
  });
});

describe('diversity and spread in the plot model', () => {
  test('the diversity plotted is the decoded-space one for every representation, and the Hamming one is a second series only for the binary-coded', () => {
    for (const representation of ['real', 'plain', 'gray'] as const) {
      const { run, problem } = make({ representation }, 8, representation === 'real' ? params() : bits());
      const model = plotModel(run, 8, problem.knownOptimumFitness);
      model.points.forEach((p, g) => {
        const m = metricsOfProblem(run.snapshot(g).state, problem);
        expect(p.diversity).toBe(m.decoded!.diversity);
        expect(p.spread).toEqual(m.decoded!.spread);
        if (representation === 'real') expect(p.hamming).toBeUndefined();
        else expect(p.hamming).toBe(m.diversity);
      });
      expect(model.hammingLine === true).toBe(representation !== 'real');
    }
  });

  test('the other problems have no spread and no Hamming line', async () => {
    const { goldberg } = await import('../engine');
    const run: GaRun = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 6 } }, params: { ...params(), crossover: { enabled: true, operator: 'one-point', probability: 0.8 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.05 } }, seed: 42 });
    run.forwardCycle();
    const model = plotModel(run, 1, 961);
    expect(model.points.every((p) => p.spread === undefined && p.hamming === undefined)).toBe(true);
    expect(model.hammingLine).toBeUndefined();
  });
});

describe('the spread panel', () => {
  test('the standard deviations of x and y as shares of the ranges at the cursor, with the history up to it', () => {
    const { run, problem } = make({ function: 'rastrigin' }, 8);
    const model = plotModel(run, 5, problem.knownOptimumFitness);
    const panel = spreadPanel(model)!;
    const at = (g: number) => metricsOfProblem(run.snapshot(g).state, problem).decoded!.spread;
    expect(panel.now).toEqual({ x: at(5)[0], y: at(5)[1] });
    expect(panel.generation).toBe(5);
    expect(panel.history.x).toEqual([0, 1, 2, 3, 4, 5].map((g) => at(g)[0]));
    expect(panel.history.y).toEqual([0, 1, 2, 3, 4, 5].map((g) => at(g)[1]));
  });

  test('a long run keeps the last six generations in the printed history', () => {
    const { run, problem } = make({}, 12);
    const panel = spreadPanel(plotModel(run, 12, problem.knownOptimumFitness))!;
    expect(panel.history.x).toHaveLength(12 + 1);
    expect(panel.recent.generations).toEqual([7, 8, 9, 10, 11, 12]);
    expect(panel.recent.x).toEqual(panel.history.x.slice(-6));
  });

  test('the bars are the shares on a scale of 0 to 0.5 (the two extremes of a range, half on each bound, are 0.5)', () => {
    const { run, problem } = make({}, 3);
    const panel = spreadPanel(plotModel(run, 3, problem.knownOptimumFitness))!;
    expect(panel.bar.x).toBeCloseTo(Math.min(1, panel.now.x / 0.5), 12);
    expect(panel.bar.y).toBeCloseTo(Math.min(1, panel.now.y / 0.5), 12);
    expect(panel.bar.x).toBeGreaterThanOrEqual(0);
    expect(panel.bar.x).toBeLessThanOrEqual(1);
  });

  test('it only exists for a landscape', async () => {
    const { goldberg } = await import('../engine');
    const run: GaRun = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 6 } }, params: { ...params(), crossover: { enabled: true, operator: 'one-point', probability: 0.8 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.05 } }, seed: 42 });
    expect(spreadPanel(plotModel(run, 0, 961))).toBeUndefined();
  });
});

describe('the stats lines', () => {
  test('say the generation, best now, best so far, average, worst and evaluations to three decimals, so they fit', () => {
    const { run, problem } = make({ function: 'himmelblau' }, 4);
    const m = metricsOfProblem(run.snapshot(4).state, problem);
    const lines = statsLines(m);
    const r = (v: number) => String(Math.round(v * 1000) / 1000);
    expect(lines).toEqual([`generation 4 · best now ${r(m.best)} · best so far ${r(m.bestSoFar)}`, `average ${r(m.average)} · worst ${r(m.worst)} · evaluations ${m.evaluations}`]);
    for (const line of lines) expect(line).not.toMatch(/\d\.\d{4,}/);
  });
});

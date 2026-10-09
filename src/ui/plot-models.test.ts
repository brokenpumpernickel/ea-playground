import { describe, expect, test } from 'vitest';
import { gaAlgorithm, goldberg, metricsOf, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { niceCeiling, plotModel } from './plot-models';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;

const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const make = (generations: number, overrides: Partial<GaParams> = {}, seed = 42): GaRun => {
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 6 } }, params: { ...params, ...overrides }, seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};

describe('nice ceilings', () => {
  test.each([
    [961, 1000],
    [1000, 1000],
    [1001, 2000],
    [15, 20],
    [3, 4],
    [0.7, 0.8],
    [0, 1],
  ])('%d rounds up to %d, so the quarter ticks are round numbers too', (value, expected) => {
    expect(niceCeiling(value)).toBe(expected);
  });
});

describe('plot model', () => {
  test('has one point per recorded generation, every value equal to the engine’s metrics', () => {
    const run = make(8);
    const model = plotModel(run, 3, goldberg.knownOptimumFitness);
    expect(model.points.map((p) => p.generation)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    model.points.forEach((p, g) => {
      const m = metricsOf(run.snapshot(g).state);
      expect(p).toMatchObject({
        generation: g,
        average: m.average,
        min: m.worst,
        max: m.best,
        best: m.best,
        bestSoFar: m.bestSoFar,
        diversity: m.diversity,
        distinct: m.distinct,
      });
    });
  });

  test('later generations than the cursor are marked as future, not removed', () => {
    const run = make(8);
    const model = plotModel(run, 3, 961);
    expect(model.now).toBe(3);
    expect(model.points.filter((p) => p.future).map((p) => p.generation)).toEqual([4, 5, 6, 7, 8]);
    expect(model.points).toHaveLength(9);
  });

  test('the scale is fixed by the problem: it covers the known optimum and every plotted fitness, and ignores the cursor', () => {
    const run = make(12);
    const a = plotModel(run, 0, 961);
    const b = plotModel(run, 12, 961);
    expect(a.yMax).toBe(1000);
    expect(a.yTicks).toEqual([0, 250, 500, 750, 1000]);
    expect(b.yMax).toBe(a.yMax);
    expect(b.xMax).toBe(a.xMax);
    expect(a.optimum).toBe(961);
    // no known optimum: the scale follows the data
    const free = plotModel(run, 0, undefined);
    const top = Math.max(...free.points.map((p) => p.max));
    expect(free.yMax).toBe(niceCeiling(top));
    expect(free.optimum).toBeUndefined();
  });

  test('the generation axis grows in steps, so it stays put while a run plays on', () => {
    expect(plotModel(make(5), 5, 961).xMax).toBe(15);
    expect(plotModel(make(15), 15, 961).xMax).toBe(15);
    expect(plotModel(make(16), 16, 961).xMax).toBe(30);
    expect(plotModel(make(0), 0, 961).xTicks).toEqual([0, 3, 6, 9, 12, 15]);
  });

  test('best of generation can fall below best so far, and the model keeps both', () => {
    // with no elitism a high mutation rate loses good individuals; search seeds for such a run
    let found = false;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const model = plotModel(make(15, { mutation: { enabled: true, mode: 'per-gene', probability: 0.3 } }, seed), 15, 961);
      const dip = model.points.find((p) => p.best < p.bestSoFar);
      if (!dip) continue;
      found = true;
      expect(dip.bestSoFar).toBe(Math.max(...model.points.filter((p) => p.generation <= dip.generation).map((p) => p.best)));
    }
    expect(found).toBe(true);
  });

  test('allele shares and counts are available for the generation at the cursor', () => {
    const run = make(4);
    const model = plotModel(run, 2, 961);
    const m = metricsOf(run.snapshot(2).state);
    expect(model.points[2]!.alleleFrequencies).toEqual(m.alleleFrequencies);
  });
});

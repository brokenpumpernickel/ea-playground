import { describe, expect, test } from 'vitest';
import { gaAlgorithm, tspCatalogue, tspProblem, type GaEvent, type GaParams, type GaSetup, type RunState, type TspOptions } from '../engine';
import { createRun, type Run } from '../run';
import { defaultsOf, entryOf } from './problems';
import { fitnessPlotBox, plotModel, referenceLabels } from './plot-models';
import { tourInfoOf, tourPlotExtras } from './tour-cells';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const entry = entryOf('tsp')!;
const run = (options: TspOptions, generations: number, seed = 5): GaRun => {
  const d = defaultsOf(entry, options);
  const r: GaRun = createRun(gaAlgorithm, { setup: { problem: entry.create(options), init: { kind: 'random', size: 12 } }, params: d.params, seed });
  for (let g = 0; g < generations; g++) r.forwardCycle();
  return r;
};
const extrasOf = (options: TspOptions) => {
  const problem = tspProblem(options);
  return { problem, extras: tourPlotExtras(tourInfoOf(problem)) };
};
const everyInstance: TspOptions[] = [
  ...tspCatalogue.filter((c) => c.kind === 'tsplib').map((c) => ({ instance: c.id, n: 10, seed: 1 })),
  { instance: 'clusters', n: 10, seed: 1 },
  ...[5, 8, 11, 15].flatMap((n) => [{ instance: 'circle', n, seed: 1 }, ...[1, 2, 3].map((seed) => ({ instance: 'random', n, seed }))]),
];

describe('the fitness plot of a tour run', () => {
  test('carries the nearest-neighbour line and a way of writing a fitness: grouped, with a real minus', () => {
    const o: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
    const { problem, extras } = extrasOf(o);
    const model = plotModel(run(o, 3), 3, problem.knownOptimumFitness, false, undefined, extras);
    expect(model.nearest).toBe(-8980);
    expect(model.optimum).toBe(-7542);
    expect(model.format!(-26250)).toBe('−26,250');
    expect(model.format!(0)).toBe('0');
    expect(model.wideAxis).toBe(true);
  });

  test('without the extras the model is what it was: no nearest line, no formatter, the narrow axis', () => {
    const o: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
    const model = plotModel(run(o, 2), 2, -6859);
    expect(model.nearest).toBeUndefined();
    expect(model.format).toBeUndefined();
    expect(model.wideAxis).toBeUndefined();
  });

  test('leaves room under the nearest-neighbour line for its label, for every instance and early and late in a run', () => {
    for (const o of everyInstance) {
      const { problem, extras } = extrasOf(o);
      for (const g of [0, 25]) {
        const model = plotModel(run(o, g), g, problem.knownOptimumFitness, false, undefined, extras);
        const share = (extras.nearest - model.yMin) / (model.yMax - model.yMin);
        expect(share, `${o.instance} ${o.n} at generation ${g}: the nearest-neighbour line sits ${Math.round(share * 100)}% above the floor`).toBeGreaterThanOrEqual(0.14);
        expect(model.yMin).toBeLessThan(0);
        expect(model.yMax).toBe(0);
        // the floor, the top and the ticks are round numbers
        expect(model.yTicks).toHaveLength(5);
      }
    }
  });

  test('keeps the nearest-neighbour label in the picture when every tour is as long as it, and when every tour is shorter', () => {
    const o: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
    const { problem, extras } = extrasOf(o);
    const instance = problem.instance;
    const text = (tour: readonly number[]) => tour.map((c) => c + 1).join(' ');
    for (const tour of [instance.nearestNeighbour.tour, instance.optimalTour]) {
      const d = defaultsOf(entry, o);
      const r: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'explicit', chromosomes: Array.from({ length: 12 }, () => text(tour)) } }, params: d.params, seed: 5 });
      const model = plotModel(r, 0, problem.knownOptimumFitness, false, undefined, extras);
      const share = (extras.nearest - model.yMin) / (model.yMax - model.yMin);
      expect(share, `tours of length ${problem.lengthOf([...tour])}`).toBeGreaterThanOrEqual(0.14);
    }
  });

  test('every tick label of the axis fits the margin, for every instance', () => {
    for (const o of everyInstance) {
      const { problem, extras } = extrasOf(o);
      const model = plotModel(run(o, 0), 0, problem.knownOptimumFitness, false, undefined, extras);
      const widest = Math.max(...model.yTicks.map((v) => model.format!(v).length));
      // 100 px of margin hold seven characters at the plot's 18 px; the margin grows with the labels beyond that
      expect(fitnessPlotBox(model).left).toBeGreaterThanOrEqual(Math.max(66, 20 + widest * 11.5) - 0.001);
    }
  });

  test('the plot box keeps the old margin and the old top for the other problems, and a tour plot starts its axis 18 lower', () => {
    const plain = fitnessPlotBox(plotModel(run({ instance: 'ulysses16', n: 10, seed: 1 }, 1), 1, -6859));
    expect(plain).toEqual({ left: 66, right: 780, top: 28, dataTop: 28, bottom: 138 });
    const o: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
    const { problem, extras } = extrasOf(o);
    expect(fitnessPlotBox(plotModel(run(o, 1), 1, problem.knownOptimumFitness, false, undefined, extras))).toMatchObject({ top: 28, dataTop: 46 });
  });
});

describe('where the labels of the two reference lines go', () => {
  const { top, bottom } = fitnessPlotBox({} as never);
  const dataTop = fitnessPlotBox({ wideAxis: true, yTicks: [0], format: (v) => String(v) }).dataTop;
  const extent = (baseline: number) => [baseline - 16, baseline + 4] as const;
  const overlap = (a: readonly [number, number], b: readonly [number, number]) => a[0] < b[1] && b[0] < a[1];

  test('the optimum’s label is above its line and the nearest neighbour’s below its line, which is never above the optimum’s', () => {
    const l = referenceLabels(60, 100);
    expect(l.optimum).toBe(54);
    expect(l.nearest).toBe(120);
    expect(overlap(extent(l.optimum), extent(l.nearest))).toBe(false);
  });

  test('close lines keep their labels apart, the one above the upper line and the other below the lower', () => {
    for (const gap of [0, 1, 3, 6, 10]) {
      const l = referenceLabels(80, 80 + gap);
      expect(overlap(extent(l.optimum), extent(l.nearest)), `lines ${gap} px apart`).toBe(false);
      expect(l.optimum).toBeLessThan(80);
      expect(l.nearest).toBeGreaterThan(80 + gap);
    }
  });

  test('with no room above the picture the optimum’s label goes below its line, and with no room below the nearest neighbour’s goes above its line', () => {
    expect(referenceLabels(top + 5, 100).optimum).toBe(top + 5 + 20);
    expect(referenceLabels(60, bottom - 3).nearest).toBe(bottom - 3 - 6);
  });

  test('in every ordinary case the labels stay inside the picture and clear of each other, for every instance', () => {
    for (const o of everyInstance) {
      const { problem, extras } = extrasOf(o);
      for (const g of [0, 25]) {
        const model = plotModel(run(o, g), g, problem.knownOptimumFitness, false, undefined, extras);
        const Y = (v: number) => bottom - ((bottom - dataTop) * (v - model.yMin)) / (model.yMax - model.yMin);
        const l = referenceLabels(Y(model.optimum!), Y(model.nearest!));
        expect(overlap(extent(l.optimum), extent(l.nearest)), `${o.instance} ${o.n}`).toBe(false);
        expect(extent(l.optimum)[0], `${o.instance} ${o.n}: the optimum's label leaves the top`).toBeGreaterThanOrEqual(top - 4);
        expect(extent(l.nearest)[1], `${o.instance} ${o.n}: the nearest neighbour's label leaves the bottom`).toBeLessThanOrEqual(bottom + 2);
        // the label is on the outside of its own line: the optimum's label is above the optimum's line
        expect(l.optimum).toBeLessThan(Y(model.optimum!));
        expect(l.nearest).toBeGreaterThan(Y(model.nearest!));
      }
    }
  });
});

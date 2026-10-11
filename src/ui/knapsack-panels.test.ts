import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, knapsackDefaults, knapsackProblem, metricsOf, type GaParams, type GaSetup, type Handling } from '../engine';
import { createRun } from '../run';
import { chosenShares, describeChosen } from './chosen-model';
import ChosenStrip from './ChosenStrip.svelte';
import FitnessPlot from './FitnessPlot.svelte';
import { plotModel } from './plot-models';

const params: GaParams = { ...knapsackDefaults.params, stop: { generationLimit: 50 } };
const make = (handling: Handling, rho = 4, seed = 3) => {
  const problem = knapsackProblem({ ...knapsackDefaults.options, handling, rho });
  const setup: GaSetup = { problem, init: { kind: 'random', size: 10 } };
  const run = createRun(gaAlgorithm, { setup, params, seed });
  for (let g = 0; g < 6; g++) run.forwardCycle();
  return { run, problem };
};
const html = (component: unknown, props: Record<string, unknown>) => render(component as never, { props: props as never }).body;

describe('chosen per item', () => {
  test('is, for each item, the share of the population whose gene for it is 1, read from the metrics', () => {
    const { run } = make('decoder');
    for (const g of [0, 3, 6]) {
      const state = run.snapshot(g).state;
      const shares = chosenShares(metricsOf(state));
      expect(shares.map((s) => s.letter).join('')).toBe('ABCDEFGHIJKL');
      shares.forEach((s, k) => expect(s.share).toBe(state.population.filter((i) => i.chromosome[k] === 1).length / state.population.length));
    }
  });

  test('the strip draws a bar per item with its percentage and letter, and says all of it to a screen reader', () => {
    const { run } = make('decoder');
    const shares = chosenShares(metricsOf(run.snapshot(2).state));
    const markup = html(ChosenStrip, { shares });
    expect([...markup.matchAll(/data-item="(.)" data-share="([\d.]+)"/g)].map((m) => [m[1], Number(m[2])])).toEqual(shares.map((s) => [s.letter, s.share]));
    expect([...markup.matchAll(/<b>(\d+)%<\/b>/g)].map((m) => Number(m[1]))).toEqual(shares.map((s) => Math.round(s.share * 100)));
    expect(markup).toContain('role="img"');
    expect(markup).toContain(describeChosen(shares));
    expect(describeChosen([{ position: 1, letter: 'A', share: 0.5 }, { position: 2, letter: 'B', share: 0.25 }])).toBe('Share of the population that packs each item: item A, 50 percent; item B, 25 percent.');
  });
});

describe('the best feasible line of the fitness plot', () => {
  test('is in the model only when asked for, with the metrics’ best feasible so far at every generation', () => {
    const { run, problem } = make('penalty', 4);
    const without = plotModel(run, 6, problem.knownOptimumFitness);
    expect(without.feasibleLine).toBeUndefined();
    expect(without.points.every((p) => !('feasibleBestSoFar' in p))).toBe(true);
    const model = plotModel(run, 6, problem.knownOptimumFitness, true);
    expect(model.feasibleLine).toBe(true);
    model.points.forEach((p, g) => expect(p.feasibleBestSoFar).toBe(metricsOf(run.snapshot(g).state).feasible!.bestSoFar));
  });

  test('the problem asks for it only under the penalty, the one method that can have infeasible individuals', () => {
    expect(make('penalty').problem.mayBeInfeasible).toBe(true);
    for (const h of ['decoder', 'repair-lamarckian', 'repair-baldwinian'] as const) expect(make(h).problem.mayBeInfeasible).toBe(false);
  });

  test('the plot draws a diamond per generation that has one, on its own series, and says it in its description', () => {
    const { run, problem } = make('penalty', 4);
    const model = plotModel(run, 4, problem.knownOptimumFitness, true);
    const markup = html(FitnessPlot, { model });
    const known = model.points.filter((p) => p.feasibleBestSoFar !== null);
    expect([...markup.matchAll(/data-series="feasibleBestSoFar" data-gen="(\d+)" data-value="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])])).toEqual(known.map((p) => [p.generation, p.feasibleBestSoFar]));
    expect(markup).toContain('best feasible so far');
    expect(markup).toMatch(/aria-label="[^"]*best feasible so far \d+/);
  });

  test('without the option there is no such series, and the description is as before', () => {
    const { run, problem } = make('decoder');
    const markup = html(FitnessPlot, { model: plotModel(run, 4, problem.knownOptimumFitness) });
    expect(markup).not.toContain('feasibleBestSoFar');
    expect(markup).not.toContain('feasible');
  });

  test('before any feasible individual exists the line has no points and the description says none yet', () => {
    const problem = knapsackProblem({ ...knapsackDefaults.options, handling: 'penalty', rho: 4 });
    const setup: GaSetup = { problem, init: { kind: 'explicit', chromosomes: ['111111111111', '111111111110', '111111111101'] } };
    const run = createRun(gaAlgorithm, { setup, params, seed: 1 });
    const model = plotModel(run, 0, problem.knownOptimumFitness, true);
    expect(model.points[0]!.feasibleBestSoFar).toBeNull();
    const markup = html(FitnessPlot, { model });
    expect(markup).toContain('best feasible so far none yet');
    expect(markup).not.toContain('data-series="feasibleBestSoFar" data-gen');
  });
});

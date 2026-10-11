import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, trapDefaults, trapProblem, type GaParams, type GaSetup } from '../engine';
import { createRun } from '../run';
import FitnessPlot from './FitnessPlot.svelte';
import { plotModel } from './plot-models';

const make = () => {
  const problem = trapProblem({ blockSize: 4, blocks: 5, linkage: 'tight' });
  const params: GaParams = { ...trapDefaults.params, stop: { generationLimit: 50 } };
  const setup: GaSetup = { problem, init: { kind: 'random', size: 12 } };
  const run = createRun(gaAlgorithm, { setup, params, seed: 3 });
  for (let g = 0; g < 5; g++) run.forwardCycle();
  return { run, problem };
};
const html = (model: ReturnType<typeof plotModel>) => render(FitnessPlot as never, { props: { model } as never }).body.replace(/<!--.*?-->/g, '');

describe('the all zeros line of the trap’s fitness plot', () => {
  test('is in the model only when asked for, and the axis is the same either way', () => {
    const { run, problem } = make();
    const without = plotModel(run, 5, problem.knownOptimumFitness);
    expect(without.attractor).toBeUndefined();
    const model = plotModel(run, 5, problem.knownOptimumFitness, false, problem.attractorFitness);
    expect(model.attractor).toBe(15);
    expect(model.optimum).toBe(20);
    expect(model.yMax).toBe(without.yMax);
    expect(model.points).toEqual(without.points);
  });

  test('is drawn as a dashed line with its own label, beside the optimum line, so a student sees where all zeros stands', () => {
    const { run, problem } = make();
    const markup = html(plotModel(run, 5, problem.knownOptimumFitness, false, problem.attractorFitness));
    expect(markup).toContain('data-optimum="20"');
    expect(markup).toContain('data-attractor="15"');
    expect(markup).toContain('all zeros 15');
    expect(markup).toContain('optimum 20');
    // the two lines differ by their dashes as well as their labels
    const dash = (attr: string) => new RegExp(`stroke-dasharray="([^"]*)"[^>]*${attr}`).exec(markup)?.[1];
    expect(dash('data-optimum')).toBeDefined();
    expect(dash('data-attractor')).toBeDefined();
    expect(dash('data-optimum')).not.toBe(dash('data-attractor'));
  });

  test('without it the plot is as before', () => {
    const { run, problem } = make();
    const markup = html(plotModel(run, 5, problem.knownOptimumFitness));
    expect(markup).not.toContain('all zeros');
    expect(markup).not.toContain('data-attractor');
  });

  test('the plot’s sentence for a screen reader says it too', () => {
    const { run, problem } = make();
    const markup = html(plotModel(run, 5, problem.knownOptimumFitness, false, problem.attractorFitness));
    expect(markup).toMatch(/aria-label="[^"]*All zeros scores 15/);
  });
});

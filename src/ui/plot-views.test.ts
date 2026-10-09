import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, goldberg, metricsOf, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import AlleleStrip from './AlleleStrip.svelte';
import DiversityPlot from './DiversityPlot.svelte';
import FitnessPlot from './FitnessPlot.svelte';
import { plotModel } from './plot-models';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const make = (generations: number): GaRun => {
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 6 } }, params, seed: 42 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};
const html = (component: unknown, props: Record<string, unknown>) => render(component as never, { props: props as never }).body;

/** Every element carrying data-series="name", as [generation, value, future]. */
const markers = (markup: string, series: string) =>
  [...markup.matchAll(new RegExp(`data-series="${series}"[^>]*data-gen="(\\d+)"[^>]*data-value="([^"]+)"[^>]*data-future="(true|false)"`, 'g'))].map((m) => [Number(m[1]), Number(m[2]), m[3] === 'true'] as const);

describe('fitness plot', () => {
  test('plots average, best of generation and best so far as three marked series, each value the engine’s', () => {
    const run = make(6);
    const markup = html(FitnessPlot, { model: plotModel(run, 6, 961) });
    for (const [series, pick] of [
      ['average', (m: ReturnType<typeof metricsOf>) => m.average],
      ['best', (m: ReturnType<typeof metricsOf>) => m.best],
      ['bestSoFar', (m: ReturnType<typeof metricsOf>) => m.bestSoFar],
    ] as const) {
      const got = markers(markup, series);
      expect(got.map((g) => g[0])).toEqual([0, 1, 2, 3, 4, 5, 6]);
      got.forEach(([g, value]) => expect(value).toBe(pick(metricsOf(run.snapshot(g).state))));
    }
  });

  test('the three series have different marker shapes, so colour is not the only cue', () => {
    const markup = html(FitnessPlot, { model: plotModel(make(2), 2, 961) });
    expect(markup).toMatch(/<circle[^>]*data-series="average"/);
    expect(markup).toMatch(/<rect[^>]*data-series="best"/);
    expect(markup).toMatch(/<path[^>]*data-series="bestSoFar"[^>]*data-gen/);
  });

  test('generations after the cursor are still drawn, but marked as future and dimmed', () => {
    const markup = html(FitnessPlot, { model: plotModel(make(6), 2, 961) });
    const average = markers(markup, 'average');
    expect(average).toHaveLength(7);
    expect(average.filter((a) => a[2]).map((a) => a[0])).toEqual([3, 4, 5, 6]);
    expect(markup).toContain('data-now="2"');
    expect(markup).toMatch(/opacity="0.3"[^>]*data-series="average"/);
  });

  test('draws the known optimum as a labelled reference line, and a labelled fixed scale', () => {
    const markup = html(FitnessPlot, { model: plotModel(make(3), 3, 961) });
    expect(markup).toContain('data-optimum="961"');
    expect(markup).toContain('optimum 961');
    for (const tick of ['0', '250', '500', '750', '1000']) expect(markup).toContain(`>${tick}</text>`);
    expect(markup).toContain('>generation</text>');
  });

  test('describes itself for screen readers', () => {
    const markup = html(FitnessPlot, { model: plotModel(make(3), 3, 961) });
    expect(markup).toMatch(/role="img" aria-label="Fitness by generation, scale 0 to 1000\. Generation 3: average [\d.]+, best of generation \d+, best so far \d+\./);
  });
});

describe('diversity plot', () => {
  test('plots the engine’s diversity for every generation, with distinct counts on hover', () => {
    const run = make(5);
    const markup = html(DiversityPlot, { model: plotModel(run, 5, 961) });
    const got = markers(markup, 'diversity');
    expect(got.map((g) => g[0])).toEqual([0, 1, 2, 3, 4, 5]);
    got.forEach(([g, value]) => expect(value).toBe(metricsOf(run.snapshot(g).state).diversity));
    expect(markup).toMatch(/, \d+ distinct<\/title>/);
    expect(markup).toContain('scale 0 to 1');
  });
});

describe('allele strip', () => {
  test('one bar per gene with its share of ones as a number', () => {
    const state = make(2).snapshot(2).state;
    const shares = metricsOf(state).alleleFrequencies;
    const markup = html(AlleleStrip, { shares });
    expect([...markup.matchAll(/data-share="([^"]+)"/g)].map((m) => Number(m[1]))).toEqual([...shares]);
    expect(markup).toContain(shares[0]!.toFixed(2));
    expect(markup).toContain('gene 5');
  });
});

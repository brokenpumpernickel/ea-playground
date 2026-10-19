import { describe, expect, test } from 'vitest';
import { gaAlgorithm, landscapeDefaultEpsilon, landscapeProblem, type GaParams, type LandscapeOptions, type NichingConfig } from '../engine';
import { createRun } from '../run';
import { presets, type Preset } from './presets';

/**
 * The two niching presets on the Two peaks landscape, and every number their texts give. The statistics are measured here,
 * with the real engine, over seeds 1 to 100; nothing in a text is a guess. "Near a hill" means within 1.5 of its top,
 * "found" means that the best so far came within ε of the narrow hill's top.
 */
const preset = (suffix: string): Preset => presets.find((p) => p.problem === 'landscape' && p.id.endsWith(suffix))!;
const sharing = preset('two-peaks-sharing');
const crowding = preset('two-peaks-crowding');
const plainSeed = preset('landscape-two-peaks');
const options = sharing.options as LandscapeOptions;
const problem = landscapeProblem(options);
const epsilon = landscapeDefaultEpsilon(problem);
const size = (p: Preset) => (p.setup.init.kind === 'random' ? p.setup.init.size : 0);

const withoutNiching = (params: GaParams): GaParams => {
  const { niching: _niching, ...rest } = params;
  return rest;
};
const play = (params: GaParams, n: number, seed: number, generations: number) => {
  const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: n } }, params, seed }, { eventCacheSize: 0 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};
type Played = ReturnType<typeof play>;
const near = (p: { x: number; y: number }, x: number, y: number) => Math.hypot(p.x - x, p.y - y) <= 1.5;
const points = (run: Played, g: number) => run.snapshot(g).state.population.map((i) => problem.pointOf(i.chromosome));
const counts = (run: Played, g: number) => {
  const pts = points(run, g);
  return { broad: pts.filter((p) => near(p, -2.5, -2.5)).length, narrow: pts.filter((p) => near(p, 3, 3)).length };
};
const firstWithin = (run: Played): number | null => {
  for (let g = 0; g <= run.lastCycle; g++) if (run.snapshot(g).state.bestFitnessSoFar >= problem.knownOptimumFitness! - epsilon) return g;
  return null;
};
const firstStop = (run: Played) => {
  for (let g = 1; g <= run.lastCycle; g++) if (run.snapshot(g).stops.length > 0) return { generation: g, reasons: run.snapshot(g).stops };
  return null;
};
/** Over seeds 1 to 100: the runs that found the narrow hill, and those with an individual near each hill at the end. */
const batch = (params: GaParams, n: number, generations: number) => {
  let found = 0;
  let both = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const run = play(params, n, seed, generations);
    if (firstWithin(run) !== null) found++;
    const c = counts(run, generations);
    if (c.broad > 0 && c.narrow > 0) both++;
  }
  return { found, both };
};
const mentions = (text: string, parts: string[]) => {
  for (const part of parts) expect(text, part).toContain(part);
};
const tournament: GaParams['selection'] = { method: 'tournament', size: 2 };

describe('the two niching presets are as the drawer and the links see them', () => {
  test('both are on Two peaks, population 40, seed 23, with the niching setting they name; the list has them after the other landscape presets and before the tours', () => {
    expect([sharing.name, crowding.name]).toEqual(['Two peaks: fitness sharing', 'Two peaks: deterministic crowding']);
    expect([size(sharing), size(crowding), sharing.seed, crowding.seed]).toEqual([40, 40, 23, 23]);
    expect(options).toEqual({ function: 'two-peaks', representation: 'real', bitsPerVariable: 10 });
    expect(sharing.params.niching).toEqual({ method: 'sharing', sigma: 3, alpha: 1 });
    expect(sharing.params.selection).toEqual({ method: 'roulette', chain: [{ step: 'identity' }] });
    expect(crowding.params.niching).toEqual({ method: 'crowding', sigma: 2, alpha: 1 });
    const ids = presets.map((p) => p.id);
    expect(ids.indexOf(sharing.id)).toBeGreaterThan(ids.indexOf(preset('landscape-gray').id));
    expect(ids.indexOf(crowding.id)).toBeLessThan(ids.findIndex((id) => id.includes('tsp')));
  });

  test('apart from the niching setting, the selection and the stop they are the existing Two peaks preset', () => {
    for (const p of [sharing, crowding]) {
      expect(p.params.crossover).toEqual(plainSeed.params.crossover);
      expect(p.params.mutation).toEqual(plainSeed.params.mutation);
      expect(p.params.elites).toBe(plainSeed.params.elites);
      expect(p.params.stop.targetEpsilon).toBe(plainSeed.params.stop.targetEpsilon);
      expect(p.params.stop.stagnationWindow).toBe(plainSeed.params.stop.stagnationWindow);
    }
    expect([sharing.params.stop.generationLimit, crowding.params.stop.generationLimit]).toEqual([100, 200]);
  });
});

describe('Two peaks: fitness sharing', () => {
  const text = sharing.lookFor;
  const withSharing = () => play(sharing.params, 40, sharing.seed, 100);
  const without = () => play(withoutNiching(sharing.params), 40, sharing.seed, 100);

  test('with seed 23 the run without sharing has 39 of 40 on the broad hill in generation 100 and never gets within ε', () => {
    const run = without();
    expect(counts(run, 100)).toEqual({ broad: 39, narrow: 0 });
    expect(firstWithin(run)).toBeNull();
    expect(firstStop(run)).toEqual({ generation: 100, reasons: ['generation-limit'] });
  });

  test('with sharing the narrow hill is within ε in generation 24, where Run until stop pauses, with 6 near the broad hill and 13 near the narrow one; 4 and 11 in generation 100', () => {
    const run = withSharing();
    expect(firstWithin(run)).toBe(24);
    expect(firstStop(run)).toEqual({ generation: 24, reasons: ['target-reached'] });
    expect(counts(run, 24)).toEqual({ broad: 6, narrow: 13 });
    expect(counts(run, 100)).toEqual({ broad: 4, narrow: 11 });
  });

  test('over seeds 1 to 100 sharing finds the narrow hill in 51 runs against 19 without it, so 49 miss it; σ = 2 finds it in 40', () => {
    expect(batch(sharing.params, 40, 100).found).toBe(51);
    expect(batch(withoutNiching(sharing.params), 40, 100).found).toBe(19);
    expect(batch({ ...sharing.params, niching: { method: 'sharing', sigma: 2, alpha: 1 } as NichingConfig }, 40, 100).found).toBe(40);
  }, 120_000);

  test('with tournaments of 2 in place of the roulette wheel sharing does not help: 7 runs against 9 without it', () => {
    expect(batch({ ...sharing.params, selection: tournament }, 40, 100).found).toBe(7);
    expect(batch({ ...withoutNiching(sharing.params), selection: tournament }, 40, 100).found).toBe(9);
  }, 120_000);

  test('the text says exactly these numbers', () => {
    mentions(text, ['Population 40, seed 23', 'σ = 3', '39 of the 40', 'generation 100', 'generation 24', '6 individuals near the broad hill and 13 near the narrow one', 'still 4 and 11', 'radius σ', '51 runs against 19', '49 still miss', 'σ = 2 finds it in 40 runs', '7 runs against 9']);
  });
});

describe('Two peaks: deterministic crowding', () => {
  const text = crowding.lookFor;
  const plain = () => play(withoutNiching(crowding.params), 40, crowding.seed, 200);
  const withCrowding = () => play(crowding.params, 40, crowding.seed, 200);

  test('with seed 23 the run without crowding has all 40 on the broad hill from generation 20 to 200', () => {
    const run = plain();
    for (const g of [20, 100, 200]) expect(counts(run, g), `generation ${g}`).toEqual({ broad: 40, narrow: 0 });
  });

  test('with crowding there are 36 near the broad hill and 4 near the narrow one in generation 20, and 35 and 5 in generation 100, best 0.95 then, within ε in generation 139 where Run until stop pauses', () => {
    const run = withCrowding();
    expect(counts(run, 20)).toEqual({ broad: 36, narrow: 4 });
    expect(counts(run, 100)).toEqual({ broad: 35, narrow: 5 });
    expect(run.snapshot(100).state.bestFitnessSoFar.toFixed(2)).toBe('0.95');
    expect(firstWithin(run)).toBe(139);
    expect(firstStop(run)).toEqual({ generation: 139, reasons: ['target-reached'] });
  });

  test('over seeds 1 to 100 and 200 generations both hills are occupied in 90 runs against 34 without crowding, and 48 runs get within ε against 17', () => {
    expect(batch(crowding.params, 40, 200)).toEqual({ found: 48, both: 90 });
    expect(batch(withoutNiching(crowding.params), 40, 200)).toEqual({ found: 17, both: 34 });
  }, 120_000);

  test('with a population of 12 both hills are kept in 48 runs and with 60 in 99', () => {
    expect(batch(crowding.params, 12, 200).both).toBe(48);
    expect(batch(crowding.params, 60, 200).both).toBe(99);
  }, 120_000);

  test('the text says exactly these numbers', () => {
    mentions(text, ['Population 40 and seed 23', 'all 40 individuals', 'generation 20', '36 individuals near the broad hill and 4 near the narrow one', '35 and 5 in generation 100', 'best 0.95', 'generation 139', 'seeds 1 to 100 and 200 generations', '90 runs against 34', 'only 48 runs', '(17 without it)', 'a population of 12 both hills are kept in 48 runs', 'with 60 in 99']);
  });
});

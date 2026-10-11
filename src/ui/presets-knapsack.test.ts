import { describe, expect, test } from 'vitest';
import { bagWeight, builtInKnapsack, gaAlgorithm, metricsOf, optimalBag, itemName, type GaEvent, type GaParams, type GaSetup, type KnapsackOptions, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { presets, type Preset } from './presets';
import { entryOf } from './problems';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const bag = (suffix: string): Preset => presets.find((p) => p.problem === 'knapsack' && p.id.endsWith(suffix))!;
const play = (preset: Preset, generations = 100, override: Partial<KnapsackOptions> = {}, seed = preset.seed): GaRun => {
  const options = { ...(preset.options as KnapsackOptions), ...override };
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem: entryOf('knapsack')!.create(options), init: preset.setup.init }, params: preset.params, seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};
const feasibleBest = (run: GaRun, g: number) => metricsOf(run.snapshot(g).state).feasible!.bestSoFar;
const firstOptimum = (run: GaRun): number | null => {
  for (let g = 0; g <= run.lastCycle; g++) if ((feasibleBest(run, g) ?? 0) >= 123) return g;
  return null;
};
const weightOf = (genes: readonly number[]) => bagWeight(builtInKnapsack, genes.map((g) => g === 1));
const overweight = (run: GaRun, g: number) => run.snapshot(g).state.population.filter((i) => weightOf(i.chromosome) > 48).length;

describe('the knapsack preset files', () => {
  test('there are five, in the order of their file names, for the knapsack only, each with a one-sentence lesson', () => {
    expect(presets.filter((p) => p.problem === 'knapsack').map((p) => p.name)).toEqual(['Evolve a bag', 'Penalty too small', 'Penalty too large', 'Repair: Lamarckian', 'Repair: Baldwinian']);
    for (const p of presets.filter((x) => x.problem === 'knapsack')) {
      expect(p.lesson.endsWith('.')).toBe(true);
      expect(p.lesson.slice(0, -1)).not.toMatch(/[.!?]\s/);
      expect(p.lookFor.length).toBeGreaterThan(80);
      expect(p.options).toBeDefined();
    }
  });

  test('every preset uses the built-in instance, a population of 8 and the measured operators; only the method, ρ and the seed differ', () => {
    const defaults = entryOf('knapsack')!.defaults;
    for (const p of presets.filter((x) => x.problem === 'knapsack')) {
      const o = p.options as KnapsackOptions;
      expect(o.items).toEqual(builtInKnapsack.items);
      expect(o.capacity).toBe(48);
      expect(p.params).toEqual(defaults.params);
      expect(p.setup.init).toEqual({ kind: 'random', size: 8 });
    }
    expect((bag('bag-evolve').options as KnapsackOptions)).toMatchObject({ handling: 'decoder', rho: 8 });
    expect(bag('bag-evolve').seed).toBe(defaults.seed);
    expect((bag('too-small').options as KnapsackOptions)).toMatchObject({ handling: 'penalty', rho: 1 });
    expect((bag('too-large').options as KnapsackOptions)).toMatchObject({ handling: 'penalty', rho: 50 });
  });
});

describe('Evolve a bag', () => {
  const preset = bag('bag-evolve');
  const run = play(preset);

  test('finds the optimum bag B, C, D, F, G, H, K worth 123 for the first time in generation 26, after a longest stretch of 13 generations without improvement', () => {
    expect(firstOptimum(run)).toBe(26);
    expect(itemsOf(optimalBag(builtInKnapsack).bag)).toBe('BCDFGHK');
    let last = 0;
    let longest = 0;
    let best = -Infinity;
    for (let g = 0; g <= 26; g++) {
      const now = feasibleBest(run, g) ?? -Infinity;
      if (now > best) (best = now), (last = g);
      longest = Math.max(longest, g - last);
    }
    expect(longest).toBe(13);
    expect(run.snapshot(26).state.population.some((i) => i.decoded === 'BCDFGHK')).toBe(true);
  });

  test('never changes a chromosome (the decoder), and nothing pauses a run on the way: no stop criterion holds before generation 26', () => {
    for (let g = 1; g <= 26; g++) expect(run.events(g).some((e) => e.stage === 'evaluation' && e.repairedFrom)).toBe(false);
    for (let g = 0; g < 26; g++) expect(run.snapshot(g).stops).toEqual([]);
    expect(run.snapshot(26).stops).toContain('target-reached');
  });

  test('191 of 200 seeds find the optimum within 100 generations', () => {
    let found = 0;
    for (let seed = 1; seed <= 200; seed++) if (firstOptimum(play(preset, 100, {}, seed)) !== null) found++;
    expect(found).toBe(191);
  }, 60000);
});

describe('Penalty too small', () => {
  const preset = bag('too-small');
  const run = play(preset);

  test('the best fitness climbs to 135, above the optimum 123, and the best bag that fits never reaches 123 (it ends at 122)', () => {
    expect(Math.max(...Array.from({ length: 101 }, (_, g) => metricsOf(run.snapshot(g).state).best))).toBe(135);
    expect(firstOptimum(run)).toBeNull();
    expect(feasibleBest(run, 100)).toBe(122);
  });

  test('every bag in the population is overweight from generation 92 on, and not in generation 91', () => {
    expect(overweight(run, 91)).toBeLessThan(8);
    for (let g = 92; g <= 100; g++) expect(overweight(run, g)).toBe(8);
  });

  test('the best bag in the last generation is overweight, and the run never reports the target as reached', () => {
    const top = run.snapshot(100).state.population.reduce((a, b) => (b.fitness > a.fitness ? b : a));
    expect([weightOf(top.chromosome), top.objective, top.fitness]).toEqual([67, 154, 135]);
    for (let g = 0; g <= 100; g++) expect(run.snapshot(g).stops).not.toContain('target-reached');
  });

  test('the plot shows it: the plot model has the feasible line, and the best line passes the optimum while the feasible one stays below', () => {
    expect(run.setup.problem.mayBeInfeasible).toBe(true);
    expect(Math.max(...Array.from({ length: 101 }, (_, g) => feasibleBest(run, g) ?? 0))).toBeLessThan(123);
  });
});

describe('Penalty too large', () => {
  const preset = bag('too-large');
  const run = play(preset);

  test('the best bag that fits after 100 generations is worth 116, 6 of the 8 bags in the final population fit, and the optimum is not found', () => {
    expect(feasibleBest(run, 100)).toBe(116);
    expect(metricsOf(run.snapshot(100).state).feasible!.count).toBe(6);
    expect(firstOptimum(run)).toBeNull();
  });

  test('the same seed finds 123 in generation 33 with ρ = 8 and in generation 13 with ρ = 3', () => {
    expect(firstOptimum(play(preset, 100, { rho: 8 }))).toBe(33);
    expect(firstOptimum(play(preset, 100, { rho: 3 }))).toBe(13);
  });

  test('over seeds 1 to 100, 58 runs find 123 with ρ = 50 and 86 with ρ = 3, and every run with ρ = 50 ends with a bag that fits worth at least 112', () => {
    let large = 0;
    let moderate = 0;
    let poorest = Infinity;
    for (let seed = 1; seed <= 100; seed++) {
      const big = play(preset, 100, {}, seed);
      if (firstOptimum(big) !== null) large++;
      poorest = Math.min(poorest, feasibleBest(big, 100) ?? 0);
      if (firstOptimum(play(preset, 100, { rho: 3 }, seed)) !== null) moderate++;
    }
    expect([large, moderate]).toEqual([58, 86]);
    expect(poorest).toBeGreaterThanOrEqual(112);
  }, 60000);
});

describe('the two repairs, with the same seed and settings', () => {
  const lamarck = bag('repair-lamarckian');
  const baldwin = bag('repair-baldwinian');
  const l = play(lamarck);
  const b = play(baldwin);

  test('share instance, seed, ρ and parameters, and differ only in the method', () => {
    expect(lamarck.seed).toBe(19);
    expect(baldwin.seed).toBe(19);
    expect({ ...(lamarck.options as object), handling: 0 }).toEqual({ ...(baldwin.options as object), handling: 0 });
    expect(lamarck.params).toEqual(baldwin.params);
    expect((lamarck.options as KnapsackOptions).handling).toBe('repair-lamarckian');
    expect((baldwin.options as KnapsackOptions).handling).toBe('repair-baldwinian');
  });

  test('Lamarckian finds the optimum in generation 25 and Baldwinian in generation 5', () => {
    expect(firstOptimum(l)).toBe(25);
    expect(firstOptimum(b)).toBe(5);
  });

  test('in generation 10 none of the 8 Lamarckian chromosomes has more genes set than fit, and all 8 Baldwinian ones have', () => {
    expect(overweight(l, 10)).toBe(0);
    expect(overweight(b, 10)).toBe(8);
    for (let g = 0; g <= 100; g++) expect(overweight(l, g)).toBe(0);
  });

  test('the Lamarckian run really rewrote chromosomes (✂ marks) and the Baldwinian run never did', () => {
    const repairs = (run: GaRun) => Array.from({ length: 11 }, (_, g) => run.events(g).filter((e) => (e.stage === 'evaluation' || e.stage === 'setup') && e.repairedFrom).length).reduce((x, y) => x + y, 0);
    expect(repairs(l)).toBeGreaterThan(0);
    expect(repairs(b)).toBe(0);
  });

  test('over seeds 1 to 100, Lamarckian repair finds 123 within 100 generations in 96 runs (median generation 15), Baldwinian in all 100 (median 11)', () => {
    const stats = (preset: Preset) => {
      const reached: number[] = [];
      for (let seed = 1; seed <= 100; seed++) {
        const g = firstOptimum(play(preset, 100, {}, seed));
        if (g !== null) reached.push(g);
      }
      return [reached.length, [...reached].sort((x, y) => x - y)[Math.floor(reached.length / 2)]];
    };
    expect(stats(lamarck)).toEqual([96, 15]);
    expect(stats(baldwin)).toEqual([100, 11]);
  }, 60000);
});

function itemsOf(b: readonly boolean[]) {
  return b.flatMap((x, i) => (x ? [itemName(i)] : [])).join('');
}

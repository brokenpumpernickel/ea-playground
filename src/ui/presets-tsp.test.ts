import { describe, expect, test } from 'vitest';
import { canonicalRoute, gaAlgorithm, tspDefaults, tspInstance, type CrossoverEvent, type GaEvent, type GaParams, type GaSetup, type MutationEvent, type RunState, type TspOptions } from '../engine';
import { createRun, type Run } from '../run';
import { draftOf, validate } from './drawer-model';
import { presets, type Preset } from './presets';
import { entryOf } from './problems';
import { compare, median, optionsOf, pct, seeds, trace, tspPreset } from './presets-tsp-support';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const play = (preset: Preset, generations: number): GaRun => {
  const run: GaRun = createRun(gaAlgorithm, { setup: preset.setup, params: preset.params, seed: preset.seed }, { eventCacheSize: 0 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
const defaults = tspDefaults(berlin).params;

describe('the TSP preset files', () => {
  const mine = presets.filter((p) => p.problem === 'tsp');

  test('there are nine, in the order of their file names, each with a name, a one-sentence lesson and a longer text on what to look for', () => {
    expect(mine.map((p) => p.name)).toEqual([
      'berlin52: against the nearest neighbour and the optimum',
      'Partial-mapped crossover instead of order crossover',
      'Cycle crossover instead of order crossover',
      'Swap mutation instead of inversion',
      'No crossover: mutation alone',
      'No elitism: the best tour is lost',
      'No mutation: stuck at the first good tour',
      'The circle and the crossing tours',
      'Swap stalls on Two clusters',
    ]);
    expect(mine.map((p) => p.id)).toEqual(['t-tsp-berlin52', 'u-tsp-berlin52-pmx', 'v-tsp-berlin52-cx', 'w-tsp-berlin52-swap', 'x-tsp-berlin52-no-crossover', 'y-tsp-berlin52-no-elitism', 'z-tsp-berlin52-no-mutation', 'za-tsp-circle', 'zb-tsp-clusters-swap']);
    for (const p of mine) {
      expect(p.lesson.endsWith('.')).toBe(true);
      expect(p.lookFor.length).toBeGreaterThan(100);
    }
  });

  test('each is a valid configuration that the drawer accepts and the engine runs, and the other problems’ lists are theirs alone', () => {
    for (const p of mine) {
      const draft = draftOf(p.params, p.setup, p.seed, p.options);
      const sample = play(p, 0).snapshot(0).state.population.map((i) => i.fitness);
      expect(validate(draft, p.setup.problem, sample, entryOf('tsp')).errors, p.name).toEqual({});
      expect(() => play(p, 3), p.name).not.toThrow();
    }
    expect(presets.filter((p) => p.problem !== 'tsp').every((p) => !p.id.includes('-tsp-'))).toBe(true);
    expect(presets.filter((p) => p.problem === 'tsp')).toHaveLength(9);
  });

  test('the seven on berlin52 share the instance, the seed 15 and the starting population, and differ from the defaults only in what their name says', () => {
    const family = mine.slice(0, 7);
    for (const p of family) {
      expect(optionsOf(p)).toEqual(berlin);
      expect(p.seed).toBe(15);
      expect(p.setup.init).toEqual({ kind: 'random', size: 20 });
      expect(p.params.selection).toEqual(defaults.selection);
      expect(p.params.stop.generationLimit).toBe(500);
      expect(p.params.stop.targetEpsilon).toBe(0.5);
    }
    const changed = (name: string, edit: (d: GaParams) => GaParams) => expect(tspPreset(name).params, name).toEqual(edit(defaults));
    changed('t-tsp-berlin52', (d) => d);
    changed('pmx', (d) => ({ ...d, crossover: { ...d.crossover, operator: 'pmx' } }));
    changed('-cx', (d) => ({ ...d, crossover: { ...d.crossover, operator: 'cx' } }));
    changed('swap', (d) => ({ ...d, mutation: { ...d.mutation, operator: 'swap' } }));
    changed('no-crossover', (d) => ({ ...d, crossover: { ...d.crossover, enabled: false } }));
    changed('no-elitism', (d) => ({ ...d, elites: 0 }));
    changed('no-mutation', (d) => ({ ...d, mutation: { ...d.mutation, enabled: false }, stop: { ...d.stop, stagnationWindow: 50 } }));
    // the starting population of all seven is the same one
    const first = (p: Preset) => play(p, 0).snapshot(0).state.population.map((i) => i.chromosome.join(' '));
    for (const p of family) expect(first(p)).toEqual(first(family[0]!));
  });
});

describe('the texts say exactly what these tests assert', () => {
  // each number a text quotes is one a test below (or in the statistics files) checks; this keeps the text and the checks together
  const quoted: [string, string[]][] = [
    ['t-tsp-berlin52', ['generation 500', '8,794', '16.6 %', '2.1 %', 'generation 423', '37.6 %', '25.8 %', '15.0 %', '22 of the 30', '8,980', '19.1 %', '7,542']],
    ['pmx', ['8,785', '16.5 %', '8,794', '16.6 %', '44.7 %', '37.6 %', '17 runs', '13', '15 and 15']],
    ['-cx', ['77.9 %', '37.6 %', '24.5 %', '16.6 %', 'all 30', 'in 29']],
    ['swap', ['up to four edges', 'at most two', '74.7 %', '37.6 %', '44.6 %', '16.6 %', '29 runs', 'all 30']],
    ['no-crossover', ['50.4 %', '37.6 %', '19.4 %', '16.6 %', '9,005', '25 runs', '20']],
    ['no-elitism', ['183 of the 500', '87.9 %', '14,168', '16.6 %', '70.5 %', 'all 30']],
    ['no-mutation', ['generation 49', '154.2 %', '19,173', 'window is 50', 'generation 99', '168.6 %', '15.0 %', 'all 30']],
    ['za-tsp-circle', ['all 20', '12 and 42', '12 crossings', '8 at generation 10', '4 at 20', '2 at 30', '1 at 40', 'generation 46', '1 2 3 … 15', 'generation 28', 'generation 84']],
    ['zb-tsp-clusters-swap', ['0.25 %', 'generation 26', '100 generations', 'generation 126', 'window is 100', '16 runs', '14 stop', '1.02 %', '28 of the 30']],
  ];
  test.each(quoted)('%s', (suffix, fragments) => {
    const text = tspPreset(suffix).lookFor + ' ' + tspPreset(suffix).lesson;
    for (const f of fragments) expect(text, f).toContain(f);
  });
});

describe('the run of a preset is the engine’s: the quick loop of these tests and the app’s run agree', () => {
  test('the best so far of the first preset at generations 100 and 200, and the generation the stop comes at, are the same in both', () => {
    const p = tspPreset('t-tsp-berlin52');
    const run = play(p, 200);
    const t = trace(p, 200);
    for (const g of [0, 1, 100, 200]) expect(run.snapshot(g).state.bestFitnessSoFar, `generation ${g}`).toBe(t.sofar[g]);
    const z = tspPreset('no-mutation');
    const runZ = createRun(gaAlgorithm, { setup: z.setup, params: z.params, seed: z.seed }, { eventCacheSize: 0 });
    runZ.runUntil((s) => s.stops.length > 0 || s.cycle >= 500);
    expect(runZ.lastCycle).toBe(trace(z, 500).stop!.generation);
  });
});

describe('berlin52: against the nearest neighbour and the optimum', { timeout: 60_000 }, () => {
  const p = tspPreset('t-tsp-berlin52');
  const t = trace(p, 500);
  const instance = tspInstance(berlin);

  test('the nearest-neighbour tour is 8,980, 19.1 % over the optimum 7,542', () => {
    expect(instance.optimum).toBe(7542);
    expect(instance.nearestNeighbour.length).toBe(8980);
    expect(pct((8980 - 7542) / 7542)).toBe(19.1);
  });

  test('with this seed the run ends at 8,794 after 500 generations, the limit, 16.6 % over the optimum and 2.1 % under the nearest-neighbour tour', () => {
    expect(t.stop).toEqual({ generation: 500, reasons: ['generation-limit'] });
    expect(0 - t.sofar[500]!).toBe(8794);
    expect(pct(t.gap(500))).toBe(16.6);
    expect(pct((8980 - 8794) / 8980)).toBe(2.1);
    expect(t.firstOptimum).toBeNull();
  });

  test('it first gets under the nearest-neighbour tour at generation 423, and was 37.6 % over at generation 200 and 25.8 % at 300', () => {
    const first = t.sofar.findIndex((f) => 0 - f < 8980);
    expect(first).toBe(423);
    expect(0 - t.sofar[422]!).toBeGreaterThanOrEqual(8980);
    expect(pct(t.gap(200))).toBe(37.6);
    expect(pct(t.gap(300))).toBe(25.8);
  });
});

describe('the other comparisons, on the same seed', { timeout: 60_000 }, () => {
  const ox = trace(tspPreset('t-tsp-berlin52'), 500);

  test('partial-mapped crossover: 8,785, 16.5 % over after 500 generations (order crossover 8,794, 16.6 %), 44.7 % at generation 200 against 37.6 %', () => {
    const t = trace(tspPreset('pmx'), 500);
    expect(0 - t.sofar[500]!).toBe(8785);
    expect(pct(t.gap(500))).toBe(16.5);
    expect(pct(t.gap(200))).toBe(44.7);
    expect(pct(ox.gap(200))).toBe(37.6);
  });

  test('cycle crossover: 77.9 % over at generation 200 and 24.5 % at 500, and never under the nearest-neighbour tour', () => {
    const t = trace(tspPreset('-cx'), 500);
    expect(pct(t.gap(200))).toBe(77.9);
    expect(pct(t.gap(500))).toBe(24.5);
    expect(Math.min(...t.sofar.map((f) => 0 - f))).toBeGreaterThan(8980);
  });

  test('swap: 74.7 % over at generation 200 and 44.6 % at 500; a swap changes up to four edges, an inversion at most two', () => {
    const swap = tspPreset('swap');
    const t = trace(swap, 500);
    expect(pct(t.gap(200))).toBe(74.7);
    expect(pct(t.gap(500))).toBe(44.6);
    const removed = (preset: Preset) => {
      const run = play(preset, 30);
      const counts: number[] = [];
      for (let g = 1; g <= 30; g++) for (const e of run.events(g)) if (e.stage === 'mutation' && e.decision === 'mutated') counts.push((e as MutationEvent).edges!.removed.length);
      return counts;
    };
    const swaps = removed(swap);
    expect(Math.max(...swaps)).toBe(4);
    expect(swaps.some((c) => c > 2)).toBe(true);
    const inversions = removed(tspPreset('t-tsp-berlin52'));
    expect(inversions.length).toBeGreaterThan(50);
    expect(Math.max(...inversions)).toBeLessThanOrEqual(2);
  });

  test('no crossover: the offspring are copies of their parents before they mutate; 50.4 % over at generation 200, 19.4 % at 500, at 9,005, just above the nearest-neighbour tour', () => {
    const p = tspPreset('no-crossover');
    const t = trace(p, 500);
    expect(pct(t.gap(200))).toBe(50.4);
    expect(pct(t.gap(500))).toBe(19.4);
    expect(0 - t.sofar[500]!).toBe(9005);
    expect(9005).toBeGreaterThan(8980);
    const run = play(p, 3);
    for (let g = 1; g <= 3; g++) for (const e of run.events(g)) if (e.stage === 'crossover') expect((e as CrossoverEvent).decision).toBe('bypassed');
  });

  test('no elitism: the best of the generation is worse than the one before in 183 of the 500 generations (never with elites), and the run ends 87.9 % over, at 14,168', () => {
    const p = tspPreset('no-elitism');
    const t = trace(p, 500);
    const worse = (x: typeof t) => x.best.reduce((n, b, g) => (g > 0 && b < x.best[g - 1]! ? n + 1 : n), 0);
    expect(worse(t)).toBe(183);
    expect(worse(ox)).toBe(0);
    expect(pct(t.gap(500))).toBe(87.9);
    expect(0 - t.sofar[500]!).toBe(14168);
  });

  test('no mutation: nothing improves after generation 49, the best tour stays 154.2 % over at 19,173, and with the stagnation window of 50 Run until stop pauses at generation 99', () => {
    const p = tspPreset('no-mutation');
    expect(p.params.stop.stagnationWindow).toBe(50);
    const t = trace(p, 500);
    expect(t.lastImprovement).toBe(49);
    expect(pct(t.gap(500))).toBe(154.2);
    expect(0 - t.sofar[500]!).toBe(19173);
    expect(t.stop).toEqual({ generation: 99, reasons: ['stagnation'] });
  });
});

/** How many pairs of the edges of a closed tour cross, for cities at the given places. */
const crossings = (tour: readonly number[], places: readonly (readonly [number, number])[]): number => {
  const n = tour.length;
  const side = (p: readonly [number, number], q: readonly [number, number], r: readonly [number, number]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = places[tour[i]!]!;
      const b = places[tour[(i + 1) % n]!]!;
      const c = places[tour[j]!]!;
      const d = places[tour[(j + 1) % n]!]!;
      if (side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b)) count++;
    }
  }
  return count;
};

describe('The circle and the crossing tours', () => {
  const p = tspPreset('za-tsp-circle');
  const places = tspInstance(optionsOf(p)).coordinates;
  const run = play(p, 46);
  const bestAt = (g: number) => run.snapshot(g).state.population.reduce((b, i) => (i.fitness > b.fitness ? i : b));

  test('the cities are fifteen, evenly spaced on a circle', () => {
    expect(optionsOf(p)).toEqual({ instance: 'circle', n: 15, seed: 1 });
    const radii = places.map((c) => Math.hypot(c[0] - places[0]![0] + 0, c[1] - places[0]![1]));
    expect(places).toHaveLength(15);
    const centre = [places.reduce((s, c) => s + c[0], 0) / 15, places.reduce((s, c) => s + c[1], 0) / 15] as const;
    const r = places.map((c) => Math.hypot(c[0] - centre[0], c[1] - centre[1]));
    expect(Math.max(...r) - Math.min(...r)).toBeLessThan(1e-9);
    expect(radii.length).toBe(15);
  });

  test('all 20 tours of the starting population cross themselves, between 12 and 42 times', () => {
    const counts = run.snapshot(0).state.population.map((i) => crossings(i.chromosome, places));
    expect(counts).toHaveLength(20);
    expect(Math.min(...counts)).toBe(12);
    expect(Math.max(...counts)).toBe(42);
  });

  test('the best tour of the generation has 12 crossings at generation 0, 8 at 10, 4 at 20, 2 at 30 and 1 at 40', () => {
    expect([0, 10, 20, 30, 40].map((g) => crossings(bestAt(g).chromosome, places))).toEqual([12, 8, 4, 2, 1]);
  });

  test('at generation 46 Run until stop pauses within ε of the optimum: the tour is 1 2 3 … 15 and has no crossing', () => {
    expect(run.snapshot(46).stops).toEqual(['target-reached']);
    expect(run.snapshot(45).stops).toEqual([]);
    const best = bestAt(46);
    expect(canonicalRoute(best.chromosome).map((c) => c + 1)).toEqual(Array.from({ length: 15 }, (_, k) => k + 1));
    expect(crossings(best.chromosome, places)).toBe(0);
  });

  test('over seeds 1 to 30 all 30 runs reach the optimum, between generation 28 and generation 84', { timeout: 120_000 }, () => {
    const first = seeds().map((seed) => trace(p, 300, { seed }).firstOptimum);
    expect(first.every((g) => g !== null)).toBe(true);
    expect(Math.min(...(first as number[]))).toBe(28);
    expect(Math.max(...(first as number[]))).toBe(84);
  });
});

describe('Swap stalls on Two clusters', () => {
  const p = tspPreset('zb-tsp-clusters-swap');

  test('with this seed the best tour, 0.25 % over the optimum, is found at generation 26, and Run until stop pauses at generation 126 by stagnation (window 100)', () => {
    expect(p.params.stop.stagnationWindow).toBe(100);
    expect(p.params.mutation.operator).toBe('swap');
    const t = trace(p, 500);
    expect(pct(t.gap(500), 2)).toBe(0.25);
    expect(t.lastImprovement).toBe(26);
    expect(t.stop).toEqual({ generation: 126, reasons: ['stagnation'] });
  });

  test('over seeds 1 to 30, 16 runs reach the optimum and 14 stop above it, between 0.25 % and 1.02 % over; with inversion 28 of the 30 reach it', { timeout: 120_000 }, () => {
    const swap = seeds().map((seed) => trace(p, 500, { seed }));
    const reached = swap.filter((t) => t.firstOptimum !== null);
    const stalled = swap.filter((t) => t.firstOptimum === null);
    expect(reached).toHaveLength(16);
    expect(stalled).toHaveLength(14);
    for (const t of stalled) expect(t.stop?.reasons).toEqual(['stagnation']);
    const gaps = stalled.map((t) => pct(t.gap(500), 2));
    expect(Math.min(...gaps)).toBe(0.25);
    expect(Math.max(...gaps)).toBe(1.02);
    const inversion = seeds().map((seed) => trace(p, 500, { seed, mutation: { operator: 'inversion' } }));
    expect(inversion.filter((t) => t.firstOptimum !== null)).toHaveLength(28);
    expect(median(swap.map((t) => t.gap(500)))).toBeGreaterThanOrEqual(0);
    void compare;
  });
});

import { describe, expect, test } from 'vitest';
import { createRng, gaAlgorithm, handlings, metricsOf, minimumGenes, type GaParams, type Initialization, type KnapsackOptions, type StepSpec } from '../engine';
import { createRun } from '../run';
import { entryOf } from './problems';
import { configOf, decodeConfig, encodeConfig, setupOf, type RunConfig } from './run-config';

const entry = entryOf('knapsack')!;
const baseOptions = entry.defaultOptions() as KnapsackOptions;
const make = (options: KnapsackOptions, init = entry.defaults.init, params: GaParams = entry.defaults.params, seed = 9): RunConfig =>
  configOf({ problem: entry.create(options), init }, params, seed, 'knapsack', options);
const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const edited = (change: (c: Record<string, any>) => void) => {
  const copy = JSON.parse(JSON.stringify(make(baseOptions))) as Record<string, any>;
  change(copy);
  return `#v1.${b64(JSON.stringify(copy))}`;
};
const problemsOf = (hash: string): string[] => {
  const r = decodeConfig(hash);
  expect(r.ok).toBe(false);
  return r.ok ? [] : [...r.problems];
};
const trace = (config: RunConfig, generations = 5) => {
  const run = createRun(gaAlgorithm, { setup: setupOf(config), params: config.params, seed: config.seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { populations: Array.from({ length: generations + 1 }, (_, g) => run.snapshot(g).state.population), events: run.events(generations), metrics: metricsOf(run.snapshot(generations).state) };
};

describe('a knapsack configuration in a link', () => {
  test.each(handlings)('%s: round trips and opens as the same run (populations, events, metrics)', (handling) => {
    const config = make({ ...baseOptions, handling, rho: 2.5 });
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) expect(trace(decoded.config)).toEqual(trace(config));
  });

  test('a hand-edited population of 0s and 1s and another instance survive the link', () => {
    const options: KnapsackOptions = { items: [{ weight: 5, value: 9 }, { weight: 7, value: 4 }, { weight: 2, value: 8 }], capacity: 9, handling: 'repair-lamarckian', rho: 1 };
    const config = make(options, { kind: 'explicit', chromosomes: ['111', '010', '101'] }, { ...entry.defaults.params, crossover: { enabled: true, operator: 'two-point', probability: 0.5 }, stop: { generationLimit: 20 } });
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) {
      expect(setupOf(decoded.config).problem.chromosomeLength).toBe(3);
      expect(trace(decoded.config, 3)).toEqual(trace(config, 3));
    }
  });

  test('the link carries the problem and its options as readable text', () => {
    const payload = encodeConfig(make(baseOptions)).slice(4).replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload + '='.repeat((4 - (payload.length % 4)) % 4));
    expect(json).toContain('"problem":"knapsack"');
    expect(json).toContain('"handling":"decoder"');
    expect(json).toContain('"capacity":48');
  });
});

describe('bad knapsack links: each is refused in the drawer’s own words, and nothing is used', () => {
  test('an item with a bad weight or value, too few or too many items, a capacity out of range', () => {
    expect(problemsOf(edited((c) => (c.options.items[5].weight = 0)))).toEqual(['Item F: the weight must be a whole number from 1 to 99 (it is 0).']);
    expect(problemsOf(edited((c) => (c.options.items[1].value = 1000)))).toEqual(['Item B: the value must be a whole number from 1 to 999 (it is 1000).']);
    expect(problemsOf(edited((c) => (c.options.items = [c.options.items[0]])))[0]).toBe('A knapsack needs at least 2 items (there is 1).');
    expect(problemsOf(edited((c) => (c.options.items = Array.from({ length: 21 }, () => ({ weight: 1, value: 1 })))))[0]).toBe('A knapsack can have at most 20 items (there are 21).');
    expect(problemsOf(edited((c) => (c.options.capacity = 98)))[0]).toContain('The capacity can be at most the total weight, 97 (it is 98)');
    expect(problemsOf(edited((c) => (c.options.capacity = 0)))).toEqual(['The capacity must be a whole number of at least 1 (it is 0).']);
  });

  test('an unknown handling method, a bad rho, and options of the wrong shape', () => {
    expect(problemsOf(edited((c) => (c.options.handling = 'greedy')))).toEqual(['The constraint handling must be one of decoder, penalty, repair-lamarckian, repair-baldwinian.']);
    expect(problemsOf(edited((c) => (c.options.rho = 1001)))).toEqual(['The penalty ρ must be a number from 0 to 1000 (it is 1001).']);
    expect(problemsOf(edited((c) => (c.options.rho = '4')))).toEqual(['"options.rho" must be a number.']);
    expect(problemsOf(edited((c) => delete c.options.rho))).toEqual(['"options" is missing "rho".']);
    expect(problemsOf(edited((c) => delete c.options))).toEqual(['"configuration" is missing "options", which Knapsack needs.']);
  });

  test('a hand-edited population of the wrong length or with a symbol other than 0 and 1 is named', () => {
    expect(problemsOf(edited((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['0101'] })))).toEqual(['Chromosome 1 has 4 genes, but this problem needs 12.']);
    expect(problemsOf(edited((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['01010101012x'] })))[0]).toContain('may only contain the characters');
  });

  test('a crossover that does not fit the number of items, and several problems together', () => {
    const two = { weight: 1, value: 1 };
    expect(
      problemsOf(
        edited((c) => {
          c.options.items = [two, two];
          c.options.capacity = 1;
          c.params.crossover.operator = 'two-point';
        }),
      )[0],
    ).toContain('Two-point crossover needs chromosomes of at least 3 genes, but this problem');
    expect(problemsOf(edited((c) => ((c.options.capacity = 0), (c.options.rho = -1), (c.options.items[0].weight = 0))))).toHaveLength(3);
  });
});

describe('200 generated knapsack configurations', () => {
  test('item sets of 2 to 20 items, capacities, every method, ρ, selection, operators, truncation, stop settings, random and hand-edited populations: round trip, and every tenth opens as the same run', () => {
    const rng = createRng(2026);
    const int = (lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo + 1));
    const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)]!;
    const chains: StepSpec[][] = [[{ step: 'shift', epsilon: 0.5 }], [{ step: 'rank' }], [{ step: 'shift' }, { step: 'power', exponent: 2 }]];
    for (let k = 0; k < 200; k++) {
      const n = int(2, 20);
      const items = Array.from({ length: n }, () => ({ weight: int(1, 99), value: int(1, 999) }));
      const total = items.reduce((t, i) => t + i.weight, 0);
      const lightest = Math.min(...items.map((i) => i.weight));
      const options: KnapsackOptions = { items, capacity: int(lightest, total), handling: pick(handlings), rho: pick([0, 1, 2.5, 8, 50, 1000, int(0, 1000) / 4]) };
      const size = int(1, 12);
      const init: Initialization =
        rng.next() < 0.5 ? { kind: 'random', size } : { kind: 'explicit', chromosomes: Array.from({ length: size }, () => Array.from({ length: n }, () => (rng.next() < 0.5 ? '1' : '0')).join('')) };
      const elites = int(0, size);
      const params: GaParams = {
        selection: rng.next() < 0.5 ? { method: 'tournament', size: int(1, 5) } : { method: 'roulette', chain: pick(chains) },
        crossover: { enabled: rng.next() < 0.8, operator: pick((['one-point', 'two-point', 'uniform'] as const).filter((o) => minimumGenes[o] <= n)), probability: int(0, 100) / 100 },
        mutation: { enabled: rng.next() < 0.8, mode: pick(['per-gene', 'per-individual'] as const), probability: int(0, 100) / 100 },
        elites,
        ...(rng.next() < 0.4 ? { truncation: { enabled: true, lambda: Math.max(1, size - elites + int(0, 4)) } } : {}),
        stop: { generationLimit: int(1, 200), ...(rng.next() < 0.5 ? { targetFitness: int(0, 3000) } : {}), ...(rng.next() < 0.5 ? { stagnationWindow: int(1, 30) } : {}) },
      };
      const config = make(options, init, params, int(0, 4294967295));
      const decoded = decodeConfig(encodeConfig(config));
      expect(decoded.ok ? [] : decoded.problems).toEqual([]);
      if (!decoded.ok) continue;
      expect(decoded.config).toEqual(config);
      if (k % 10 === 0) expect(trace(decoded.config, 3)).toEqual(trace(config, 3));
    }
  }, 60000);
});

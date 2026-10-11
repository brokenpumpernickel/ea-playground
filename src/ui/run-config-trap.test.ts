import { describe, expect, test } from 'vitest';
import { createRng, gaAlgorithm, linkages, metricsOf, minimumGenes, trapLimits, type GaParams, type Initialization, type StepSpec, type TrapOptions } from '../engine';
import { createRun } from '../run';
import { entryOf } from './problems';
import { configOf, decodeConfig, encodeConfig, setupOf, type RunConfig } from './run-config';

const entry = entryOf('trap')!;
const baseOptions = entry.defaultOptions() as TrapOptions;
const make = (options: TrapOptions, init = entry.defaults.init, params: GaParams = entry.defaults.params, seed = 9): RunConfig =>
  configOf({ problem: entry.create(options), init }, params, seed, 'trap', options);
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

describe('a trap configuration in a link', () => {
  test.each(linkages)('%s: round trips and opens as the same run (populations, events, metrics)', (linkage) => {
    const config = make({ ...baseOptions, linkage, blockSize: 3, blocks: 6 });
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) expect(trace(decoded.config)).toEqual(trace(config));
  });

  test('a hand-edited population of 0s and 1s and another size survive the link', () => {
    const options: TrapOptions = { blockSize: 3, blocks: 2, linkage: 'loose' };
    const config = make(options, { kind: 'explicit', chromosomes: ['111111', '010101', '000000', '110011'] }, { ...entry.defaults.params, crossover: { enabled: true, operator: 'two-point', probability: 0.5 }, stop: { generationLimit: 20 } });
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) {
      expect(setupOf(decoded.config).problem.chromosomeLength).toBe(6);
      expect(trace(decoded.config, 3)).toEqual(trace(config, 3));
    }
  });

  test('the link carries the problem and its options as readable text', () => {
    const payload = encodeConfig(make({ ...baseOptions, linkage: 'loose' })).slice(4).replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload + '='.repeat((4 - (payload.length % 4)) % 4));
    expect(json).toContain('"problem":"trap"');
    expect(json).toContain('"linkage":"loose"');
    expect(json).toContain('"blockSize":4');
    expect(json).toContain('"blocks":5');
  });
});

describe('bad trap links: each is refused in the drawer’s own words, and nothing is used', () => {
  test('a block size or number of blocks out of range, too many genes, an unknown linkage', () => {
    expect(problemsOf(edited((c) => (c.options.blockSize = 1)))).toEqual(['Block size must be a whole number from 2 to 8 (it is 1).']);
    expect(problemsOf(edited((c) => (c.options.blockSize = 9)))[0]).toBe('Block size must be a whole number from 2 to 8 (it is 9).');
    expect(problemsOf(edited((c) => (c.options.blocks = 0)))).toEqual(['The number of blocks must be a whole number from 1 to 10 (it is 0).']);
    expect(problemsOf(edited((c) => (c.options.blocks = 11)))[0]).toBe('The number of blocks must be a whole number from 1 to 10 (it is 11).');
    expect(problemsOf(edited((c) => ((c.options.blockSize = 8), (c.options.blocks = 6))))).toEqual(['Block size × blocks: at most 30 genes in all (8 × 6 = 48).']);
    expect(problemsOf(edited((c) => (c.options.linkage = 'random')))).toEqual(['Linkage must be one of tight, loose.']);
    expect(problemsOf(edited((c) => (c.options.blockSize = 3.5)))).toEqual(['Block size must be a whole number from 2 to 8 (it is 3.5).']);
  });

  test('options of the wrong shape, or missing', () => {
    expect(problemsOf(edited((c) => (c.options.blockSize = '4')))).toEqual(['"options.blockSize" must be a number.']);
    expect(problemsOf(edited((c) => (c.options.linkage = 2)))).toEqual(['"options.linkage" must be text.']);
    expect(problemsOf(edited((c) => delete c.options.blocks))).toEqual(['"options" is missing "blocks".']);
    expect(problemsOf(edited((c) => (c.options.extra = true)))).toEqual(['"options" has an unknown key "extra".']);
    expect(problemsOf(edited((c) => delete c.options))).toEqual(['"configuration" is missing "options", which Trap needs.']);
  });

  test('a hand-edited population of the wrong length or with a symbol other than 0 and 1 is named', () => {
    expect(problemsOf(edited((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['0101'] })))).toEqual(['Chromosome 1 has 4 genes, but this problem needs 20.']);
    expect(problemsOf(edited((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['0101010101010101010x'] })))[0]).toContain('may only contain the characters');
  });

  test('a crossover that does not fit the number of genes, and several problems together', () => {
    expect(
      problemsOf(
        edited((c) => {
          c.options.blockSize = 2;
          c.options.blocks = 1;
          c.params.crossover.operator = 'two-point';
        }),
      )[0],
    ).toContain('Two-point crossover needs chromosomes of at least 3 genes, but this problem');
    expect(problemsOf(edited((c) => ((c.options.blockSize = 1), (c.options.blocks = 0), (c.options.linkage = 'x'))))).toHaveLength(3);
  });
});

describe('200 generated trap configurations', () => {
  test('block sizes, numbers of blocks, linkage, selection, operators, truncation, stop settings, random and hand-edited populations: round trip, and every tenth opens as the same run', () => {
    const rng = createRng(4242);
    const int = (lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo + 1));
    const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)]!;
    const chains: StepSpec[][] = [[{ step: 'shift', epsilon: 0.5 }], [{ step: 'rank' }], [{ step: 'shift' }, { step: 'power', exponent: 2 }]];
    for (let k = 0; k < 200; k++) {
      const blockSize = int(trapLimits.minBlockSize, trapLimits.maxBlockSize);
      const blocks = int(trapLimits.minBlocks, Math.min(trapLimits.maxBlocks, Math.floor(trapLimits.maxGenes / blockSize)));
      const options: TrapOptions = { blockSize, blocks, linkage: pick(linkages) };
      const n = blockSize * blocks;
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
        stop: { generationLimit: int(1, 200), ...(rng.next() < 0.5 ? { targetFitness: int(0, n) } : {}), ...(rng.next() < 0.5 ? { stagnationWindow: int(1, 30) } : {}) },
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

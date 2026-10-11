import { describe, expect, test } from 'vitest';
import { gaAlgorithm, metricsOf, trapDefaults, trapProblem, type GaEvent, type GaParams, type GaSetup, type RunState, type TrapOptions } from '../engine';
import { createRun, type Run } from '../run';
import { blockInfoOf } from './block-context';
import { blockOrigins } from './block-model';
import { presets, type Preset } from './presets';
import { entryOf } from './problems';

const trap = (suffix: string): Preset => presets.find((p) => p.problem === 'trap' && p.id.endsWith(suffix))!;
const play = (preset: Preset, override: { options?: Partial<TrapOptions>; size?: number; params?: Partial<GaParams>; seed?: number } = {}, generations = 100): Run<GaSetup, GaParams, RunState, GaEvent> => {
  const options = { ...(preset.options as TrapOptions), ...override.options };
  const init = { kind: 'random' as const, size: override.size ?? (preset.setup.init.kind === 'random' ? preset.setup.init.size : 12) };
  const run = createRun(gaAlgorithm, { setup: { problem: trapProblem(options), init }, params: { ...preset.params, ...override.params }, seed: override.seed ?? preset.seed }, { eventCacheSize: 0 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};
const firstOptimum = (run: Run<GaSetup, GaParams, RunState, GaEvent>): number | null => {
  for (let g = 0; g <= run.lastCycle; g++) if (metricsOf(run.snapshot(g).state).bestSoFar >= 20) return g;
  return null;
};
const firstStop = (run: Run<GaSetup, GaParams, RunState, GaEvent>): { generation: number; reasons: readonly string[]; best: number } | null => {
  for (let g = 1; g <= run.lastCycle; g++) if (run.snapshot(g).stops.length > 0) return { generation: g, reasons: run.snapshot(g).stops, best: metricsOf(run.snapshot(g).state).bestSoFar };
  return null;
};
const at = (run: Run<GaSetup, GaParams, RunState, GaEvent>, g = 100) => metricsOf(run.snapshot(g).state);
const reached = (preset: Preset, override: Parameters<typeof play>[1] = {}, seeds = 100): number => {
  let n = 0;
  for (let seed = 1; seed <= seeds; seed++) if (firstOptimum(play(preset, { ...override, seed })) !== null) n++;
  return n;
};

describe('the trap preset files', () => {
  const all = presets.filter((p) => p.problem === 'trap');

  test('there are six, in the order of their file names, for the trap only, each with a one-sentence lesson and a text that says what to look for', () => {
    expect(all.map((p) => p.name)).toEqual(['Tight blocks', 'Loose blocks', 'Bigger population', 'Elitism', 'Uniform crossover', 'No mutation']);
    for (const p of all) {
      expect(p.lesson.endsWith('.')).toBe(true);
      expect(p.lesson.slice(0, -1)).not.toMatch(/[.!?]\s/);
      expect(p.lookFor.length).toBeGreaterThan(120);
      expect(p.options).toBeDefined();
    }
  });

  test('every preset uses the measured defaults except for what its lesson changes (and says so): the same selection, probabilities, stop settings and the 5 blocks of 4', () => {
    const defaults = entryOf('trap')!.defaults.params;
    for (const p of all) {
      expect(p.params.selection).toEqual(defaults.selection);
      expect(p.params.stop).toEqual(defaults.stop);
      expect(p.params.mutation.mode).toBe('per-gene');
      expect(p.params.mutation.probability).toBe(0.05);
      expect(p.params.crossover.probability).toBe(0.8);
      expect((p.options as TrapOptions).blockSize).toBe(4);
      expect((p.options as TrapOptions).blocks).toBe(5);
    }
    expect(trap('tight').params).toEqual(trapDefaults.params);
    expect(trap('tight').setup.init).toEqual({ kind: 'random', size: 12 });
    expect(trap('tight').seed).toBe(42);
  });
});

describe('Tight blocks', () => {
  const preset = trap('tight');
  const run = play(preset);

  test('the run goes through 100 generations without finding 20: best so far 17, and the average of the last population is 13, below the 15 of all zeros', () => {
    expect(firstOptimum(run)).toBeNull();
    expect(at(run).bestSoFar).toBe(17);
    expect(at(run).average).toBe(13);
    expect(at(run).average).toBeLessThan(trapProblem(preset.options as TrapOptions).attractorFitness);
    expect(run.snapshot(100).stops).toEqual(['generation-limit']);
  });

  test('Run until stop pauses at generation 86 for stagnation, with the best so far at 16', () => {
    expect(firstStop(run)).toEqual({ generation: 86, reasons: ['stagnation'], best: 16 });
  });

  test('2 runs in 100 (seeds 1 to 100) find 20', () => {
    expect(reached(preset)).toBe(2);
  }, 60000);
});

describe('Loose blocks', () => {
  const preset = trap('loose');

  test('a cut anywhere between gene 5 and gene 15 splits all five blocks: 11 of the 19 possible cuts', () => {
    const info = blockInfoOf(trapProblem(preset.options as TrapOptions));
    let all = 0;
    for (let cut = 1; cut <= 19; cut++) {
      const sources = Array.from({ length: 20 }, (_, g) => (g < cut ? 'A' : 'B') as 'A' | 'B');
      if (blockOrigins(info, sources).every((o) => o === 'split')) {
        all++;
        expect(cut).toBeGreaterThanOrEqual(5);
        expect(cut).toBeLessThanOrEqual(15);
      }
    }
    expect(all).toBe(11);
  });

  test('with this seed and 50 individuals the run ends at 17 without finding 20, and the same seed with tight blocks finds 20 in generation 74', () => {
    const run = play(preset);
    expect(firstOptimum(run)).toBeNull();
    expect(at(run).bestSoFar).toBe(17);
    expect(firstOptimum(play(preset, { options: { linkage: 'tight' } }))).toBe(74);
  });

  test('over seeds 1 to 100 tight blocks find 20 in 32 runs and loose blocks in none', () => {
    expect(reached(preset, { options: { linkage: 'tight' } })).toBe(32);
    expect(reached(preset)).toBe(0);
  }, 120000);
});

describe('Bigger population', () => {
  const preset = trap('bigger-population');

  test('finds 20 in generation 11 with this seed, while 12 individuals with the same seed end at 17', () => {
    expect(firstOptimum(play(preset))).toBe(11);
    const small = play(preset, { size: 12 });
    expect(firstOptimum(small)).toBeNull();
    expect(at(small).bestSoFar).toBe(17);
  });

  test('over seeds 1 to 100, 83 runs with 200 individuals find 20 against 2 with 12', () => {
    expect(reached(preset)).toBe(83);
    expect(reached(preset, { size: 12 })).toBe(2);
  }, 240000);
});

describe('Elitism', () => {
  const preset = trap('elitism');

  test('finds 20 in generation 17 with one elite, while the same seed without an elite ends at 19', () => {
    expect(preset.params.elites).toBe(1);
    expect(firstOptimum(play(preset))).toBe(17);
    const without = play(preset, { params: { elites: 0 } });
    expect(firstOptimum(without)).toBeNull();
    expect(at(without).bestSoFar).toBe(19);
  });

  test('over seeds 1 to 100, 94 runs with one elite find 20 against 43 without', () => {
    expect(reached(preset)).toBe(94);
    expect(reached(preset, { params: { elites: 0 } })).toBe(43);
  }, 240000);
});

describe('Uniform crossover', () => {
  const preset = trap('uniform');

  test('ends at 17 with this seed; the same seed with one-point crossover finds 20 in generation 20', () => {
    const run = play(preset);
    expect(firstOptimum(run)).toBeNull();
    expect(at(run).bestSoFar).toBe(17);
    expect(firstStop(run)).toEqual({ generation: 73, reasons: ['stagnation'], best: 17 });
    expect(firstOptimum(play(preset, { params: { crossover: { enabled: true, operator: 'one-point', probability: 0.8 } } }))).toBe(20);
  });

  test('over seeds 1 to 100 uniform crossover finds 20 in none of the runs and one-point crossover in 43', () => {
    expect(reached(preset)).toBe(0);
    expect(reached(preset, { params: { crossover: { enabled: true, operator: 'one-point', probability: 0.8 } } })).toBe(43);
  }, 240000);

  test('in the crossover view most blocks of a recombined child are split: with a uniform mask each block of four is whole in 1 case in 8', () => {
    const run = play(preset, {}, 1);
    const info = blockInfoOf(trapProblem(preset.options as TrapOptions));
    let blocks = 0;
    let split = 0;
    for (const e of run.events(1)) {
      if (e.stage !== 'crossover' || e.decision !== 'recombined') continue;
      for (const o of blockOrigins(info, e.children[0]!.sources)) {
        blocks++;
        if (o === 'split') split++;
      }
    }
    expect(blocks).toBeGreaterThan(100);
    expect(split / blocks).toBeGreaterThan(0.7);
  });
});

describe('No mutation', () => {
  const preset = trap('no-mutation');

  test('mutation is off, and with this seed all 12 individuals are the same chromosome by generation 100 with the best fitness 14, and a generation changes nothing', () => {
    expect(preset.params.mutation.enabled).toBe(false);
    const run = play(preset);
    expect(at(run).distinct).toBe(1);
    expect(at(run).best).toBe(14);
    expect(at(run).bestSoFar).toBe(14);
    expect(firstStop(run)).toEqual({ generation: 72, reasons: ['stagnation'], best: 14 });
    expect(run.snapshot(100).state.population.map((i) => i.chromosome.join(''))).toEqual(Array(12).fill(run.snapshot(100).state.population[0]!.chromosome.join('')));
    run.forwardCycle();
    expect(run.snapshot(101).state.population.map((i) => i.chromosome.join(''))).toEqual(run.snapshot(100).state.population.map((i) => i.chromosome.join('')));
  });

  test('over seeds 1 to 100 no run finds 20 and every run ends with identical individuals', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const run = play(preset, { seed });
      expect(firstOptimum(run), `seed ${seed}`).toBeNull();
      expect(at(run).distinct, `seed ${seed}`).toBe(1);
    }
  }, 120000);
});

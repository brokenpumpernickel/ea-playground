import { describe, expect, test } from 'vitest';
import { gaAlgorithm, populationFromEvents, type GaParams, type GaSetup } from './algorithm';
import { formatGenes, parseGenes } from './chromosome';
import { metricsOf } from './metrics';
import { targetStringDefaults, targetStringLimits, targetStringProblem, validateTargetString } from './target-string';
import { createFakeScheduler } from '../run/fake-scheduler';
import { createPlayback } from '../run/playback';
import { createRun } from '../run/run';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const problem = (target: string, alphabet = letters) => targetStringProblem({ alphabet, target });
const score = (target: string, chromosome: string, alphabet = letters) => {
  const p = problem(target, alphabet);
  return p.evaluate(parseGenes(chromosome, p.alphabet)!);
};

describe('scoring: the number of positions equal to the target', () => {
  test.each([
    ['all matching', 'HELLO WORLD', 'HELLO WORLD', 11],
    ['none matching', 'HELLO WORLD', 'ZZZZZZZZZZZ', 0],
    ['repeated letters count at each position, not once', 'HELLO WORLD', 'LLLLLLLLLLL', 3],
    ['a space is a symbol like any other', 'HELLO WORLD', 'HELLOXWORLD', 10],
    ['a one-letter target', 'A', 'A', 1],
    ['a one-letter target missed', 'A', 'B', 0],
    ['order matters: the right letters in the wrong places', 'HELLO', 'OLLEH', 1],
  ])('%s', (_name, target, chromosome, expected) => {
    const s = score(target, chromosome);
    expect(s.objective).toBe(expected);
    expect(s.fitness).toBe(expected);
    expect(s.decoded).toBe(chromosome);
  });

  test('a 24-letter target and a 40-symbol alphabet', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
    const target = 'ABCDEFGHIJKLMNOPQRSTUVWX';
    const p = problem(target, alphabet);
    expect(p.chromosomeLength).toBe(24);
    expect(p.alphabet).toHaveLength(40);
    expect(p.evaluate(parseGenes(target, p.alphabet)!).fitness).toBe(24);
    expect(p.evaluate(parseGenes('abcdefghijklmnopqrstuvwx'.slice(0, 24).replace(/[o-x]/g, 'n'), p.alphabet)!).fitness).toBe(0);
  });

  test('case matters, as typed', () => {
    expect(score('Hello', 'hELLO', 'HELOhelo').fitness).toBe(0);
    expect(score('Hello', 'Hello', 'HELOhelo').fitness).toBe(5);
    expect(() => problem('Hello', 'HELO')).toThrow('"e"');
  });

  test('the problem declares what the optimum is, its columns and its alphabet', () => {
    const p = problem('HELLO WORLD');
    expect(p.knownOptimumFitness).toBe(11);
    expect(p.landscape).toBeUndefined();
    expect(p.alphabet.join('')).toBe(letters);
    const scores = p.evaluate(parseGenes('HELLO WORLX', p.alphabet)!);
    expect(p.columns.map((c) => [c.header, c.note, c.show(scores)])).toEqual([['Fitness', '= matches', '10 of 11']]);
    expect(formatGenes(parseGenes('HELLO WORLD', p.alphabet)!, p.alphabet)).toBe('HELLO WORLD');
  });
});

describe('validation says what is wrong in words', () => {
  const issues = (alphabet: string, target: string) => validateTargetString({ alphabet, target });

  test('good options have none, at the limits too', () => {
    expect(issues(letters, 'HELLO WORLD')).toEqual([]);
    expect(issues('AB', 'ABBA')).toEqual([]);
    expect(issues(letters, 'A'.repeat(targetStringLimits.maxTarget))).toEqual([]);
    expect(issues(forty(), 'AB')).toEqual([]);
  });
  const forty = () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';

  test('an alphabet that is too small, too large, or has a symbol twice', () => {
    expect(issues('A', 'A')[0]).toContain('at least 2 symbols');
    expect(issues('', 'A')[0]).toContain('at least 2 symbols');
    expect(issues(forty() + 'o', 'A')).toEqual(['The alphabet can have at most 40 symbols (it has 41).']);
    expect(issues('ABBA', 'AB')).toEqual(['The alphabet contains "B" more than once.', 'The alphabet contains "A" more than once.']);
    expect(issues('AB B', 'AB')).toEqual(['The alphabet contains "B" more than once.']);
    expect(issues('A  B', 'AB')).toEqual(['The alphabet contains a space more than once.']);
  });

  test('a target that is empty, too long, or uses a character outside the alphabet', () => {
    expect(issues(letters, '')).toEqual(['The target must not be empty.']);
    expect(issues(letters, 'A'.repeat(25))).toEqual(['The target can have at most 24 characters (it has 25).']);
    expect(issues(letters, 'HELLO, WORLD')).toEqual(['The target contains "," (position 6), which is not in the alphabet. Add it to the alphabet or remove it from the target.']);
    expect(issues('AB', 'ABC C')).toEqual([
      'The target contains "C" (position 3), which is not in the alphabet. Add it to the alphabet or remove it from the target.',
      'The target contains a space (position 4), which is not in the alphabet. Add it to the alphabet or remove it from the target.',
    ]);
  });

  test('control characters in the alphabet are refused', () => {
    expect(issues('AB\n', 'AB')).toEqual(['The alphabet may only contain visible characters and spaces.']);
  });

  test('building a problem from invalid options throws the first message', () => {
    expect(() => targetStringProblem({ alphabet: letters, target: 'HELLO, WORLD' })).toThrow('The target contains ","');
  });

  test('several problems at once are all reported', () => {
    expect(issues('A', '').length).toBe(2);
  });
});

describe('defaults', () => {
  test('are valid and agree with the problem: the target is the optimum', () => {
    const { options, params } = targetStringDefaults;
    expect(validateTargetString(options)).toEqual([]);
    expect(options.target).toBe('HELLO');
    expect(targetStringDefaults.populationSize).toBe(12);
    expect(params.stop).toEqual({ generationLimit: 100, targetFitness: problem(options.target, options.alphabet).knownOptimumFitness, stagnationWindow: 15 });
    expect(params.selection).toEqual({ method: 'tournament', size: 3 });
    expect(params.mutation).toEqual({ enabled: true, mode: 'per-gene', probability: 0.1 });
    expect(params.crossover).toEqual({ enabled: true, operator: 'one-point', probability: 0.8 });
    expect(params.elites).toBe(0);
  });
});

/* ---------------------------------------------------------------- the GA on strings */

const setup = (init: GaSetup['init'], target = 'HELLO'): GaSetup => ({ problem: problem(target), init });
const base: GaParams = targetStringDefaults.params;
const make = (o: { init?: GaSetup['init']; params?: Partial<GaParams>; seed?: number; eventCacheSize?: number; target?: string } = {}) =>
  createRun(gaAlgorithm, { setup: setup(o.init ?? { kind: 'random', size: 12 }, o.target), params: { ...base, ...o.params }, seed: o.seed ?? 5 }, { eventCacheSize: o.eventCacheSize });

describe('a seeded default run', () => {
  test('converges to the target within the generation limit, and says so through the stop criteria', () => {
    const run = make({ seed: 1 });
    const result = run.runUntil((s) => s.stops.includes('target-reached'));
    expect(result.reason).toBe('condition');
    expect(result.cycles).toBeLessThanOrEqual(100);
    const final = run.snapshot(run.lastCycle).state;
    expect(metricsOf(final, 27).bestSoFar).toBe(5);
    expect(final.population.some((i) => i.decoded === 'HELLO')).toBe(true);
  });

  test('the same seed gives the same run, a different seed another', () => {
    const record = (seed: number) => {
      const run = make({ seed });
      run.runUntil((s) => s.cycle === 10);
      return [0, 5, 10].map((c) => run.snapshot(c).state.population.map((i) => i.decoded));
    };
    expect(record(3)).toEqual(record(3));
    expect(record(3)).not.toEqual(record(4));
  });
});

describe('reproducibility and agreement', () => {
  const advance = (how: (r: ReturnType<typeof make>) => void, eventCacheSize: number) => {
    const run = make({ seed: 21, eventCacheSize });
    while (run.lastCycle < 6) how(run);
    return Array.from({ length: 7 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));
  };

  test('micro-steps, stages, generations and run-until make the identical run, and regenerated events equal the live ones', () => {
    const byMicro = advance((r) => r.forwardMicro(), 0);
    expect(advance((r) => r.forwardStage(), 0)).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle(), 100)).toEqual(byMicro);
    const until = make({ seed: 21, eventCacheSize: 0 });
    until.runUntil((s) => s.cycle === 6);
    expect(Array.from({ length: 7 }, (_, c) => ({ snapshot: until.snapshot(c), events: until.events(c) }))).toEqual(byMicro);
  });

  test.each(['slow', 'medium', 'fast', 'maximum'] as const)('playback at the %s tier makes the identical run', (tier) => {
    const reference = make({ seed: 21, eventCacheSize: 0 });
    while (reference.lastCycle < 6) reference.forwardCycle();
    const run = make({ seed: 21, eventCacheSize: 0 });
    const scheduler = createFakeScheduler();
    const playback = createPlayback(run, { scheduler });
    playback.setTier(tier);
    playback.play();
    for (let n = 0; n < 100_000 && run.lastCycle < 6 && scheduler.fire(); n++);
    playback.pause();
    expect(run.lastCycle).toBeGreaterThanOrEqual(6);
    for (let c = 0; c <= 6; c++) {
      expect(run.snapshot(c)).toEqual(reference.snapshot(c));
      expect(run.events(c)).toEqual(reference.events(c));
    }
  });

  test('replaying the events alone reproduces every population, with elites and truncation too', () => {
    for (const params of [{}, { elites: 2 }, { elites: 1, truncation: { enabled: true, lambda: 13 } }]) {
      const run = make({ seed: 8, eventCacheSize: 0, params });
      run.runUntil((s) => s.cycle === 8);
      for (let c = 1; c <= 8; c++) {
        expect(populationFromEvents(run.snapshot(c - 1).state.population, run.events(c))).toEqual(run.snapshot(c).state.population);
      }
    }
  });
});

describe('the operators on strings', () => {
  const events = (run: ReturnType<typeof make>, c: number) => run.events(c);

  test('crossover switched off: every pair is a recorded bypass of copies, and selection still ran', () => {
    const run = make({ seed: 2, params: { crossover: { enabled: false, operator: 'one-point', probability: 0.8 } } });
    run.forwardCycle();
    const pairs = events(run, 1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((e) => e.decision === 'bypassed' && e.reason === 'switched-off')).toBe(true);
    expect(events(run, 1).some((e) => e.stage === 'selection' && e.kind === 'tournament')).toBe(true);
    // bypassed children are copies of their parents, never the same array
    const before = run.snapshot(0).state.population;
    for (const e of pairs) {
      const a = before.find((i) => i.id === e.parentAId)!;
      expect(e.children[0]!.chromosome).toEqual(a.chromosome);
      expect(e.children[0]!.chromosome).not.toBe(a.chromosome);
    }
  });

  test('mutation switched off: every chromosome is unchanged and nothing is drawn for it', () => {
    const run = make({ seed: 2, params: { mutation: { enabled: false, mode: 'per-gene', probability: 0.5 } } });
    run.forwardCycle();
    const mutation = events(run, 1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    expect(mutation.every((e) => e.decision === 'bypassed' && e.after.join() === e.before.join())).toBe(true);
    expect(mutation.every((e) => e.replacements === undefined)).toBe(true);
  });

  test('a mutated letter always changes into a different letter of the alphabet, and the replacement draw is recorded', () => {
    const run = make({ seed: 9, params: { mutation: { enabled: true, mode: 'per-gene', probability: 0.6 } } });
    run.forwardCycle();
    const mutated = events(run, 1).flatMap((e) => (e.stage === 'mutation' && e.decision === 'mutated' ? [e] : []));
    expect(mutated.length).toBeGreaterThan(0);
    for (const e of mutated) {
      expect(e.replacements).toHaveLength(e.flipped.length);
      for (const r of e.replacements!) {
        expect(r.from).not.toBe(r.to);
        expect(r.to).toBeLessThan(27);
        expect(e.before[r.gene - 1]).toBe(r.from);
        expect(e.after[r.gene - 1]).toBe(r.to);
      }
    }
  });

  test('the population has exactly N individuals after every generation, elites are respected, and every chromosome is valid', () => {
    const run = make({ seed: 4, params: { elites: 2 }, init: { kind: 'random', size: 9 } });
    run.runUntil((s) => s.cycle === 15);
    for (let c = 1; c <= 15; c++) {
      const population = run.snapshot(c).state.population;
      expect(population).toHaveLength(9);
      for (const i of population) {
        expect(i.chromosome).toHaveLength(5);
        expect(i.chromosome.every((g) => Number.isInteger(g) && g >= 0 && g < 27)).toBe(true);
      }
      const replacement = events(run, c).find((e) => e.stage === 'replacement')!;
      expect('elites' in replacement && replacement.elites).toHaveLength(2);
    }
  });

  test('with truncation exactly N − e survive from λ offspring, the best ones, and the discards are listed', () => {
    const run = make({ seed: 6, params: { elites: 1, truncation: { enabled: true, lambda: 10 } }, init: { kind: 'random', size: 8 } });
    run.forwardCycle();
    const replacement = events(run, 1).find((e) => e.stage === 'replacement')!;
    if (replacement.stage !== 'replacement') throw new Error('unreachable');
    expect(replacement.population).toHaveLength(8);
    const ranking = replacement.ranking!;
    expect(ranking).toHaveLength(10);
    expect(ranking.filter((r) => r.kept)).toHaveLength(7);
    const fitness = new Map(events(run, 1).flatMap((e) => (e.stage === 'evaluation' ? [[e.individual.id, e.individual.fitness] as const] : [])));
    const kept = ranking.filter((r) => r.kept).map((r) => fitness.get(r.individualId)!);
    const lost = ranking.filter((r) => !r.kept).map((r) => fitness.get(r.individualId)!);
    expect(Math.min(...kept)).toBeGreaterThanOrEqual(Math.max(...lost));
  });

  test('an odd mating pool uses one extra parent and drops the last child', () => {
    const run = make({ seed: 3, params: { elites: 1 }, init: { kind: 'random', size: 6 } }); // 5 offspring wanted
    run.forwardCycle();
    const pairs = events(run, 1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(pairs).toHaveLength(3);
    expect(pairs[2]!.children[1]!.discarded).toBe(true);
    expect(events(run, 1).filter((e) => e.stage === 'evaluation')).toHaveLength(5);
  });

  test('children never share a chromosome array with their parents or each other', () => {
    const run = make({ seed: 12, params: { crossover: { enabled: true, operator: 'uniform', probability: 1 } } });
    run.forwardCycle();
    const parents = run.snapshot(0).state.population.map((i) => i.chromosome);
    for (const e of events(run, 1)) {
      if (e.stage !== 'crossover') continue;
      for (const child of e.children) expect(parents.every((p) => p !== child.chromosome)).toBe(true);
      expect(e.children[0]!.chromosome).not.toBe(e.children[1]!.chromosome);
    }
  });
});

describe('all-zero fitness', () => {
  test('under roulette with Identity the weights switch to Shift and say why; under tournament nothing is needed', () => {
    const none = { kind: 'explicit' as const, chromosomes: ['ZZZZZ', 'YYYYY', 'XXXXX', 'WWWWW'] };
    const roulette = make({ init: none, seed: 1, params: { selection: { method: 'roulette', chain: [{ step: 'identity' }] } } });
    roulette.forwardCycle();
    const chain = roulette.events(1).find((e) => e.stage === 'selection' && e.kind === 'weight-chain');
    if (!chain || chain.stage !== 'selection' || chain.kind !== 'weight-chain') throw new Error('no weight chain');
    expect(chain.autoSwitch?.reason).toContain('All fitness values are zero');
    expect(chain.weights.every((w) => w === 1)).toBe(true);
    const tournament = make({ init: none, seed: 1 });
    expect(() => tournament.forwardCycle()).not.toThrow();
  });
});

describe('the hand-edited population', () => {
  test('starts the run from the strings typed, with their scores', () => {
    const run = make({ init: { kind: 'explicit', chromosomes: ['HELLO', 'JELLY', 'ZZZZZ'] } });
    const population = run.snapshot(0).state.population;
    expect(population.map((i) => [i.decoded, i.fitness])).toEqual([['HELLO', 5], ['JELLY', 3], ['ZZZZZ', 0]]);
  });

  test('a letter outside the alphabet is refused, naming the chromosome', () => {
    expect(() => make({ init: { kind: 'explicit', chromosomes: ['HELLO', 'hello'] } })).toThrow('Chromosome 2 ("hello") may only contain the characters of the alphabet (27 symbols)');
  });
});

import { describe, expect, test } from 'vitest';
import { gaAlgorithm, populationFromEvents, type GaParams, type GaSetup } from './algorithm';
import { metricsOf } from './metrics';
import { trapDefaultOptions, trapProblem, type Linkage, type TrapOptions } from './trap';
import { createFakeScheduler } from '../run/fake-scheduler';
import { createPlayback } from '../run/playback';
import { createRun } from '../run/run';

const optionsFor = (linkage: Linkage): TrapOptions => ({ ...trapDefaultOptions, linkage });
const base: GaParams = {
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 60, targetFitness: 20 },
};
const make = (linkage: Linkage, o: { init?: GaSetup['init']; params?: Partial<GaParams>; seed?: number; eventCacheSize?: number } = {}) => {
  const setup: GaSetup = { problem: trapProblem(optionsFor(linkage)), init: o.init ?? { kind: 'random', size: 12 } };
  return createRun(gaAlgorithm, { setup, params: { ...base, ...o.params }, seed: o.seed ?? 5 }, { eventCacheSize: o.eventCacheSize });
};
const linkages: readonly Linkage[] = ['tight', 'loose'];

describe.each(linkages)('%s linkage: a seeded run is the same run however it is advanced', (linkage) => {
  const advance = (how: (r: ReturnType<typeof make>) => void, eventCacheSize: number) => {
    const run = make(linkage, { seed: 21, eventCacheSize });
    while (run.lastCycle < 6) how(run);
    return Array.from({ length: 7 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));
  };

  test('micro-steps, stages, generations and run-until agree, and regenerated events equal live ones', () => {
    const byMicro = advance((r) => r.forwardMicro(), 0);
    expect(advance((r) => r.forwardStage(), 0)).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle(), 100)).toEqual(byMicro);
    const until = make(linkage, { seed: 21, eventCacheSize: 0 });
    until.runUntil((s) => s.cycle === 6);
    expect(Array.from({ length: 7 }, (_, c) => ({ snapshot: until.snapshot(c), events: until.events(c) }))).toEqual(byMicro);
  });

  test.each(['slow', 'medium', 'fast', 'maximum'] as const)('playback at the %s tier makes the identical run', (tier) => {
    const noTarget = { stop: { generationLimit: 60 } };
    const reference = make(linkage, { seed: 21, eventCacheSize: 0, params: noTarget });
    while (reference.lastCycle < 6) reference.forwardCycle();
    const run = make(linkage, { seed: 21, eventCacheSize: 0, params: noTarget });
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

  test('the events alone reproduce every population, with elites and truncation too', () => {
    for (const params of [{}, { elites: 2 }, { elites: 1, truncation: { enabled: true, lambda: 14 } }]) {
      const run = make(linkage, { seed: 8, eventCacheSize: 0, params });
      run.runUntil((s) => s.cycle === 8);
      for (let c = 1; c <= 8; c++) {
        expect(populationFromEvents(run.snapshot(c - 1).state.population, run.events(c))).toEqual(run.snapshot(c).state.population);
      }
    }
  });

  test('every individual is scored as the trap says: its fitness is the sum of its blocks, in every generation', () => {
    const problem = trapProblem(optionsFor(linkage));
    const run = make(linkage, { seed: 13 });
    run.runUntil((s) => s.cycle === 6);
    for (let c = 0; c <= 6; c++) {
      for (const i of run.snapshot(c).state.population) {
        const outcome = problem.outcomeOf(i.chromosome);
        expect(i.fitness).toBe(outcome.fitness);
        expect(i.objective).toBe(outcome.fitness);
        expect(i.decoded).toBe(outcome.blocks.map((b) => b.ones).join(' · '));
        expect(i.chromosome).toHaveLength(20);
      }
    }
  });
});

describe('the operators on trap chromosomes', () => {
  test.each(['one-point', 'two-point', 'uniform'] as const)('%s crossover and per-individual and per-gene mutation run and keep every chromosome a valid trap string', (operator) => {
    for (const mode of ['per-gene', 'per-individual'] as const) {
      const run = make('loose', { seed: 3, params: { crossover: { enabled: true, operator, probability: 0.9 }, mutation: { enabled: true, mode, probability: 0.3 } } });
      run.runUntil((s) => s.cycle === 5);
      for (let c = 0; c <= 5; c++) {
        for (const i of run.snapshot(c).state.population) expect(i.chromosome.every((g) => g === 0 || g === 1)).toBe(true);
      }
    }
  });

  test('crossover off is a recorded bypass of copies, mutation off is a recorded bypass, selection still runs', () => {
    const run = make('tight', { seed: 2, params: { crossover: { enabled: false, operator: 'one-point', probability: 0.8 }, mutation: { enabled: false, mode: 'per-gene', probability: 0.3 } } });
    run.forwardCycle();
    const events = run.events(1);
    expect(events.flatMap((e) => (e.stage === 'crossover' ? [e] : [])).every((e) => e.decision === 'bypassed' && e.reason === 'switched-off')).toBe(true);
    expect(events.flatMap((e) => (e.stage === 'mutation' ? [e] : [])).every((e) => e.decision === 'bypassed' && e.after.join() === e.before.join())).toBe(true);
    expect(events.some((e) => e.stage === 'selection')).toBe(true);
  });

  test('a mutated gene flips between 0 and 1', () => {
    const run = make('tight', { seed: 9, params: { mutation: { enabled: true, mode: 'per-gene', probability: 0.6 } } });
    run.forwardCycle();
    const mutated = run.events(1).flatMap((e) => (e.stage === 'mutation' && e.decision === 'mutated' ? [e] : []));
    expect(mutated.length).toBeGreaterThan(0);
    for (const e of mutated) for (const gene of e.flipped) expect(e.after[gene - 1]).toBe(1 - e.before[gene - 1]!);
  });

  test('size, elites, truncation and the odd mating pool behave as for the other problems', () => {
    const run = make('loose', { seed: 4, params: { elites: 2 }, init: { kind: 'random', size: 9 } });
    run.runUntil((s) => s.cycle === 12);
    for (let c = 1; c <= 12; c++) {
      expect(run.snapshot(c).state.population).toHaveLength(9);
      const replacement = run.events(c).find((e) => e.stage === 'replacement')!;
      expect('elites' in replacement && replacement.elites).toHaveLength(2);
    }
    const truncated = make('tight', { seed: 6, params: { elites: 1, truncation: { enabled: true, lambda: 10 } }, init: { kind: 'random', size: 8 } });
    truncated.forwardCycle();
    const replacement = truncated.events(1).find((e) => e.stage === 'replacement')!;
    if (replacement.stage !== 'replacement') throw new Error('unreachable');
    expect(replacement.population).toHaveLength(8);
    expect(replacement.ranking!.filter((r) => r.kept)).toHaveLength(7);
    const odd = make('tight', { seed: 3, params: { elites: 1 }, init: { kind: 'random', size: 6 } });
    odd.forwardCycle();
    const pairs = odd.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(pairs).toHaveLength(3);
    expect(pairs[2]!.children[1]!.discarded).toBe(true);
  });

  test('children never share a chromosome array with their parents', () => {
    const run = make('tight', { seed: 12, params: { crossover: { enabled: true, operator: 'uniform', probability: 1 } } });
    run.forwardCycle();
    const parents = run.snapshot(0).state.population.map((i) => i.chromosome);
    for (const e of run.events(1)) if (e.stage === 'crossover') for (const child of e.children) expect(parents.every((p) => p !== child.chromosome)).toBe(true);
  });
});

describe('a population whose total fitness is zero', () => {
  const dead = Array.from({ length: 6 }, () => '1110'.repeat(5)); // every block 1110: contribution 0

  test('every individual scores 0, and the default roulette chain switches to Shift and says why (as it does for Goldberg), so selection still works', () => {
    const run = make('tight', { init: { kind: 'explicit', chromosomes: dead }, seed: 2, params: { selection: { method: 'roulette', chain: [{ step: 'identity' }] } } });
    expect(run.snapshot(0).state.population.every((i) => i.fitness === 0)).toBe(true);
    run.forwardCycle();
    const chain = run.events(1).find((e) => e.stage === 'selection' && e.kind === 'weight-chain');
    if (!chain || chain.stage !== 'selection' || chain.kind !== 'weight-chain') throw new Error('no weight chain');
    expect(chain.autoSwitch?.reason).toContain('All fitness values are zero');
    expect(chain.weights.every((w) => w > 0)).toBe(true);
    expect(run.snapshot(1).state.population).toHaveLength(6);
  });
});

describe('stop criteria and metrics on the trap', () => {
  test('a population that already contains the optimum has reached the target by the end of the first generation (best so far is kept); the known optimum is k × m', () => {
    const run = make('tight', { init: { kind: 'explicit', chromosomes: ['1'.repeat(20), '0'.repeat(20)] }, seed: 1 });
    expect(metricsOf(run.snapshot(0).state).best).toBe(20);
    run.forwardCycle();
    expect(run.snapshot(1).stops).toContain('target-reached');
  });

  test('with no crossover and no mutation nothing can improve, so stagnation is reported after exactly its window', () => {
    const params = {
      crossover: { enabled: false, operator: 'one-point' as const, probability: 0.8 },
      mutation: { enabled: false, mode: 'per-gene' as const, probability: 0.1 },
      stop: { generationLimit: 100, stagnationWindow: 5 },
    };
    const run = make('loose', { seed: 7, params });
    run.runUntil((s) => s.cycle === 8);
    for (let c = 0; c <= 8; c++) expect(run.snapshot(c).stops.includes('stagnation')).toBe(c >= 5);
  });

  test('the generation limit stops the run, and no feasibility metrics are reported (the trap has no constraint)', () => {
    const run = make('tight', { seed: 5, params: { stop: { generationLimit: 4 } } });
    const result = run.runUntil((s) => s.stops.length > 0);
    expect(result.reason).toBe('condition');
    expect(run.snapshot(run.lastCycle).stops).toEqual(['generation-limit']);
    expect(metricsOf(run.snapshot(run.lastCycle).state).feasible).toBeUndefined();
  });
});

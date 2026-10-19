import { describe, expect, test } from 'vitest';
import { gaAlgorithm, populationFromEvents, type GaParams, type GaSetup } from './algorithm';
import { landscapeProblem, type LandscapeOptions } from './landscape';
import type { NichingConfig } from './niching';
import { createFakeScheduler } from '../run/fake-scheduler';
import { createPlayback } from '../run/playback';
import { createRun } from '../run/run';

const two: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };
const methods: [string, NichingConfig, GaParams['selection']][] = [
  ['fitness sharing with roulette', { method: 'sharing', sigma: 2, alpha: 1 }, { method: 'roulette', chain: [{ step: 'identity' }] }],
  ['fitness sharing with tournaments', { method: 'sharing', sigma: 2, alpha: 1 }, { method: 'tournament', size: 2 }],
  ['deterministic crowding', { method: 'crowding', sigma: 2, alpha: 1 }, { method: 'tournament', size: 2 }],
];
const params = (niching: NichingConfig, selection: GaParams['selection']): GaParams => ({
  selection,
  crossover: { enabled: true, operator: 'blx-alpha', probability: 0.9, alpha: 0.5 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.1, sigma: 0.05 },
  elites: 1,
  stop: { generationLimit: 60 },
  niching,
});
const make = (niching: NichingConfig, selection: GaParams['selection'], o: { seed?: number; eventCacheSize?: number; size?: number } = {}) =>
  createRun(gaAlgorithm, { setup: { problem: landscapeProblem(two), init: { kind: 'random', size: o.size ?? 14 } } as GaSetup, params: params(niching, selection), seed: o.seed ?? 5 }, { eventCacheSize: o.eventCacheSize });

describe.each(methods)('a seeded run with %s is the same run however it is advanced', (_name, niching, selection) => {
  const advance = (how: (r: ReturnType<typeof make>) => void, eventCacheSize: number) => {
    const run = make(niching, selection, { seed: 21, eventCacheSize });
    while (run.lastCycle < 6) how(run);
    return Array.from({ length: 7 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));
  };

  test('micro-steps, stages, generations and run-until agree, and regenerated events equal live ones', () => {
    const byMicro = advance((r) => r.forwardMicro(), 0);
    expect(advance((r) => r.forwardStage(), 0)).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle(), 100)).toEqual(byMicro);
    const until = make(niching, selection, { seed: 21, eventCacheSize: 0 });
    until.runUntil((state) => state.cycle === 6);
    expect(Array.from({ length: 7 }, (_, c) => ({ snapshot: until.snapshot(c), events: until.events(c) }))).toEqual(byMicro);
  });

  test.each(['slow', 'medium', 'fast', 'maximum'] as const)('playback at the %s tier makes the identical run', (tier) => {
    const reference = make(niching, selection, { seed: 21, eventCacheSize: 0 });
    while (reference.lastCycle < 6) reference.forwardCycle();
    const run = make(niching, selection, { seed: 21, eventCacheSize: 0 });
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

  test('the events replay to the population, every generation, and the population size never changes', () => {
    const run = make(niching, selection, { seed: 8 });
    run.runUntil((state) => state.cycle === 6);
    for (let c = 1; c <= 6; c++) {
      const before = run.snapshot(c - 1).state.population;
      expect(populationFromEvents(before, run.events(c))).toEqual(run.snapshot(c).state.population);
      expect(run.snapshot(c).state.population).toHaveLength(14);
    }
  });

  test('the same seed gives the same run and another seed another one', () => {
    const final = (seed: number) => {
      const run = make(niching, selection, { seed });
      run.runUntil((state) => state.cycle === 8);
      return run.snapshot(8).state.population.map((i) => i.chromosome.join(','));
    };
    expect(final(7)).toEqual(final(7));
    expect(final(7)).not.toEqual(final(8));
  });
});

describe('deterministic crowding with an odd population', () => {
  test('the events replay to the population, the size is kept, and every place is as good as before', () => {
    const crowding: NichingConfig = { method: 'crowding', sigma: 2, alpha: 1 };
    const run = make(crowding, { method: 'tournament', size: 2 }, { seed: 12, size: 13 });
    run.runUntil((state) => state.cycle === 8);
    for (let c = 1; c <= 8; c++) {
      const before = run.snapshot(c - 1).state.population;
      const after = run.snapshot(c).state.population;
      expect(populationFromEvents(before, run.events(c))).toEqual(after);
      expect(after).toHaveLength(13);
      after.forEach((i, k) => expect(i.fitness).toBeGreaterThanOrEqual(before[k]!.fitness));
    }
  });
});

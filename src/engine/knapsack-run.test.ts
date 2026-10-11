import { describe, expect, test } from 'vitest';
import { gaAlgorithm, populationFromEvents, type GaParams, type GaSetup } from './algorithm';
import { handlings, type Handling } from './knapsack-handling';
import { builtInKnapsack, itemName } from './knapsack-instance';
import { knapsackDefaults, knapsackProblem, type KnapsackOptions } from './knapsack';
import { metricsOf } from './metrics';
import { createFakeScheduler } from '../run/fake-scheduler';
import { createPlayback } from '../run/playback';
import { createRun } from '../run/run';

const optionsFor = (handling: Handling, rho = 4): KnapsackOptions => ({ ...knapsackDefaults.options, handling, rho });
const base: GaParams = { ...knapsackDefaults.params, stop: { generationLimit: 60, targetFitness: 123 } };
const make = (handling: Handling, o: { init?: GaSetup['init']; params?: Partial<GaParams>; seed?: number; eventCacheSize?: number; rho?: number } = {}) => {
  const setup: GaSetup = { problem: knapsackProblem(optionsFor(handling, o.rho)), init: o.init ?? { kind: 'random', size: 12 } };
  return createRun(gaAlgorithm, { setup, params: { ...base, ...o.params }, seed: o.seed ?? 5 }, { eventCacheSize: o.eventCacheSize });
};
const weightOf = (genes: readonly number[]) => genes.reduce((t, g, i) => t + (g === 1 ? builtInKnapsack.items[i]!.weight : 0), 0);

describe.each(handlings)('%s: a seeded run is the same run however it is advanced', (handling) => {
  const advance = (how: (r: ReturnType<typeof make>) => void, eventCacheSize: number) => {
    const run = make(handling, { seed: 21, eventCacheSize });
    while (run.lastCycle < 6) how(run);
    return Array.from({ length: 7 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));
  };

  test('micro-steps, stages, generations and run-until agree, and regenerated events equal live ones', () => {
    const byMicro = advance((r) => r.forwardMicro(), 0);
    expect(advance((r) => r.forwardStage(), 0)).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle(), 100)).toEqual(byMicro);
    const until = make(handling, { seed: 21, eventCacheSize: 0 });
    until.runUntil((s) => s.cycle === 6);
    expect(Array.from({ length: 7 }, (_, c) => ({ snapshot: until.snapshot(c), events: until.events(c) }))).toEqual(byMicro);
  });

  test.each(['slow', 'medium', 'fast', 'maximum'] as const)('playback at the %s tier makes the identical run', (tier) => {
    // no target here: playback would pause for it when this seed finds the optimum within six generations
    const noTarget = { stop: { generationLimit: 60 } };
    const reference = make(handling, { seed: 21, eventCacheSize: 0, params: noTarget });
    while (reference.lastCycle < 6) reference.forwardCycle();
    const run = make(handling, { seed: 21, eventCacheSize: 0, params: noTarget });
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
      const run = make(handling, { seed: 8, eventCacheSize: 0, params });
      run.runUntil((s) => s.cycle === 8);
      for (let c = 1; c <= 8; c++) {
        expect(populationFromEvents(run.snapshot(c - 1).state.population, run.events(c))).toEqual(run.snapshot(c).state.population);
      }
    }
  });
});

describe('repair rewrites chromosomes only where it should', () => {
  test('Lamarckian: the individuals carry the repaired chromosome, the evaluation event keeps what mutation left, and every individual fits', () => {
    const run = make('repair-lamarckian', { seed: 11 });
    run.runUntil((s) => s.cycle === 10);
    let repairs = 0;
    for (let c = 0; c <= 10; c++) {
      for (const i of run.snapshot(c).state.population) {
        expect(weightOf(i.chromosome)).toBeLessThanOrEqual(builtInKnapsack.capacity);
        expect(i.decoded).toBe(i.chromosome.flatMap((g, k) => (g === 1 ? [itemName(k)] : [])).join(''));
      }
      const mutated = new Map(run.events(c).flatMap((e) => (e.stage === 'mutation' ? [[e.offspring, e.after] as const] : [])));
      for (const e of run.events(c)) {
        if (e.stage === 'evaluation' && e.repairedFrom) {
          repairs++;
          expect(e.repairedFrom).toEqual(mutated.get(e.offspring));
          expect(weightOf(e.repairedFrom)).toBeGreaterThan(builtInKnapsack.capacity);
          expect(e.individual.chromosome.every((g, k) => g <= e.repairedFrom![k]!)).toBe(true);
        }
        if (e.stage === 'setup' && e.repairedFrom) repairs++;
      }
    }
    expect(repairs).toBeGreaterThan(3); // the run really repaired things, in the initial population and later
  });

  test.each(['decoder', 'penalty', 'repair-baldwinian'] as const)('%s never changes a chromosome: no event has repairedFrom, and offspring are what mutation left', (handling) => {
    const run = make(handling, { seed: 11 });
    run.runUntil((s) => s.cycle === 6);
    for (let c = 0; c <= 6; c++) {
      const mutated = new Map(run.events(c).flatMap((e) => (e.stage === 'mutation' ? [[e.offspring, e.after] as const] : [])));
      for (const e of run.events(c)) {
        if (e.stage === 'evaluation') {
          expect('repairedFrom' in e).toBe(false);
          expect(e.individual.chromosome).toEqual(mutated.get(e.offspring));
        }
        if (e.stage === 'setup') expect('repairedFrom' in e).toBe(false);
      }
    }
  });
});

describe('the operators on bags', () => {
  test('crossover off is a recorded bypass of copies, mutation off is a recorded bypass, selection still runs', () => {
    const run = make('penalty', { seed: 2, params: { crossover: { enabled: false, operator: 'one-point', probability: 0.8 }, mutation: { enabled: false, mode: 'per-gene', probability: 0.3 } } });
    run.forwardCycle();
    const events = run.events(1);
    expect(events.flatMap((e) => (e.stage === 'crossover' ? [e] : [])).every((e) => e.decision === 'bypassed' && e.reason === 'switched-off')).toBe(true);
    expect(events.flatMap((e) => (e.stage === 'mutation' ? [e] : [])).every((e) => e.decision === 'bypassed' && e.after.join() === e.before.join())).toBe(true);
    expect(events.some((e) => e.stage === 'selection')).toBe(true);
  });

  test('a mutated gene flips between 0 and 1 and no replacement draw is recorded', () => {
    const run = make('decoder', { seed: 9, params: { mutation: { enabled: true, mode: 'per-gene', probability: 0.6 } } });
    run.forwardCycle();
    const mutated = run.events(1).flatMap((e) => (e.stage === 'mutation' && e.decision === 'mutated' ? [e] : []));
    expect(mutated.length).toBeGreaterThan(0);
    for (const e of mutated) {
      expect(e.replacements).toBeUndefined();
      for (const gene of e.flipped) expect(e.after[gene - 1]).toBe(1 - e.before[gene - 1]!);
    }
  });

  test('size, elites, truncation and the odd mating pool behave as for the other problems', () => {
    const run = make('repair-lamarckian', { seed: 4, params: { elites: 2 }, init: { kind: 'random', size: 9 } });
    run.runUntil((s) => s.cycle === 12);
    for (let c = 1; c <= 12; c++) {
      expect(run.snapshot(c).state.population).toHaveLength(9);
      const replacement = run.events(c).find((e) => e.stage === 'replacement')!;
      expect('elites' in replacement && replacement.elites).toHaveLength(2);
    }
    const truncated = make('decoder', { seed: 6, params: { elites: 1, truncation: { enabled: true, lambda: 10 } }, init: { kind: 'random', size: 8 } });
    truncated.forwardCycle();
    const replacement = truncated.events(1).find((e) => e.stage === 'replacement')!;
    if (replacement.stage !== 'replacement') throw new Error('unreachable');
    expect(replacement.population).toHaveLength(8);
    expect(replacement.ranking!.filter((r) => r.kept)).toHaveLength(7);
    const odd = make('penalty', { seed: 3, params: { elites: 1 }, init: { kind: 'random', size: 6 } });
    odd.forwardCycle();
    const pairs = odd.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(pairs).toHaveLength(3);
    expect(pairs[2]!.children[1]!.discarded).toBe(true);
  });

  test('children never share a chromosome array with their parents', () => {
    const run = make('decoder', { seed: 12, params: { crossover: { enabled: true, operator: 'uniform', probability: 1 } } });
    run.forwardCycle();
    const parents = run.snapshot(0).state.population.map((i) => i.chromosome);
    for (const e of run.events(1)) if (e.stage === 'crossover') for (const child of e.children) expect(parents.every((p) => p !== child.chromosome)).toBe(true);
  });
});

describe('negative fitness under roulette selection', () => {
  test('a heavy penalty gives negative fitness, and the default Identity chain switches to Shift and says why', () => {
    const run = make('penalty', { rho: 50, seed: 1, params: { selection: { method: 'roulette', chain: [{ step: 'identity' }] } } });
    expect(run.snapshot(0).state.population.some((i) => i.fitness < 0)).toBe(true);
    run.forwardCycle();
    const chain = run.events(1).find((e) => e.stage === 'selection' && e.kind === 'weight-chain');
    if (!chain || chain.stage !== 'selection' || chain.kind !== 'weight-chain') throw new Error('no weight chain');
    expect(chain.autoSwitch?.reason).toContain('Fitness is negative');
    expect(chain.weights.every((w) => w > 0)).toBe(true);
  });
});

describe('feasibility on real runs', () => {
  test.each(['decoder', 'repair-lamarckian', 'repair-baldwinian'] as const)('%s: every individual is feasible, every generation', (handling) => {
    const run = make(handling, { seed: 7 });
    run.runUntil((s) => s.cycle === 8);
    for (let c = 0; c <= 8; c++) {
      const m = metricsOf(run.snapshot(c).state, 2).feasible!;
      expect(m.count).toBe(12);
      expect(m.best).toBe(metricsOf(run.snapshot(c).state).best);
    }
  });

  test('penalty: the feasible count and bests equal counting directly, and some bags really are overweight', () => {
    const run = make('penalty', { seed: 7 });
    run.runUntil((s) => s.cycle === 8);
    let overweight = 0;
    for (let c = 0; c <= 8; c++) {
      const population = run.snapshot(c).state.population;
      const feasible = population.filter((i) => weightOf(i.chromosome) <= builtInKnapsack.capacity);
      const m = metricsOf(run.snapshot(c).state).feasible!;
      expect(m.count).toBe(feasible.length);
      expect(m.best).toBe(feasible.length ? Math.max(...feasible.map((i) => i.fitness)) : null);
      overweight += population.length - feasible.length;
    }
    expect(overweight).toBeGreaterThan(0);
  });

  test('under a penalty too small (ρ = 0) an overweight bag beats the optimum, and target-reached does not fire for it', () => {
    const run = make('penalty', { rho: 0, seed: 3, params: { elites: 1 } });
    run.runUntil((s) => s.cycle === 25);
    let beat = false;
    for (let c = 0; c <= 25; c++) {
      const state = run.snapshot(c).state;
      const feasibleBest = metricsOf(state).feasible!.bestSoFar;
      if (state.bestFitnessSoFar > 123) beat = true;
      expect(run.snapshot(c).stops.includes('target-reached')).toBe(feasibleBest !== null && feasibleBest >= 123);
    }
    expect(beat).toBe(true); // an infeasible bag scored above the known optimum
    expect(metricsOf(run.snapshot(25).state).feasible!.bestSoFar!).toBeLessThanOrEqual(123); // and nothing feasible does
  });

  test('with a sensible method the optimum can be reached, and then target-reached holds', () => {
    let reached = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const run = make('repair-lamarckian', { seed, params: { elites: 1 } });
      const result = run.runUntil((s) => s.stops.includes('target-reached'));
      if (result.reason === 'condition') {
        reached++;
        expect(metricsOf(run.snapshot(run.lastCycle).state).feasible!.bestSoFar).toBe(123);
      }
    }
    expect(reached).toBeGreaterThan(0);
  });
});

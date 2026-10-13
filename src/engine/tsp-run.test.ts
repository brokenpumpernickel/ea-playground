import { describe, expect, test } from 'vitest';
import { gaAlgorithm, populationFromEvents, type GaParams, type GaSetup } from './algorithm';
import { canonicalRoute, tourEdgeSet } from './chromosome';
import { stopReasons, startRun } from './generation';
import { metricsOfProblem } from './metrics';
import { tspInstance, tspProblem, tspDefaultEpsilon, type TspOptions } from './tsp';
import { createRng } from '../run/rng';
import { createFakeScheduler } from '../run/fake-scheduler';
import { createPlayback } from '../run/playback';
import { createRun } from '../run/run';

type Crossover = 'ox' | 'pmx' | 'cx';
type Mutation = 'swap' | 'inversion' | 'insertion';
const crossovers: readonly Crossover[] = ['ox', 'pmx', 'cx'];
const mutations: readonly Mutation[] = ['swap', 'inversion', 'insertion'];
const opts = (instance: string, n = 9, seed = 3): TspOptions => ({ instance, n, seed });
const instances: readonly TspOptions[] = [opts('circle', 8), opts('clusters'), opts('random', 9, 3), opts('burma14'), opts('ulysses16'), opts('ulysses22'), opts('att48'), opts('eil51'), opts('berlin52')];
const isPermutation = (c: readonly number[], n: number) => c.length === n && [...c].sort((a, b) => a - b).every((v, k) => v === k);

const params = (o: Partial<GaParams> = {}, crossover: Crossover = 'ox', mutation: Mutation = 'inversion'): GaParams => ({
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: crossover, probability: 0.9 },
  mutation: { enabled: true, mode: 'per-individual', probability: 0.4, operator: mutation },
  elites: 1,
  stop: { generationLimit: 60 },
  ...o,
});
const make = (options: TspOptions, o: { params?: GaParams; init?: GaSetup['init']; seed?: number; eventCacheSize?: number } = {}) =>
  createRun(gaAlgorithm, { setup: { problem: tspProblem(options), init: o.init ?? { kind: 'random', size: 12 } }, params: o.params ?? params(), seed: o.seed ?? 5 }, { eventCacheSize: o.eventCacheSize });

describe('every instance, every crossover, every mutation', () => {
  test('every individual of every generation is a permutation of the cities, scored by the tour length, and the setup and evaluation events agree', () => {
    for (const options of instances) {
      const problem = tspProblem(options);
      const n = problem.chromosomeLength;
      for (const crossover of crossovers) {
        for (const mutation of mutations) {
          const run = make(options, { params: params({}, crossover, mutation), seed: 9, init: { kind: 'random', size: 8 } });
          run.runUntil((state) => state.cycle === 5);
          for (let c = 0; c <= 5; c++) {
            for (const i of run.snapshot(c).state.population) {
              const label = `${options.instance} ${crossover} ${mutation} generation ${c}`;
              expect(isPermutation(i.chromosome, n), label).toBe(true);
              expect(i.objective, label).toBe(problem.lengthOf(i.chromosome));
              expect(i.fitness, label).toBe(0 - i.objective);
            }
          }
          for (let c = 1; c <= 5; c++) {
            for (const e of run.events(c)) {
              if (e.stage === 'evaluation') expect(isPermutation(e.individual.chromosome, n)).toBe(true);
              if (e.stage === 'crossover') for (const child of e.children) expect(isPermutation(child.chromosome, n)).toBe(true);
              if (e.stage === 'mutation') {
                expect(isPermutation(e.after, n)).toBe(true);
                expect(e.mode).toBe('per-individual');
              }
            }
          }
        }
      }
    }
  });

  test('the events say which operators ran, and a recombined pair and a mutated individual occur with the default probabilities', () => {
    for (const crossover of crossovers) {
      for (const mutation of mutations) {
        const run = make(opts('ulysses16'), { params: params({}, crossover, mutation), seed: 4 });
        run.runUntil((state) => state.cycle === 4);
        const all = [1, 2, 3, 4].flatMap((c) => run.events(c));
        const crossed = all.flatMap((e) => (e.stage === 'crossover' ? [e] : []));
        expect(crossed.every((e) => e.operator === crossover)).toBe(true);
        expect(crossed.some((e) => e.decision === 'recombined')).toBe(true);
        const mutated = all.flatMap((e) => (e.stage === 'mutation' ? [e] : []));
        expect(mutated.some((e) => e.decision === 'mutated' && e.move!.kind === mutation)).toBe(true);
      }
    }
  });
});

describe('a seeded TSP run is the same run however it is advanced', () => {
  const advance = (how: (r: ReturnType<typeof make>) => void, eventCacheSize: number, crossover: Crossover) => {
    const run = make(opts('ulysses16'), { seed: 21, eventCacheSize, params: params({}, crossover, 'insertion') });
    while (run.lastCycle < 6) how(run);
    return Array.from({ length: 7 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));
  };

  test.each(crossovers)('%s: micro-steps, stages, generations and run-until agree, and regenerated events equal live ones', (crossover) => {
    const byMicro = advance((r) => r.forwardMicro(), 0, crossover);
    expect(advance((r) => r.forwardStage(), 0, crossover)).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle(), 100, crossover)).toEqual(byMicro);
    const until = make(opts('ulysses16'), { seed: 21, eventCacheSize: 0, params: params({}, crossover, 'insertion') });
    until.runUntil((state) => state.cycle === 6);
    expect(Array.from({ length: 7 }, (_, c) => ({ snapshot: until.snapshot(c), events: until.events(c) }))).toEqual(byMicro);
  });

  test.each(['slow', 'medium', 'fast', 'maximum'] as const)('playback at the %s tier makes the identical run', (tier) => {
    const reference = make(opts('berlin52'), { seed: 21, eventCacheSize: 0 });
    while (reference.lastCycle < 6) reference.forwardCycle();
    const run = make(opts('berlin52'), { seed: 21, eventCacheSize: 0 });
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

  test('the same seed gives the same run and another seed another one', () => {
    const final = (seed: number) => {
      const run = make(opts('ulysses22'), { seed });
      run.runUntil((state) => state.cycle === 8);
      return run.snapshot(8).state.population.map((i) => i.chromosome.join(','));
    };
    expect(final(7)).toEqual(final(7));
    expect(final(7)).not.toEqual(final(8));
  });

  test('the events alone reproduce every population, with elites and truncation too', () => {
    for (const p of [params(), params({ elites: 2 }), params({ elites: 1, truncation: { enabled: true, lambda: 14 } }, 'pmx', 'swap'), params({ elites: 0 }, 'cx', 'insertion')]) {
      const run = make(opts('att48'), { seed: 8, eventCacheSize: 0, params: p });
      run.runUntil((state) => state.cycle === 8);
      for (let c = 1; c <= 8; c++) {
        expect(populationFromEvents(run.snapshot(c - 1).state.population, run.events(c))).toEqual(run.snapshot(c).state.population);
      }
    }
  });
});

describe('the operators’ switches and the usual settings', () => {
  test('crossover off and mutation off are recorded bypasses of copies; selection still runs, and with both off nothing new appears', () => {
    const run = make(opts('ulysses16'), { seed: 2, params: params({ crossover: { enabled: false, operator: 'ox', probability: 0.9 }, mutation: { enabled: false, mode: 'per-individual', probability: 0.4, operator: 'swap' } }) });
    run.forwardCycle();
    const events = run.events(1);
    const crossed = events.flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(crossed.length).toBeGreaterThan(0);
    expect(crossed.every((e) => e.decision === 'bypassed' && e.reason === 'switched-off' && !('draw' in e))).toBe(true);
    const mutated = events.flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    expect(mutated.every((e) => e.decision === 'bypassed' && e.after.join() === e.before.join())).toBe(true);
    expect(events.some((e) => e.stage === 'selection')).toBe(true);
    const parents = new Set(run.snapshot(0).state.population.map((i) => i.chromosome.join(',')));
    for (const i of run.snapshot(1).state.population) expect(parents.has(i.chromosome.join(','))).toBe(true);
  });

  test('probabilities 0 and 1: pc = 1 recombines every pair, pc = 0 none; pm = 1 mutates every individual, pm = 0 none', () => {
    const all = make(opts('ulysses22'), { seed: 6, params: params({ crossover: { enabled: true, operator: 'pmx', probability: 1 }, mutation: { enabled: true, mode: 'per-individual', probability: 1, operator: 'inversion' } }) });
    all.forwardCycle();
    expect(all.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : [])).every((e) => e.decision === 'recombined')).toBe(true);
    expect(all.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : [])).every((e) => e.decision === 'mutated')).toBe(true);
    const none = make(opts('ulysses22'), { seed: 6, params: params({ crossover: { enabled: true, operator: 'pmx', probability: 0 }, mutation: { enabled: true, mode: 'per-individual', probability: 0, operator: 'inversion' } }) });
    none.forwardCycle();
    expect(none.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : [])).every((e) => e.decision === 'bypassed' && e.reason === 'draw-failed')).toBe(true);
    expect(none.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : [])).every((e) => e.decision === 'unchanged')).toBe(true);
  });

  test('size, elites, truncation and the odd mating pool behave as for the other problems', () => {
    const run = make(opts('att48'), { seed: 4, params: params({ elites: 2 }), init: { kind: 'random', size: 9 } });
    run.runUntil((state) => state.cycle === 12);
    for (let c = 1; c <= 12; c++) {
      expect(run.snapshot(c).state.population).toHaveLength(9);
      const replacement = run.events(c).find((e) => e.stage === 'replacement')!;
      expect('elites' in replacement && replacement.elites).toHaveLength(2);
    }
    const truncated = make(opts('att48'), { seed: 6, params: params({ elites: 1, truncation: { enabled: true, lambda: 10 } }), init: { kind: 'random', size: 8 } });
    truncated.forwardCycle();
    const replacement = truncated.events(1).find((e) => e.stage === 'replacement')!;
    if (replacement.stage !== 'replacement') throw new Error('unreachable');
    expect(replacement.population).toHaveLength(8);
    expect(replacement.ranking!.filter((r) => r.kept)).toHaveLength(7);
    const odd = make(opts('att48'), { seed: 3, params: params({ elites: 1 }), init: { kind: 'random', size: 6 } });
    odd.forwardCycle();
    const pairs = odd.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(pairs).toHaveLength(3);
    expect(pairs[2]!.children[1]!.discarded).toBe(true);
  });

  test('with an elite the best of a generation never gets worse, and the best so far is the best ever scored', () => {
    for (const crossover of crossovers) {
      const run = make(opts('eil51'), { seed: 10, params: params({ elites: 1 }, crossover, 'inversion') });
      run.runUntil((state) => state.cycle === 20);
      let previous = -Infinity;
      let ever = -Infinity;
      for (let c = 0; c <= 20; c++) {
        const state = run.snapshot(c).state;
        const best = Math.max(...state.population.map((i) => i.fitness));
        expect(best, `${crossover} generation ${c}`).toBeGreaterThanOrEqual(previous);
        previous = best;
        ever = Math.max(ever, best);
        expect(state.bestFitnessSoFar).toBe(ever);
      }
    }
  });

  test('children share no chromosome array with their parents, and neither do the mutated ones', () => {
    for (const crossover of crossovers) {
      const run = make(opts('ulysses16'), { seed: 12, params: params({ crossover: { enabled: true, operator: crossover, probability: 1 }, mutation: { enabled: true, mode: 'per-individual', probability: 1, operator: 'swap' } }) });
      run.forwardCycle();
      const parents = run.snapshot(0).state.population.map((i) => i.chromosome);
      for (const e of run.events(1)) {
        if (e.stage === 'crossover') for (const child of e.children) expect(parents.every((p) => p !== child.chromosome)).toBe(true);
        if (e.stage === 'mutation') expect(parents.every((p) => p !== e.after && p !== e.before)).toBe(true);
      }
      // the elite is carried over as the very same individual; everyone else in the next population is new
      const parentIds = new Set(run.snapshot(0).state.population.map((i) => i.id));
      const fresh = run.snapshot(1).state.population.filter((i) => !parentIds.has(i.id)).map((i) => i.chromosome);
      expect(fresh).toHaveLength(11);
      expect(new Set([...parents, ...fresh]).size).toBe(parents.length + fresh.length);
    }
  });
});

describe('roulette selection with the negative fitness of a tour', () => {
  test('the untouched default Identity is switched to Shift, visibly, and the run goes on', () => {
    const run = make(opts('ulysses16'), { seed: 3, params: params({ selection: { method: 'roulette', chain: [{ step: 'identity' }] } }) });
    run.runUntil((state) => state.cycle === 5);
    for (let c = 1; c <= 5; c++) {
      const chain = run.events(c).find((e) => e.stage === 'selection' && e.kind === 'weight-chain');
      expect(chain, `generation ${c}`).toBeDefined();
      if (chain?.stage !== 'selection' || chain.kind !== 'weight-chain') throw new Error('unreachable');
      expect(chain.autoSwitch!.reason).toMatch(/^Fitness is negative \(lowest: [-−]\d+/);
      expect(chain.autoSwitch!.to).toEqual([{ step: 'shift' }]);
      expect(chain.weights.every((w) => w >= 0 && Number.isFinite(w))).toBe(true);
      expect(run.snapshot(c).state.population).toHaveLength(12);
    }
  });

  test('a chain that names Shift works, and a chain that cannot take negative fitness is refused in words, naming the missing Shift', () => {
    const shift = make(opts('ulysses16'), { seed: 3, params: params({ selection: { method: 'roulette', chain: [{ step: 'shift' }, { step: 'rank' }] } }) });
    shift.runUntil((state) => state.cycle === 3);
    expect(shift.lastCycle).toBe(3);
    const refused = make(opts('ulysses16'), { seed: 3, params: params({ selection: { method: 'roulette', chain: [{ step: 'power' }] } }) });
    expect(() => refused.forwardCycle()).toThrow(/needs non-negative values.*put a Shift step before it/);
  });
});

describe('the stops', () => {
  const best = (options: TspOptions) => tspInstance(options).optimalTour;
  const stateOf = (options: TspOptions, tours: string[]) => startRun(tspProblem(options), { kind: 'explicit', chromosomes: tours }, createRng(1)).state;
  const text = (tour: readonly number[]) => tour.map((c) => c + 1).join(' ');

  test('within ε of the optimum: a population holding the optimal tour has reached it, and one without has not', () => {
    const o = opts('berlin52');
    const problem = tspProblem(o);
    const eps = tspDefaultEpsilon(problem);
    expect(eps).toBe(0.5);
    const optimal = best(o);
    const other = tspInstance(o).nearestNeighbour.tour;
    const stop = { generationLimit: 100, targetEpsilon: eps };
    expect(stateOf(o, [text(optimal), text(other)]).bestFitnessSoFar).toBe(problem.knownOptimumFitness); // the optimal tour scores exactly −7542
    expect(stopReasons(stateOf(o, [text(optimal), text(other)]), stop, problem.knownOptimumFitness)).toEqual(['target-reached']);
    expect(stopReasons(stateOf(o, [text(other)]), stop, problem.knownOptimumFitness)).toEqual([]);
    // a tour 1 longer is not within 0.5 but is within 1.5
    const nn = stateOf(o, [text(other)]);
    const gap = problem.lengthOf(other) - tspInstance(o).optimum;
    expect(stopReasons(nn, { ...stop, targetEpsilon: gap - 0.5 }, problem.knownOptimumFitness)).toEqual([]);
    expect(stopReasons(nn, { ...stop, targetEpsilon: gap + 0.5 }, problem.knownOptimumFitness)).toEqual(['target-reached']);
  });

  test('a rotation and a reversal of the optimal tour are the optimum too', () => {
    const o = opts('ulysses22');
    const problem = tspProblem(o);
    const optimal = best(o);
    const turned = [...optimal.slice(5), ...optimal.slice(0, 5)].reverse();
    expect(canonicalRoute(turned)).toEqual(canonicalRoute(optimal));
    expect(stopReasons(stateOf(o, [text(turned)]), { generationLimit: 10, targetEpsilon: 0.5 }, problem.knownOptimumFitness)).toEqual(['target-reached']);
  });

  test('a small instance run reaches the optimum and the stop says so; the generation limit and the stagnation window report as for the other problems', () => {
    const o = opts('circle', 6);
    const problem = tspProblem(o);
    const run = make(o, { seed: 2, params: params({ stop: { generationLimit: 30, targetEpsilon: tspDefaultEpsilon(problem), stagnationWindow: 8 } }) });
    run.runUntil((state) => state.cycle === 30);
    const reached = Array.from({ length: 31 }, (_, c) => run.snapshot(c).stops.includes('target-reached'));
    expect(reached.some(Boolean)).toBe(true);
    const first = reached.indexOf(true);
    for (let c = 0; c <= 30; c++) {
      const state = run.snapshot(c).state;
      expect(reached[c], `generation ${c}`).toBe(state.bestFitnessSoFar >= problem.knownOptimumFitness - tspDefaultEpsilon(problem));
    }
    expect(first).toBeGreaterThan(0);
    expect(run.snapshot(30).stops).toContain('generation-limit');
    expect(run.snapshot(30).stops).toContain('stagnation');
  });
});

describe('the metrics of a run', () => {
  test('in every generation of a run the diversity, the distinct routes and the agreement equal a direct computation', () => {
    for (const options of [opts('ulysses16'), opts('att48')]) {
      const problem = tspProblem(options);
      const n = problem.chromosomeLength;
      const run = make(options, { seed: 17, init: { kind: 'random', size: 10 } });
      run.runUntil((state) => state.cycle === 10);
      for (let c = 0; c <= 10; c++) {
        const state = run.snapshot(c).state;
        const m = metricsOfProblem(state, problem);
        let sum = 0;
        let pairs = 0;
        for (let a = 0; a < state.population.length; a++) {
          for (let b = a + 1; b < state.population.length; b++) {
            const ea = tourEdgeSet(state.population[a]!.chromosome);
            sum += 1 - [...tourEdgeSet(state.population[b]!.chromosome)].filter((e) => ea.has(e)).length / n;
            pairs++;
          }
        }
        expect(m.diversity).toBeCloseTo(sum / pairs, 12);
        expect(m.distinct).toBe(new Set(state.population.map((i) => canonicalRoute(i.chromosome).join(','))).size);
        const bestTour = state.population.reduce((x, i) => (i.fitness > x.fitness ? i : x)).chromosome;
        expect(m.tour!.bestRoute).toEqual(bestTour);
        const edges = tourEdgeSet(bestTour);
        const count = (edge: string) => state.population.filter((i) => tourEdgeSet(i.chromosome).has(edge)).length;
        const keys = bestTour.map((city, k) => [city, bestTour[(k + 1) % n]!] as const).map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`));
        expect(keys.every((e) => edges.has(e))).toBe(true);
        expect(m.tour!.agreement).toEqual(keys.map((e) => count(e) / state.population.length));
        expect(m.tour!.agreement.every((v) => v > 0 && v <= 1)).toBe(true);
        expect(m.alleleFrequencies).toEqual([]);
      }
    }
  });

  test('asking for the metrics of a state again returns the same object', () => {
    const problem = tspProblem(opts('ulysses16'));
    const state = startRun(problem, { kind: 'random', size: 6 }, createRng(2)).state;
    expect(metricsOfProblem(state, problem)).toBe(metricsOfProblem(state, problem));
  });

  test('a population converging on one route has diversity 0 and every agreement 1', () => {
    const o = opts('ulysses16');
    const problem = tspProblem(o);
    const tour = tspInstance(o).optimalTour.map((c) => c + 1).join(' ');
    const rotated = [...tspInstance(o).optimalTour.slice(4), ...tspInstance(o).optimalTour.slice(0, 4)].reverse().map((c) => c + 1).join(' ');
    const m = metricsOfProblem(startRun(problem, { kind: 'explicit', chromosomes: [tour, rotated, tour] }, createRng(1)).state, problem);
    expect(m.diversity).toBe(0);
    expect(m.distinct).toBe(1);
    expect(m.tour!.agreement.every((v) => v === 1)).toBe(true);
  });
});

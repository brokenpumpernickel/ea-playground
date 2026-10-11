import { describe, expect, test } from 'vitest';
import { gaAlgorithm, type GaParams } from './algorithm';
import { binaryAlphabet } from './chromosome';
import { stopReasons, type RunState } from './generation';
import { goldberg } from './goldberg';
import { metricsOf } from './metrics';
import type { Problem, Scores } from './problem';
import { createRun } from '../run/run';

/** At most 3 ones are allowed; fitness is twice the ones, so an overweight chromosome out-scores every feasible one. */
const greedy = (reportFeasibility: boolean, limit = 3): Problem => ({
  chromosomeLength: 6,
  alphabet: binaryAlphabet,
  columns: [{ header: 'Score', show: (s: Scores) => String(s.fitness) }],
  evaluate(chromosome): Scores {
    const ones = chromosome.reduce((n, g) => n + g, 0);
    return { decoded: chromosome.join(''), objective: 2 * ones, fitness: 2 * ones, ...(reportFeasibility ? { feasible: ones <= limit } : {}) };
  },
});

const params: GaParams = {
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: 'one-point', probability: 0.9 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.1 },
  elites: 1,
  stop: { generationLimit: 50 },
};
const make = (problem: Problem, p: Partial<GaParams> = {}, seed = 6) =>
  createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 10 } }, params: { ...params, ...p }, seed });
const direct = (population: readonly { fitness: number; feasible?: boolean }[]) => {
  const ok = population.filter((i) => i.feasible !== false);
  return { count: ok.length, best: ok.length ? Math.max(...ok.map((i) => i.fitness)) : null };
};

describe('feasibility metrics', () => {
  const run = make(greedy(true));
  for (let g = 0; g < 10; g++) run.forwardCycle();

  test('count the feasible individuals and find the best feasible fitness, as counting directly does', () => {
    let some = 0;
    for (let g = 0; g <= 10; g++) {
      const state = run.snapshot(g).state;
      const m = metricsOf(state).feasible!;
      const d = direct(state.population);
      expect(m.count).toBe(d.count);
      expect(m.best).toBe(d.best);
      if (d.count < state.population.length) some++;
    }
    expect(some).toBeGreaterThan(0); // the run did have infeasible individuals
  });

  test('best feasible so far never decreases, equals the best feasible ever seen, and is null until one exists', () => {
    let previous = -Infinity;
    let seen: number | null = null;
    for (let g = 0; g <= 10; g++) {
      const state = run.snapshot(g).state;
      const best = direct(state.population).best;
      if (best !== null) seen = seen === null ? best : Math.max(seen, best);
      // offspring that were not kept still count as seen, so compare from the events as well
      for (const e of run.events(g)) if (e.stage === 'evaluation' && e.individual.feasible !== false) seen = seen === null ? e.individual.fitness : Math.max(seen, e.individual.fitness);
      const so = metricsOf(state).feasible!.bestSoFar;
      expect(so).toBe(seen);
      if (so !== null) {
        expect(so).toBeGreaterThanOrEqual(previous);
        previous = so;
      }
    }
  });

  test('a population with no feasible individual has none counted and nothing best', () => {
    const none = make(greedy(true, -1)); // nothing is ever feasible
    none.forwardCycle();
    const m = metricsOf(none.snapshot(1).state).feasible!;
    expect(m).toEqual({ count: 0, best: null, bestSoFar: null });
  });

  test('the original metrics are the same whether or not feasibility is reported', () => {
    const plain = make(greedy(false));
    const reporting = make(greedy(true));
    plain.forwardCycle();
    reporting.forwardCycle();
    const strip = ({ feasible: _f, ...rest }: ReturnType<typeof metricsOf>) => rest;
    expect(strip(metricsOf(reporting.snapshot(1).state))).toEqual(metricsOf(plain.snapshot(1).state));
  });

  test('problems that do not report feasibility have no feasibility in their state or metrics', () => {
    const g = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 6 } }, params, seed: 2 });
    g.forwardCycle();
    expect('feasibility' in g.snapshot(1).state).toBe(false);
    expect('feasible' in metricsOf(g.snapshot(1).state)).toBe(false);
    const plain = make(greedy(false));
    plain.forwardCycle();
    expect('feasibility' in plain.snapshot(1).state).toBe(false);
  });
});

describe('stop criteria count feasible individuals', () => {
  const state = (over: Partial<RunState>): RunState => ({ generation: 20, population: [], nextId: 1, evaluations: 0, bestFitnessSoFar: 50, lastImprovementGeneration: 19, ...over });

  test('an infeasible individual that beats the target does not reach it', () => {
    const s = state({ feasibility: { bestSoFar: 6, lastImprovement: 3 } });
    expect(stopReasons(s, { generationLimit: 100, targetFitness: 10 })).toEqual([]);
    expect(stopReasons(s, { generationLimit: 100, targetFitness: 6 })).toEqual(['target-reached']);
    expect(stopReasons(state({ feasibility: { bestSoFar: null, lastImprovement: 0 } }), { generationLimit: 100, targetFitness: -1000 })).toEqual([]);
  });

  test('stagnation counts from the last improvement of the best feasible fitness, not of the best fitness', () => {
    const s = state({ feasibility: { bestSoFar: 6, lastImprovement: 3 } });
    expect(stopReasons(s, { generationLimit: 100, stagnationWindow: 15 })).toEqual(['stagnation']); // 20 − 3 = 17, though the best fitness improved at 19
    expect(stopReasons(s, { generationLimit: 100, stagnationWindow: 18 })).toEqual([]);
  });

  test('without feasibility the criteria use the best fitness exactly as before', () => {
    const s = state({});
    expect(stopReasons(s, { generationLimit: 100, targetFitness: 50, stagnationWindow: 2 })).toEqual(['target-reached']);
    expect(stopReasons(s, { generationLimit: 100, stagnationWindow: 2 })).toEqual([]);
  });

  test('on a real run an infeasible winner never makes target-reached true, and the feasible best does', () => {
    const run = make(greedy(true), { stop: { generationLimit: 50, targetFitness: 8 } }, 9); // 8 needs 4 ones: always infeasible
    for (let g = 0; g < 25; g++) run.forwardCycle();
    expect(run.snapshot(25).state.bestFitnessSoFar).toBeGreaterThanOrEqual(8);
    for (let g = 0; g <= 25; g++) expect(run.snapshot(g).stops).not.toContain('target-reached');
    const reachable = make(greedy(true), { stop: { generationLimit: 50, targetFitness: 6 } }, 9);
    const first = reachable.runUntil((s) => s.stops.includes('target-reached'));
    expect(first.reason).toBe('condition');
    expect(metricsOf(reachable.snapshot(reachable.lastCycle).state).feasible!.bestSoFar).toBeGreaterThanOrEqual(6);
  });

  test('when every individual is feasible the stop reasons equal those of the same run without the flag, at every generation', () => {
    const stop = { generationLimit: 30, targetFitness: 10, stagnationWindow: 3 };
    const always = (flag: boolean): Problem => ({ ...greedy(false), evaluate: (c) => ({ ...greedy(false).evaluate(c), ...(flag ? { feasible: true } : {}) }) });
    const a = make(always(false), { stop }, 12);
    const b = make(always(true), { stop }, 12);
    for (let g = 0; g < 20; g++) {
      a.forwardCycle();
      b.forwardCycle();
    }
    for (let g = 0; g <= 20; g++) expect(b.snapshot(g).stops).toEqual(a.snapshot(g).stops);
  });
});

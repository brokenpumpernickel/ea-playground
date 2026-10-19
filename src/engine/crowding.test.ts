import { describe, expect, test } from 'vitest';
import { crowdingReplacement, crowdingSelect, type CrowdingPair } from './crowding';
import { runGeneration, startRun, type GenerationConfig, type GenerationEvent, type ReplacementEvent, type RunState } from './generation';
import type { Individual } from './initialize';
import { landscapeProblem, type LandscapeOptions } from './landscape';
import type { NichingConfig } from './niching';
import { scripted } from './test-support';
import { createRng } from '../run/rng';
import { populationFromEvents } from './algorithm';

const crowding: NichingConfig = { method: 'crowding', sigma: 2, alpha: 1 };
const options: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };
const problem = landscapeProblem(options);
const distance = problem.distance!;

/** An individual standing at (x, 0) with a fitness the test chooses; `parents` and `offspring` make it a child of a pair. */
const at = (id: number, x: number, fitness: number, origin: Individual['origin'] = { kind: 'initial' }): Individual => ({ id, chromosome: [x, 0], values: [x, 0], decoded: `(${x}, 0)`, objective: fitness, fitness, origin });
const child = (id: number, x: number, fitness: number, offspring: number, parentAId: number, parentBId: number): Individual =>
  at(id, x, fitness, { kind: 'offspring', generation: 1, offspring, parentAId, parentBId, recombined: true, flipped: [] });

describe('selection under deterministic crowding: every individual once, in random order', () => {
  const population = [at(1, 0, 1), at(2, 1, 1), at(3, 2, 1), at(4, 3, 1)];

  test('hand-worked: each draw picks from those not yet taken, by floor(r × the number remaining)', () => {
    // remaining [1,2,3,4]: r 0.0 → position 0 → 1; [2,3,4]: r 0.5 → 1 → 3; [2,4]: r 0.99 → 1 → 4; [2]: r 0.7 → 0 → 2
    const { pool, events } = crowdingSelect(population, 4, scripted(0.0, 0.5, 0.99, 0.7));
    expect(pool).toEqual([1, 3, 4, 2]);
    const draws = events.filter((e) => e.kind === 'draw') as { draw: number; r: number; individualId: number; extra?: boolean }[];
    expect(draws.map((d) => [d.draw, d.r, d.individualId])).toEqual([[1, 0, 1], [2, 0.5, 3], [3, 0.99, 4], [4, 0.7, 2]]);
    expect(draws.every((d) => d.extra === undefined)).toBe(true);
  });

  test('the first event says what this selection is, and every individual appears exactly once, whatever the draws', () => {
    for (const draws of [[0.9, 0.9, 0.9, 0.9], [0, 0, 0, 0], [0.3, 0.6, 0.1, 0.8]]) {
      const { pool, events } = crowdingSelect(population, 4, scripted(...draws));
      expect([...pool].sort()).toEqual([1, 2, 3, 4]);
      expect(events[0]).toMatchObject({ stage: 'selection', kind: 'crowding-setup', size: 4 });
    }
  });

  test('an odd population adds one extra parent, drawn from the whole population, and says so', () => {
    const three = population.slice(0, 3);
    const rng = scripted(0, 0, 0, 0.99);
    const { pool, events } = crowdingSelect(three, 4, rng);
    expect(pool).toHaveLength(4);
    expect(rng.used).toBe(4);
    expect(pool.slice(0, 3).sort()).toEqual([1, 2, 3]);
    expect(pool[3]).toBe(3); // floor(0.99 × 3) = position 2, whoever is there
    const extra = events.filter((e) => e.kind === 'draw').at(-1) as { extra?: boolean };
    expect(extra.extra).toBe(true);
  });

  test('uses one draw per parent, N of them (and one more for the extra parent)', () => {
    const rng = scripted(0.1, 0.2, 0.3, 0.4);
    crowdingSelect(population, 4, rng);
    expect(rng.used).toBe(4);
  });
});

describe('replacement under deterministic crowding: each child duels the nearer parent', () => {
  const duelsOf = (parents: Individual[], offspring: Individual[]) => {
    const strategy = crowdingReplacement(distance);
    return strategy.replace(parents, offspring) as unknown as { population: Individual[]; elites: number[]; duels: CrowdingPair[] };
  };

  test('hand-worked: parents at 0 and 10, children at 9 and 1: the crossed matching (total 2) beats the straight one (total 18), so child 2 duels parent A and child 1 duels parent B', () => {
    const A = at(1, 0, 0.5);
    const B = at(2, 10, 0.5);
    const c1 = child(3, 9, 0.7, 1, 1, 2); // better than B
    const c2 = child(4, 1, 0.4, 2, 1, 2); // worse than A
    const r = duelsOf([A, B], [c1, c2]);
    expect(r.duels).toHaveLength(1);
    const d = r.duels[0]!;
    expect(d.pair).toBe(1);
    expect(d.matching).toBe('crossed');
    expect(d.totals).toEqual({ straight: 18, crossed: 2 });
    expect(d.duels.map((x) => [x.childId, x.parentId, x.distance, x.winner])).toEqual([[4, 1, 1, 'parent'], [3, 2, 1, 'child']]);
    // the children take their parents' places: A stays in slot 0, child 1 replaces B in slot 1
    expect(r.population.map((i) => i.id)).toEqual([1, 3]);
    expect(r.elites).toEqual([]);
  });

  test('the straight matching when it is the nearer one, and on equal totals', () => {
    const A = at(1, 0, 0.5);
    const B = at(2, 10, 0.5);
    const r = duelsOf([A, B], [child(3, 1, 0.9, 1, 1, 2), child(4, 9, 0.9, 2, 1, 2)]);
    expect(r.duels[0]!.matching).toBe('straight');
    expect(r.population.map((i) => i.id)).toEqual([3, 4]);
    // parents at 0 and 2, children at 1 and 1: both matchings total 2; the straight one is taken
    const tie = duelsOf([at(1, 0, 0.5), at(2, 2, 0.5)], [child(3, 1, 0.9, 1, 1, 2), child(4, 1, 0.9, 2, 1, 2)]);
    expect(tie.duels[0]!.totals).toEqual({ straight: 2, crossed: 2 });
    expect(tie.duels[0]!.matching).toBe('straight');
  });

  test('a child replaces its parent only if strictly better: on a tie the parent stays, and the duel says so', () => {
    const r = duelsOf([at(1, 0, 0.5), at(2, 10, 0.5)], [child(3, 0, 0.5, 1, 1, 2), child(4, 10, 0.5, 2, 1, 2)]);
    expect(r.population.map((i) => i.id)).toEqual([1, 2]);
    expect(r.duels[0]!.duels.map((x) => x.winner)).toEqual(['parent', 'parent']);
  });

  test('a pair with only one child (the odd count\'s dropped second child) duels the nearer parent, the first on a tie', () => {
    const r = duelsOf([at(1, 0, 0.5), at(2, 10, 0.5)], [child(3, 9, 0.9, 1, 1, 2)]);
    expect(r.duels[0]!.matching).toBe('single');
    expect(r.duels[0]!.duels).toHaveLength(1);
    expect(r.duels[0]!.duels[0]).toMatchObject({ childId: 3, parentId: 2, winner: 'child' });
    expect(r.population.map((i) => i.id)).toEqual([1, 3]);
    const tie = duelsOf([at(1, 0, 0.5), at(2, 2, 0.5)], [child(3, 1, 0.9, 1, 1, 2)]);
    expect(tie.duels[0]!.duels[0]!.parentId).toBe(1);
  });

  test('when both parents are the same individual its place is contested twice: the second child duels whoever holds it now', () => {
    const A = at(1, 0, 0.5);
    const r = duelsOf([A, at(2, 10, 0.5)], [child(3, 0, 0.7, 1, 1, 1), child(4, 0, 0.6, 2, 1, 1)]);
    expect(r.duels[0]!.duels.map((x) => [x.childId, x.parentId, x.winner])).toEqual([[3, 1, 'child'], [4, 3, 'parent']]);
    expect(r.population.map((i) => i.id)).toEqual([3, 2]);
  });

  test('the population keeps its size, and no place ever gets worse', () => {
    const parents = [at(1, 0, 0.9), at(2, 5, 0.2), at(3, 8, 0.4), at(4, 9, 0.7)];
    const kids = [child(5, 6, 0.3, 1, 1, 2), child(6, 1, 0.1, 2, 1, 2), child(7, 8.5, 0.8, 3, 3, 4), child(8, 9, 0.5, 4, 3, 4)];
    const r = duelsOf(parents, kids);
    expect(r.population).toHaveLength(4);
    r.population.forEach((i, k) => expect(i.fitness).toBeGreaterThanOrEqual(parents[k]!.fitness));
  });
});

const config = (selection: GenerationConfig['selection'], elites = 1): GenerationConfig => ({
  problem,
  selection,
  crossover: { enabled: true, operator: 'blx-alpha', probability: 0.9, alpha: 0.5 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.1, sigma: 0.05 },
  elites,
  stop: { generationLimit: 100 },
  niching: crowding,
});
const tournament: GenerationConfig['selection'] = { method: 'tournament', size: 2 };
const start = (size: number, seed = 5) => {
  const rng = createRng(seed);
  return { state: startRun(problem, { kind: 'random', size }, rng).state, rng };
};
const replacementOf = (events: readonly GenerationEvent[]) => events.find((e): e is ReplacementEvent => e.stage === 'replacement')!;

describe('a generation under deterministic crowding', () => {
  test('selection is the crowding selection whatever selection method is set: no roulette, no tournaments, every individual a parent once', () => {
    for (const selection of [tournament, { method: 'roulette', chain: [{ step: 'identity' }] } as const]) {
      const { state, rng } = start(12);
      const { events } = runGeneration(state, config(selection), rng);
      const kinds = new Set(events.filter((e) => e.stage === 'selection').map((e) => (e as { kind: string }).kind));
      expect([...kinds].sort()).toEqual(['crowding-setup', 'draw']);
      const pairs = events.filter((e) => e.stage === 'pairing') as { parentAId: number; parentBId: number }[];
      const parents = pairs.flatMap((p) => [p.parentAId, p.parentBId]).sort((a, b) => a - b);
      expect(parents).toEqual(state.population.map((i) => i.id).sort((a, b) => a - b));
    }
  });

  test('the population keeps its size, N children are evaluated, elitism and truncation are ignored (even absurd values), and nobody in a place is worse than before', () => {
    const { state, rng } = start(12);
    const next = runGeneration(state, { ...config(tournament, 99), truncation: { enabled: true, lambda: 1 } }, rng);
    expect(next.state.population).toHaveLength(12);
    expect(next.state.evaluations).toBe(state.evaluations + 12);
    expect(next.events.filter((e) => e.stage === 'evaluation')).toHaveLength(12);
    next.state.population.forEach((i, k) => expect(i.fitness).toBeGreaterThanOrEqual(state.population[k]!.fitness));
    expect(replacementOf(next.events).elites).toEqual([]);
  });

  test('the replacement event names the next population, in place order, and the duels that made it, one pair record for each pair', () => {
    const { state, rng } = start(12);
    const { events } = runGeneration(state, config(tournament), rng);
    const r = replacementOf(events);
    expect(r.duels).toHaveLength(6);
    expect(r.duels!.map((d) => d.pair)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.duels!.every((d) => d.duels.length === 2)).toBe(true);
    // every place is either its old individual or a child that won a duel for it
    const winners = new Map(r.duels!.flatMap((d) => d.duels.filter((x) => x.winner === 'child').map((x) => [x.parentId, x.childId] as const)));
    r.population.forEach((id, k) => {
      const old = state.population[k]!.id;
      expect(id === old || winners.get(old) === id).toBe(true);
    });
    // the events replay to the population
    expect(populationFromEvents(state.population, events)).toEqual(runGeneration(state, config(tournament), createRngAfterStart(12)).state.population);
  });

  test('an odd population: the last pair\'s second child is dropped, N children are made, and the size is kept', () => {
    const { state, rng } = start(7);
    const { events, state: next } = runGeneration(state, config(tournament), rng);
    expect(next.population).toHaveLength(7);
    expect(events.filter((e) => e.stage === 'evaluation')).toHaveLength(7);
    const r = replacementOf(events);
    expect(r.duels).toHaveLength(4);
    expect(r.duels!.at(-1)!.duels).toHaveLength(1);
    expect(r.duels!.at(-1)!.matching).toBe('single');
  });

  test('over many generations the total fitness of the places never goes down, and the same seed gives the same run', () => {
    const run = () => {
      const { state, rng } = start(16, 3);
      let s: RunState = state;
      const totals = [s.population.reduce((t, i) => t + i.fitness, 0)];
      for (let g = 0; g < 15; g++) {
        s = runGeneration(s, config(tournament), rng).state;
        totals.push(s.population.reduce((t, i) => t + i.fitness, 0));
      }
      return { totals, ids: s.population.map((i) => i.id) };
    };
    const a = run();
    for (let k = 1; k < a.totals.length; k++) expect(a.totals[k]!).toBeGreaterThanOrEqual(a.totals[k - 1]! - 1e-12);
    expect(run()).toEqual(a);
  });

  test('is refused for a problem with no distance, in words', () => {
    const { state, rng } = start(8);
    expect(() => runGeneration(state, { ...config(tournament), problem: { ...problem, distance: undefined } }, rng)).toThrow('Deterministic crowding needs a distance between individuals, and this problem has none.');
  });
});

/** The generator as it is after the population has been drawn: the same stream a second call to `runGeneration` needs. */
function createRngAfterStart(size: number) {
  const rng = createRng(5);
  startRun(problem, { kind: 'random', size }, rng);
  return rng;
}

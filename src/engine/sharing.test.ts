import { describe, expect, test } from 'vitest';
import { landscapeProblem, type LandscapeFunction, type LandscapeOptions } from './landscape';
import { runGeneration, startRun, type GenerationConfig, type GenerationEvent, type RunState } from './generation';
import { nicheCounts, sharingKernel, type NichingConfig } from './niching';
import { createRng, type Rng } from '../run/rng';
import type { SharingEvent } from './selection';
import { tournamentSelect } from './tournament';
import { scripted } from './test-support';
import type { Individual } from './initialize';

const options = (fn: LandscapeFunction): LandscapeOptions => ({ function: fn, representation: 'real', bitsPerVariable: 10 });
const line = (...xs: number[]) => xs.map((x) => ({ values: [x, 0] as const }));
const distance = (a: { values?: readonly number[] }, b: { values?: readonly number[] }) => Math.hypot(a.values![0]! - b.values![0]!, a.values![1]! - b.values![1]!);

describe('the sharing kernel and the niche counts', () => {
  test('the kernel is 1 at no distance, falls in a straight line (α = 1) or a curve to 0 at the radius, and is 0 beyond it', () => {
    expect(sharingKernel(0, 2, 1)).toBe(1);
    expect(sharingKernel(1, 2, 1)).toBe(0.5);
    expect(sharingKernel(1, 2, 2)).toBe(0.75);
    expect(sharingKernel(2, 2, 1)).toBe(0);
    expect(sharingKernel(5, 2, 1)).toBe(0);
  });

  test('hand-worked on four points of a line at 0, 1, 3 and 3.5 with σ = 2: the pairs 0–1 and 3–3.5 share, the others are too far apart', () => {
    const pts = line(0, 1, 3, 3.5);
    // d(0,1) = 1 → 0.5; d(3, 3.5) = 0.5 → 0.75; d(1, 3) = 2 is not under σ → 0; every individual counts itself as 1
    expect(nicheCounts(pts, distance, 2, 1)).toEqual([1.5, 1.5, 1.75, 1.75]);
    // with α = 2 the kernel is 1 − (d/σ)²: 0.75 and 0.9375
    expect(nicheCounts(pts, distance, 2, 2)).toEqual([1.75, 1.75, 1.9375, 1.9375]);
  });

  test('a radius smaller than every distance gives every individual a count of 1 (no sharing), and one larger than every distance tends to the population size', () => {
    const pts = line(0, 1, 3, 3.5, 7);
    expect(nicheCounts(pts, distance, 1e-9, 1)).toEqual([1, 1, 1, 1, 1]);
    for (const m of nicheCounts(pts, distance, 1e9, 1)) expect(m).toBeCloseTo(5, 6);
  });

  test('copies at one place count each other in full: three identical individuals each have a count of 3', () => {
    expect(nicheCounts(line(2, 2, 2, 9), distance, 1, 1)).toEqual([3, 3, 3, 1]);
  });

  test('the count is at least 1 and at most the population size, for any radius', () => {
    const pts = line(0, 0.2, 0.9, 1.4, 2.2, 5);
    for (const sigma of [0.1, 0.5, 1, 3, 20]) for (const m of nicheCounts(pts, distance, sigma, 1.5)) {
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(pts.length);
    }
  });
});

const sharing: NichingConfig = { method: 'sharing', sigma: 2, alpha: 1 };
const config = (fn: LandscapeFunction, selection: GenerationConfig['selection'], niching?: NichingConfig, elites = 1): GenerationConfig => ({
  problem: landscapeProblem(options(fn)),
  selection,
  crossover: { enabled: true, operator: 'blx-alpha', probability: 0.9, alpha: 0.5 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.1, sigma: 0.05 },
  elites,
  stop: { generationLimit: 100 },
  ...(niching ? { niching } : {}),
});
const roulette: GenerationConfig['selection'] = { method: 'roulette', chain: [{ step: 'identity' }] };
const tournament: GenerationConfig['selection'] = { method: 'tournament', size: 2 };
const start = (fn: LandscapeFunction, seed = 5, size = 12) => {
  const problem = landscapeProblem(options(fn));
  const rng = createRng(seed);
  return { state: startRun(problem, { kind: 'random', size }, rng).state, rng };
};
const counting = (inner: Rng): Rng & { readonly draws: number[] } => {
  const draws: number[] = [];
  return { draws, next: () => { const r = inner.next(); draws.push(r); return r; } };
};
const sharingEvent = (events: readonly GenerationEvent[]) => events.find((e): e is SharingEvent => e.stage === 'selection' && e.kind === 'sharing');

describe('roulette selection with fitness sharing', () => {
  const { state, rng } = start('two-peaks');
  const { events } = runGeneration(state, config('two-peaks', roulette, sharing), rng);
  const e = sharingEvent(events)!;

  test('the sharing event follows the weight chain and comes before the wheel, and says what it did', () => {
    const kinds = events.filter((x) => x.stage === 'selection').map((x) => (x as { kind: string }).kind);
    expect(kinds.slice(0, 3)).toEqual(['weight-chain', 'sharing', 'probabilities']);
    expect(e.method).toBe('roulette');
    expect(e.sigma).toBe(2);
    expect(e.alpha).toBe(1);
    expect(e.individualIds).toEqual(state.population.map((i) => i.id));
    expect(e.shifted).toBe(false);
  });

  test('the niche counts are the counts of the individuals\' decoded points, the shared weights are the weights divided by them, and the wheel spins on those', () => {
    const problem = landscapeProblem(options('two-peaks'));
    expect(e.counts).toEqual(nicheCounts(state.population, problem.distance!, 2, 1));
    e.shared.forEach((s, k) => expect(s).toBeCloseTo(e.before[k]! / e.counts[k]!, 12));
    const chain = events.find((x) => x.stage === 'selection' && x.kind === 'weight-chain')!;
    expect(e.before).toEqual((chain as unknown as { weights: number[] }).weights);
    const wheel = events.find((x) => x.stage === 'selection' && x.kind === 'probabilities')! as unknown as { entries: { weight: number }[] };
    expect(wheel.entries.map((x) => x.weight)).toEqual(e.shared);
  });
});

describe('tournament selection with fitness sharing', () => {
  test('the setup says the tournaments compare shared weights, and every contestant carries its own; the winner is the highest shared weight, the lower position on a tie', () => {
    const { state, rng } = start('two-peaks');
    const { events } = runGeneration(state, config('two-peaks', tournament, sharing), rng);
    const e = sharingEvent(events)!;
    expect(e.method).toBe('tournament');
    const setup = events.find((x) => x.stage === 'selection' && x.kind === 'tournament-setup') as { comparesShared?: boolean };
    expect(setup.comparesShared).toBe(true);
    const sharedOf = new Map(e.individualIds.map((id, k) => [id, e.shared[k]!]));
    const positionOf = new Map(e.individualIds.map((id, k) => [id, k]));
    for (const t of events.filter((x) => x.stage === 'selection' && x.kind === 'tournament') as unknown as { contestants: { individualId: number; fitness: number; shared?: number }[]; winnerId: number }[]) {
      for (const c of t.contestants) expect(c.shared).toBe(sharedOf.get(c.individualId));
      const best = Math.max(...t.contestants.map((c) => c.shared!));
      const leaders = t.contestants.filter((c) => c.shared === best);
      const winner = leaders.reduce((a, c) => (positionOf.get(c.individualId)! < positionOf.get(a.individualId)! ? c : a));
      expect(t.winnerId).toBe(winner.individualId);
    }
  });

  test('a tournament compares weights that are positive: a fitness that is never negative is divided as it is, a minimised function\'s negative fitness goes through Shift first (fitness − lowest + 1)', () => {
    const a = start('two-peaks');
    const plain = sharingEvent(runGeneration(a.state, config('two-peaks', tournament, sharing), a.rng).events)!;
    expect(plain.shifted).toBe(false);
    expect(plain.before).toEqual(a.state.population.map((i) => i.fitness));
    const b = start('himmelblau');
    const shifted = sharingEvent(runGeneration(b.state, config('himmelblau', tournament, sharing), b.rng).events)!;
    expect(shifted.shifted).toBe(true);
    const lowest = Math.min(...b.state.population.map((i) => i.fitness));
    shifted.before.forEach((w, k) => expect(w).toBeCloseTo(b.state.population[k]!.fitness - lowest + 1, 12));
    for (const w of shifted.shared) expect(w).toBeGreaterThan(0);
  });

  test('sharing with roulette also works for a minimised function: its chain gives positive weights and the shared ones are positive', () => {
    const { state, rng } = start('himmelblau');
    const e = sharingEvent(runGeneration(state, config('himmelblau', roulette, sharing), rng).events)!;
    for (const w of e.shared) expect(w).toBeGreaterThan(0);
  });
});

describe('what sharing changes and what it does not', () => {
  test('the random draws are exactly those of the same run without sharing: the same number, in the same places, so the spins and the tournaments see the same r', () => {
    for (const selection of [roulette, tournament]) {
      const a = start('two-peaks', 9);
      const b = start('two-peaks', 9);
      const without = counting(a.rng);
      const withSharing = counting(b.rng);
      runGeneration(a.state, config('two-peaks', selection), without);
      runGeneration(b.state, config('two-peaks', selection, sharing), withSharing);
      expect(withSharing.draws.length).toBe(without.draws.length);
    }
    // the first draws are the selection's, and they are the same numbers
    const a = start('two-peaks', 9);
    const b = start('two-peaks', 9);
    const without = runGeneration(a.state, config('two-peaks', roulette), a.rng).events.filter((x) => x.stage === 'selection' && x.kind === 'spin') as { r: number }[];
    const withSharing = runGeneration(b.state, config('two-peaks', roulette, sharing), b.rng).events.filter((x) => x.stage === 'selection' && x.kind === 'spin') as { r: number }[];
    expect(withSharing.map((s) => s.r)).toEqual(without.map((s) => s.r));
  });

  test('niching none, and no niching at all, are the same run exactly: the same events and the same next population', () => {
    for (const selection of [roulette, tournament]) {
      const a = start('two-peaks', 11);
      const b = start('two-peaks', 11);
      const c = start('two-peaks', 11);
      const none = runGeneration(a.state, config('two-peaks', selection), a.rng);
      const off = runGeneration(b.state, config('two-peaks', selection, { method: 'none', sigma: 2, alpha: 1 }), b.rng);
      const absent = runGeneration(c.state, config('two-peaks', selection, undefined), c.rng);
      expect(off).toEqual(none);
      expect(absent).toEqual(none);
      expect(sharingEvent(off.events)).toBeUndefined();
    }
  });

  test('a seeded run with sharing is reproducible, generation after generation', () => {
    const run = () => {
      const { state, rng } = start('two-peaks', 21, 20);
      let s: RunState = state;
      const ids: number[][] = [];
      for (let g = 0; g < 8; g++) {
        const next = runGeneration(s, config('two-peaks', roulette, sharing), rng);
        s = next.state;
        ids.push(s.population.map((i) => i.id));
      }
      return { ids, final: s.population.map((i) => [i.values![0], i.values![1]]) };
    };
    expect(run()).toEqual(run());
  });

  test('the elites are the best by raw fitness, not by shared weight', () => {
    const { state, rng } = start('two-peaks', 4, 16);
    const { events } = runGeneration(state, config('two-peaks', roulette, sharing, 2), rng);
    const replacement = events.find((x) => x.stage === 'replacement') as unknown as { elites: number[] };
    const byRaw = [...state.population].sort((x, y) => y.fitness - x.fitness).slice(0, 2).map((i) => i.id);
    expect(replacement.elites).toEqual(byRaw);
  });

  test('sharing changes who is selected: with the same draws, the individuals picked are not those of the plain run (on a population with a crowded niche)', () => {
    // twelve points: ten close together on the broad hill and two on the narrow one; the crowded ones lose weight
    const problem = landscapeProblem(options('two-peaks'));
    const chromosomes = [...Array.from({ length: 10 }, (_, k) => `${-2.5 + 0.05 * k} ${-2.5}`), '3 3', '2.9 3.1'];
    const a = startRun(problem, { kind: 'explicit', chromosomes }, createRng(1));
    const plain = runGeneration(a.state, { ...config('two-peaks', roulette) }, createRng(7));
    const shared = runGeneration(a.state, { ...config('two-peaks', roulette, sharing) }, createRng(7));
    const picks = (events: readonly GenerationEvent[]) => (events.filter((x) => x.stage === 'selection' && x.kind === 'spin') as { individualId: number }[]).map((s) => s.individualId);
    const narrowIds = new Set([11, 12]);
    const narrow = (ids: number[]) => ids.filter((id) => narrowIds.has(id)).length;
    expect(narrow(picks(shared.events))).toBeGreaterThan(narrow(picks(plain.events)));
  });
});

describe('what is refused', () => {
  test('a configuration that is wrong is refused in words before anything is drawn', () => {
    const { state, rng } = start('two-peaks');
    const before = counting(rng);
    expect(() => runGeneration(state, config('two-peaks', roulette, { method: 'sharing', sigma: 0, alpha: 1 }), before)).toThrow('σ (the niche radius) must be a number greater than 0 (it is 0).');
    expect(before.draws).toEqual([]);
  });

  test('sharing on a problem with no distance is refused, and says why', () => {
    const { state, rng } = start('two-peaks');
    const noDistance = { ...config('two-peaks', roulette, sharing), problem: { ...landscapeProblem(options('two-peaks')), distance: undefined } };
    expect(() => runGeneration(state, noDistance, rng)).toThrow('Fitness sharing needs a distance between individuals, and this problem has none.');
  });
});

describe('a tournament that compares shared weights', () => {
  const individual = (id: number, fitness: number): Individual => ({ id, chromosome: [0, 0], origin: { kind: 'initial' }, decoded: 'x', objective: fitness, fitness });

  test('the better shared weight wins even when its fitness is lower: a lone modest individual beats a crowded better one', () => {
    const population = [individual(1, 1), individual(2, 0.6)]; // 1 is fitter; suppose it sits in a crowd of five and 2 stands alone
    const shared = [1 / 5, 0.6 / 1];
    const { events, pool } = tournamentSelect(population, 2, 1, scripted(0.1, 0.6), shared);
    expect(pool).toEqual([2]);
    const t = events.find((e) => e.kind === 'tournament') as unknown as { winnerId: number; contestants: { shared: number }[] };
    expect(t.winnerId).toBe(2);
    expect(t.contestants.map((c) => c.shared)).toEqual([0.2, 0.6]);
    // without the shared weights the fitter one wins
    expect(tournamentSelect(population, 2, 1, scripted(0.1, 0.6)).pool).toEqual([1]);
  });

  test('on equal shared weights the lower population position wins, and the tournament says it was a tie', () => {
    const population = [individual(1, 1), individual(2, 0.5)];
    const { events, pool } = tournamentSelect(population, 2, 1, scripted(0.6, 0.1), [0.4, 0.4]);
    expect(pool).toEqual([1]);
    expect((events.find((e) => e.kind === 'tournament') as unknown as { tieBreak: boolean }).tieBreak).toBe(true);
  });
});

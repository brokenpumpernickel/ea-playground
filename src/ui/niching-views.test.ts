import { describe, expect, test } from 'vitest';
import { gaAlgorithm, landscapeProblem, type GaEvent, type GaParams, type GaSetup, type LandscapeOptions, type NichingConfig, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { describer } from './describe';
import { displayOf } from './format';
import { replacementModel } from './outcome-models';
import { crowdingSelectionModel, pairingModel, selectionModel, tournamentModel } from './selection-models';

const options: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };
const problem = landscapeProblem(options);
// six individuals at places we know: three crowded on the broad hill, two crowded on the narrow one, one alone
const places = ['-2.5 -2.5', '-2.4 -2.5', '-2.5 -2.4', '3 3', '3.1 3', '-4 4'];
const setup: GaSetup = { problem, init: { kind: 'explicit', chromosomes: places } };
const base: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'blx-alpha', probability: 0.9, alpha: 0.5 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.1, sigma: 0.05 },
  elites: 1,
  stop: { generationLimit: 50 },
};
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const make = (niching: NichingConfig | undefined, selection: GaParams['selection'] = base.selection): GaRun => {
  const run = createRun(gaAlgorithm, { setup, params: { ...base, selection, ...(niching ? { niching } : {}) }, seed: 11 });
  run.forwardCycle();
  return run;
};
const at = (run: GaRun, stage: number, micro: number) => {
  expect(run.moveTo({ cycle: 1, stage, micro })).toBe(true);
  return run.view();
};
const sharing: NichingConfig = { method: 'sharing', sigma: 2, alpha: 1 };
const crowding: NichingConfig = { method: 'crowding', sigma: 2, alpha: 1 };
const tournament: GaParams['selection'] = { method: 'tournament', size: 2 };

describe('the selection table with fitness sharing', () => {
  const model = selectionModel(at(make(sharing), 0, 0));

  test('says it is sharing, with its radius and shape, and has the niche count and the shared weight of every row', () => {
    expect(model.sharing).toEqual({ sigma: 2, alpha: 1 });
    expect(model.rows.every((r) => r.count !== undefined && r.shared !== undefined)).toBe(true);
  });

  test('the niche counts are hand-worked from the places: 0.95 for a neighbour 0.1 away (1 − 0.1/2), 0.929… for one 0.141 away, 1 for those beyond σ', () => {
    const k = 1 - 0.1 / 2;
    const k2 = 1 - Math.hypot(0.1, 0.1) / 2;
    const counts = model.rows.map((r) => r.count!);
    expect(counts[0]).toBeCloseTo(1 + 2 * k, 12);
    expect(counts[1]).toBeCloseTo(1 + k + k2, 12);
    expect(counts[2]).toBeCloseTo(1 + k + k2, 12);
    expect(counts[3]).toBeCloseTo(1 + k, 12);
    expect(counts[4]).toBeCloseTo(1 + k, 12);
    expect(counts[5]).toBe(1);
  });

  test('the shared weight is the weight divided by the count, and the probabilities are the shared weights over their sum', () => {
    for (const r of model.rows) expect(r.shared!).toBeCloseTo(r.weight / r.count!, 12);
    const total = model.rows.reduce((t, r) => t + r.shared!, 0);
    for (const r of model.rows) expect(r.probability).toBeCloseTo(r.shared! / total, 12);
  });

  test('without sharing the rows carry no count and no shared weight, and the model is what it was', () => {
    const plain = selectionModel(at(make(undefined), 0, 0));
    expect(plain.sharing).toBeUndefined();
    expect(plain.rows.every((r) => r.count === undefined && r.shared === undefined)).toBe(true);
    const none = selectionModel(at(make({ method: 'none', sigma: 2, alpha: 1 }), 0, 0));
    expect(none).toEqual(plain);
  });
});

describe('the tournament view with fitness sharing', () => {
  const run = make(sharing, tournament);
  const entered = tournamentModel(at(run, 0, 0));

  test('says the tournaments compare shared weights and shows every individual\'s fitness, niche count and shared weight', () => {
    expect(entered.comparesShared).toBe(true);
    expect(entered.sharing!.sigma).toBe(2);
    expect(entered.sharing!.rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const r of entered.sharing!.rows) expect(r.shared).toBeCloseTo(r.weight / r.count, 12);
    expect(entered.sharing!.shifted).toBe(false);
  });

  test('a revealed tournament shows each contestant\'s shared weight and the winner has the highest', () => {
    const one = tournamentModel(at(run, 0, 1));
    const card = one.cards[0]!;
    expect(card.revealed).toBe(true);
    for (const c of card.contestants) expect(c.shared).toBeDefined();
    const best = Math.max(...card.contestants.map((c) => c.shared!));
    expect(card.contestants.find((c) => c.winner)!.shared).toBe(best);
  });

  test('without sharing a tournament compares fitness: no shared table, no shared weights', () => {
    const plain = tournamentModel(at(make(undefined, tournament), 0, 1));
    expect(plain.comparesShared).toBe(false);
    expect(plain.sharing).toBeUndefined();
    expect(plain.cards[0]!.contestants.every((c) => c.shared === undefined)).toBe(true);
  });
});

describe('the selection stage under deterministic crowding', () => {
  const run = make(crowding, tournament);
  test('on entering: every individual waits to be taken once, no draw has been made, no pool slot filled', () => {
    const m = crowdingSelectionModel(at(run, 0, 0));
    expect(m.size).toBe(6);
    expect(m.extra).toBe(false);
    expect(m.draws).toHaveLength(6);
    expect(m.draws.every((d) => !d.revealed)).toBe(true);
    expect(m.pool).toEqual([null, null, null, null, null, null]);
  });

  test('each micro-step reveals one draw: the draw, its r, how many were still waiting, the individual taken, and the pool slot it fills', () => {
    const events = run.events(1).filter((e) => e.stage === 'selection' && e.kind === 'draw') as unknown as { draw: number; r: number; individualId: number }[];
    const m = crowdingSelectionModel(at(run, 0, 3));
    expect(m.draws.filter((d) => d.revealed).map((d) => [d.draw, d.r, d.individualId, d.waiting])).toEqual(events.slice(0, 3).map((e, k) => [e.draw, e.r, e.individualId, 6 - k]));
    expect(m.draws[2]!.current).toBe(true);
    expect(m.pool).toEqual([...events.slice(0, 3).map((e) => e.individualId), null, null, null]);
    expect(m.current).toBe(3);
  });

  test('at the end every individual has been taken exactly once', () => {
    const m = crowdingSelectionModel(at(run, 0, 6));
    expect([...m.pool].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('pairing takes the pool in order, and its notes say each individual is a parent once, not that selection draws with replacement', () => {
    const m = pairingModel(at(run, 1, 0));
    expect([...m.pool].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(m.notes.join(' ')).toContain('Deterministic crowding');
    expect(m.notes.join(' ')).not.toContain('with replacement');
  });
});

describe('the replacement stage under deterministic crowding', () => {
  const run = make(crowding, tournament);
  const replacementStage = 5;
  const done = replacementModel(at(run, replacementStage, 1), { ...base, niching: crowding });

  test('before the stage is run there is nothing decided and no duel', () => {
    const early = replacementModel(at(run, replacementStage, 0), { ...base, niching: crowding });
    expect(early.revealed).toBe(false);
    expect(early.duels ?? []).toEqual([]);
  });

  test('says in its explanation what crowding did and that elites and truncation do not apply', () => {
    expect(done.explanation).toContain('Deterministic crowding');
    expect(done.explanation).toContain('strictly better');
    expect(done.explanation).not.toContain('Elitism');
  });

  test('has one record for each pair, with the duels of the engine\'s event: which child faced which parent, the distance, both fitnesses and the winner', () => {
    const event = run.events(1).find((e) => e.stage === 'replacement')! as unknown as { duels: { pair: number; matching: string; duels: { childId: number; parentId: number; distance: number; winner: string }[] }[] };
    expect(done.duels).toHaveLength(3);
    done.duels!.forEach((d, k) => {
      expect(d.pair).toBe(k + 1);
      expect(d.matching).toBe(event.duels[k]!.matching);
      expect(d.duels.map((x) => [x.childId, x.parentId, x.distance, x.winner])).toEqual(event.duels[k]!.duels.map((x) => [x.childId, x.parentId, x.distance, x.winner]));
      for (const x of d.duels) expect(typeof x.offspring).toBe('number');
    });
  });

  test('the next population says for each place whether the old individual was kept or a child took it, and the children that won are the ones marked as surviving', () => {
    const wins = done.duels!.flatMap((d) => d.duels.filter((x) => x.winner === 'child').map((x) => x.childId));
    expect(done.next.filter((n) => n.source === 'offspring').map((n) => n.id).sort()).toEqual([...wins].sort());
    expect(done.next.filter((n) => n.source === 'kept')).toHaveLength(6 - wins.length);
    expect(done.next.some((n) => n.source === 'elite')).toBe(false);
    expect(done.offspring.filter((o) => o.fate === 'survives').map((o) => o.id).sort()).toEqual([...wins].sort());
    expect(done.old.filter((o) => o.fate === 'replaced')).toHaveLength(wins.length);
  });

  test('generational replacement has no duels and no kept places, as before', () => {
    const plain = make(undefined, tournament);
    const m = replacementModel(at(plain, replacementStage, 1), { ...base, selection: tournament });
    expect(m.duels).toBeUndefined();
    expect(m.next.every((n) => n.source === 'elite' || n.source === 'offspring')).toBe(true);
  });
});

describe('the narration of the new events', () => {
  const say = describer(displayOf(problem));
  const sentences = (run: GaRun, stage: string, kind: string) => run.events(1).filter((e) => e.stage === stage && (e as { kind?: string }).kind === kind).map(say);

  test('sharing: says the radius, that each weight is divided by its niche count, and what then uses the shared weights', () => {
    expect(sentences(make(sharing), 'selection', 'sharing')).toEqual(['Fitness sharing, niche radius σ = 2: each weight is divided by its niche count, and the wheel spins on the shared weights']);
    expect(sentences(make(sharing, tournament), 'selection', 'sharing')[0]).toContain('the tournaments compare the shared weights');
    const t = sentences(make(sharing, tournament), 'selection', 'tournament-setup')[0]!;
    expect(t).toContain('compare the shared weights (weight ÷ niche count)');
    expect(sentences(make(sharing, tournament), 'selection', 'tournament')[0]).toMatch(/individual \d+ \(shared [\d.]+\) vs individual \d+ \(shared [\d.]+\)/);
  });

  test('crowding: says every individual is a parent once with no selection pressure, and each draw', () => {
    const run = make(crowding, tournament);
    expect(sentences(run, 'selection', 'crowding-setup')[0]).toBe('Deterministic crowding: every one of the 6 individuals is a parent exactly once, in random order; there is no selection pressure');
    expect(sentences(run, 'selection', 'draw')[0]).toMatch(/^Draw 1: r = [\d.]+ → individual \d+ is parent number 1$/);
  });

  test('crowding: the replacement says how many children took their parent place', () => {
    const run = make(crowding, tournament);
    const event = run.events(1).find((e) => e.stage === 'replacement') as unknown as { duels: { duels: { winner: string }[] }[] };
    const wins = event.duels.flatMap((d) => d.duels).filter((d) => d.winner === 'child').length;
    expect(sentences(run, 'replacement', 'summary')[0]).toMatch(new RegExp(`Duels: ${wins} of 6 children took the place of the parent they duelled$`));
  });
});

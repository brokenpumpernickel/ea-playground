import { describe, expect, test } from 'vitest';
import { binaryAlphabet, fitnessColumn, gaAlgorithm, goldberg, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { pairingModel, selectionModel, tournamentModel } from './selection-models';

const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const setup: GaSetup = { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] } };
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
/** A run with generation 1 already made, so its events exist to look at. */
const make = (overrides: Partial<GaParams> = {}, s: GaSetup = setup): GaRun => {
  const run = createRun(gaAlgorithm, { setup: s, params: { ...params, ...overrides }, seed: 42 });
  run.forwardCycle();
  return run;
};
const at = (run: GaRun, stage: number, micro: number) => {
  expect(run.moveTo({ cycle: 1, stage, micro })).toBe(true);
  return run.view();
};
const spinsOf = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'selection' && e.kind === 'spin' ? [e] : []));

describe('selection model (roulette)', () => {
  test('on entering the stage: the weight table is complete and no spin has been revealed', () => {
    const run = make();
    const model = selectionModel(at(run, 0, 0));

    expect(model.columns.map((c) => c.label)).toEqual(['Identity']);
    expect(model.rows.map((r) => [r.id, r.fitness, r.weight])).toEqual([
      [1, 169, 169],
      [2, 576, 576],
      [3, 64, 64],
      [4, 361, 361],
    ]);
    expect(model.rows.map((r) => r.steps)).toEqual([[169], [576], [64], [361]]);
    expect(model.rows.map((r) => r.probability.toFixed(3))).toEqual(['0.144', '0.492', '0.055', '0.309']);
    expect(model.spins.every((s) => !s.revealed)).toBe(true);
    expect(model.spins).toHaveLength(4);
    expect(model.pool).toEqual([null, null, null, null]);
    expect(model.current).toBeUndefined();
  });

  test('intervals follow one another and end at 1', () => {
    const { rows } = selectionModel(at(make(), 0, 0));
    rows.slice(1).forEach((row, k) => expect(row.lo).toBe(rows[k]!.hi));
    expect(rows[0]!.lo).toBe(0);
    expect(rows.at(-1)!.hi).toBeCloseTo(1, 12);
  });

  test('each micro-step reveals one spin: its draw, where it landed, the pool slot it fills and the row it highlights', () => {
    const run = make();
    const engineSpins = spinsOf(run);
    for (let k = 1; k <= engineSpins.length; k++) {
      const model = selectionModel(at(run, 0, k));
      expect(model.spins.filter((s) => s.revealed)).toHaveLength(k);
      expect(model.spins[k - 1]).toMatchObject({ spin: k, r: engineSpins[k - 1]!.r, individualId: engineSpins[k - 1]!.individualId, revealed: true, current: true });
      expect(model.current).toBe(k);
      expect(model.pool.slice(0, k)).toEqual(engineSpins.slice(0, k).map((s) => s.individualId));
      expect(model.pool.slice(k).every((p) => p === null)).toBe(true);
      expect(model.rows.filter((r) => r.highlighted).map((r) => r.id)).toEqual([engineSpins[k - 1]!.individualId]);
      if (k > 1) expect(model.spins[k - 2]!.current).toBe(false);
    }
  });

  test('the full pool equals the engine’s pool', () => {
    const run = make();
    const engine = spinsOf(run).map((s) => s.individualId);
    expect(selectionModel(at(run, 0, engine.length)).pool).toEqual(engine);
  });

  test('every step of a longer chain gets its own column, with its parameters named', () => {
    const run = make({ selection: { method: 'roulette', chain: [{ step: 'rank' }, { step: 'linear-ranking', pressure: 1.8 }] } });
    const model = selectionModel(at(run, 0, 0));
    expect(model.columns.map((c) => [c.label, c.params])).toEqual([
      ['Rank', ''],
      ['Linear ranking', 's = 1.8'],
    ]);
    expect(model.rows.map((r) => r.steps[0])).toEqual([2, 4, 1, 3]); // ranks of 169, 576, 64, 361
    expect(model.rows.every((r) => r.steps.length === 2)).toBe(true);
    expect(model.rows.map((r) => r.weight)).toEqual(model.rows.map((r) => r.steps[1]));
  });

  test('an automatic switch to Shift is reported with its reason, and there is none otherwise', () => {
    expect(selectionModel(at(make(), 0, 0)).autoSwitch).toBeUndefined();
    const negative = { chromosomeLength: 5, alphabet: binaryAlphabet, columns: [fitnessColumn], evaluate: (c: readonly number[]) => ({ decoded: 0, objective: 0, fitness: c.reduce((n, b) => n + b, 0) - 3 }) };
    const run = make({}, { problem: negative, init: { kind: 'explicit', chromosomes: ['00000', '11111', '01010', '10000'] } });
    const model = selectionModel(at(run, 0, 0));
    expect(model.autoSwitch).toContain('Fitness is negative');
    expect(model.columns.map((c) => c.label)).toEqual(['Shift']);
    expect(model.columns[0]!.params).toBe('ε = 1');
  });
});

describe('tournament model', () => {
  const tournament = () => make({ selection: { method: 'tournament', size: 2 } });

  test('on entering: the size is known, no tournament is revealed, and the chain is not used', () => {
    const model = tournamentModel(at(tournament(), 0, 0));
    expect(model.size).toBe(2);
    expect(model.cards).toHaveLength(4);
    expect(model.cards.every((c) => !c.revealed)).toBe(true);
    expect(model.pool).toEqual([null, null, null, null]);
  });

  test('each micro-step reveals one tournament with its contestants, chromosomes, fitness and winner', () => {
    const run = tournament();
    const engine = run.events(1).flatMap((e) => (e.stage === 'selection' && e.kind === 'tournament' ? [e] : []));
    for (let k = 1; k <= engine.length; k++) {
      const model = tournamentModel(at(run, 0, k));
      const card = model.cards[k - 1]!;
      expect(card.revealed).toBe(true);
      expect(card.current).toBe(true);
      expect(card.contestants.map((c) => [c.id, c.fitness])).toEqual(engine[k - 1]!.contestants.map((c) => [c.individualId, c.fitness]));
      expect(card.winnerId).toBe(engine[k - 1]!.winnerId);
      expect(card.contestants.filter((c) => c.winner).length).toBeGreaterThanOrEqual(1);
      expect(model.pool.slice(0, k)).toEqual(engine.slice(0, k).map((t) => t.winnerId));
      expect(model.cards.slice(k).every((c) => !c.revealed && c.contestants.length === 0)).toBe(true);
    }
  });

  test('contestants carry their chromosome from the parents, and a tie-break is flagged', () => {
    const tied: GaSetup = { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01000', '11000', '01000', '11000'] } };
    const run = make({ selection: { method: 'tournament', size: 4 } }, tied); // four contestants will often tie at the top
    const model = tournamentModel(at(run, 0, 4));
    const bits = new Map([[1, '01000'], [2, '11000'], [3, '01000'], [4, '11000']]);
    for (const card of model.cards) for (const c of card.contestants) expect(c.bits).toBe(bits.get(c.id));
    expect(model.cards.some((c) => c.tieBreak)).toBe(true);
  });
});

describe('pairing model', () => {
  test('the pool is complete, equals the selection result, and pairs are revealed one per micro-step', () => {
    const run = make();
    const pool = spinsOf(run).map((s) => s.individualId);
    const entered = pairingModel(at(run, 1, 0));
    expect(entered.pool).toEqual(pool);
    expect(entered.pairs).toHaveLength(2);
    expect(entered.pairs.every((p) => !p.revealed)).toBe(true);

    const first = pairingModel(at(run, 1, 1));
    expect(first.pairs[0]).toMatchObject({ pair: 1, slotA: 1, slotB: 2, revealed: true, current: true });
    expect(first.pairs[0]!.a.id).toBe(pool[0]);
    expect(first.pairs[0]!.b.id).toBe(pool[1]);
    expect(first.pairs[1]!.revealed).toBe(false);

    const both = pairingModel(at(run, 1, 2));
    expect(both.pairs.map((p) => [p.a.id, p.b.id])).toEqual([[pool[0], pool[1]], [pool[2], pool[3]]]);
    expect(both.pairs[0]!.current).toBe(false);
    expect(both.pairs[1]!.current).toBe(true);
  });

  test('parents show their chromosome and decoded value', () => {
    const run = make();
    const model = pairingModel(at(run, 1, 2));
    const lookup = new Map<number, readonly [string, number]>([[1, ['01101', 13]], [2, ['11000', 24]], [3, ['01000', 8]], [4, ['10011', 19]]]);
    for (const p of model.pairs) for (const side of [p.a, p.b]) expect([side.bits, side.x]).toEqual(lookup.get(side.id));
  });

  test('notes group individuals by how often they were selected, and say who was never selected', () => {
    const run = make();
    const model = pairingModel(at(run, 1, 2));
    const pool = model.pool;
    const joined = model.notes.join(' ');
    const idsPattern = (id: number) => String.raw`Individuals? [\d, and]*\b${id}\b[\d, and]*`;
    for (const id of [1, 2, 3, 4]) {
      const n = pool.filter((p) => p === id).length;
      if (n > 1) expect(joined).toMatch(new RegExp(`${idsPattern(id)} (was|were) selected ${n} times`));
      if (n === 0) expect(joined).toMatch(new RegExp(`${idsPattern(id)} (was|were) never selected`));
    }
    // one note per distinct count, never one per individual
    const repeatedCounts = new Set([1, 2, 3, 4].map((id) => pool.filter((p) => p === id).length).filter((n) => n > 1));
    expect(model.notes.filter((n) => n.includes('selected') && !n.includes('never') && !n.includes('Odd'))).toHaveLength(repeatedCounts.size);
  });

  test('an odd offspring count draws an extra parent and notes that the last pair’s second child will be dropped', () => {
    const run = make({ elites: 1 }); // three offspring, so four parents
    const model = pairingModel(at(run, 1, 2));
    expect(model.pairs[1]!.secondChildDropped).toBe(true);
    expect(model.notes.join(' ')).toContain('second child of the last pair will be dropped');
  });
});

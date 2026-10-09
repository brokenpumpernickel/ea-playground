import { describe, expect, test } from 'vitest';
import { formatBits, gaAlgorithm, goldberg, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { evaluationModel, replacementModel } from './outcome-models';

const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.3 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const setup: GaSetup = { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] } };
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;

const make = (overrides: Partial<GaParams> = {}) => {
  const p = { ...params, ...overrides };
  const run: GaRun = createRun(gaAlgorithm, { setup, params: p, seed: 42 });
  run.forwardCycle();
  return { run, p };
};
const at = (run: GaRun, stage: string, micro: number) => {
  const index = run.layout(1).findIndex((s) => s.stage === stage);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(run.moveTo({ cycle: 1, stage: index, micro })).toBe(true);
  return run.view();
};
const evaluated = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
const replacement = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'replacement' ? [e] : []))[0]!;

describe('evaluation model', () => {
  test('on entering the stage every offspring is waiting, showing the chromosome mutation left', () => {
    const { run } = make();
    const model = evaluationModel(at(run, 'evaluation', 0));
    const mutated = run.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    expect(model.rows).toHaveLength(mutated.length);
    expect(model.rows.every((r) => !r.revealed && r.fitness === undefined)).toBe(true);
    model.rows.forEach((r, k) => expect(r.bits).toBe(formatBits(mutated[k]!.after)));
  });

  test('each micro-step scores one offspring: x, objective, fitness and the new individual id, as the engine recorded', () => {
    const { run } = make();
    const engine = evaluated(run);
    for (let micro = 1; micro <= engine.length; micro++) {
      const model = evaluationModel(at(run, 'evaluation', micro));
      expect(model.rows.filter((r) => r.revealed)).toHaveLength(micro);
      const row = model.rows[micro - 1]!;
      const i = engine[micro - 1]!.individual;
      expect(row).toMatchObject({ offspring: engine[micro - 1]!.offspring, id: i.id, bits: formatBits(i.chromosome), decoded: i.decoded, objective: i.objective, fitness: i.fitness, current: true });
      expect(model.rows.filter((r) => r.current)).toHaveLength(1);
    }
  });

  test('the genes mutation flipped are carried along so the row can mark them', () => {
    const { run } = make();
    const model = evaluationModel(at(run, 'evaluation', evaluated(run).length));
    model.rows.forEach((r, k) => {
      const origin = evaluated(run)[k]!.individual.origin;
      expect(r.flipped).toEqual(origin.kind === 'offspring' ? origin.flipped : []);
    });
    expect(model.rows.some((r) => r.flipped.length > 0)).toBe(true);
  });
});

describe('replacement model', () => {
  test('before the replacement step it shows the old population and the scored offspring but no verdicts', () => {
    const { run, p } = make({ elites: 1 });
    const model = replacementModel(at(run, 'replacement', 0), p);
    expect(model.revealed).toBe(false);
    expect(model.old.map((o) => o.id)).toEqual(run.snapshot(0).state.population.map((i) => i.id));
    expect(model.old.every((o) => o.fate === undefined)).toBe(true);
    expect(model.offspring).toHaveLength(evaluated(run).length);
    expect(model.offspring.every((o) => o.fate === undefined)).toBe(true);
    expect(model.next).toEqual([]);
    expect(model.explanation).toContain('1 elite');
  });

  test('without elites or truncation every offspring survives and no old individual is carried over', () => {
    const { run, p } = make();
    const model = replacementModel(at(run, 'replacement', 1), p);
    expect(model.revealed).toBe(true);
    expect(model.old.every((o) => o.fate === 'replaced')).toBe(true);
    expect(model.offspring.every((o) => o.fate === 'survives')).toBe(true);
    expect(model.next.map((n) => n.id)).toEqual(replacement(run).population);
    expect(model.next.every((n) => n.source === 'offspring')).toBe(true);
    expect(model.explanation).toContain('No elitism');
  });

  test('elites are the best old individuals, carried over first and unchanged', () => {
    const { run, p } = make({ elites: 2 });
    const model = replacementModel(at(run, 'replacement', 1), p);
    const event = replacement(run);
    expect(event.elites).toHaveLength(2);
    expect(model.old.filter((o) => o.fate === 'elite').map((o) => o.id).sort()).toEqual([...event.elites].sort());
    expect(model.old.filter((o) => o.fate === 'replaced')).toHaveLength(2);
    expect(model.next.map((n) => n.id)).toEqual(event.population);
    expect(model.next.filter((n) => n.source === 'elite').map((n) => n.id)).toEqual([...event.elites]);
    // every displayed new individual carries the chromosome and fitness the engine's final state has
    const state = run.snapshot(1).state.population;
    model.next.forEach((n, k) => expect(n).toMatchObject({ bits: formatBits(state[k]!.chromosome), fitness: state[k]!.fitness }));
  });

  test('with truncation the discarded offspring say which rank they got and why they lost', () => {
    const { run, p } = make({ elites: 1, truncation: { enabled: true, lambda: 6 } });
    const model = replacementModel(at(run, 'replacement', 1), p);
    const ranking = replacement(run).ranking!;
    expect(model.offspring).toHaveLength(6);
    const discarded = model.offspring.filter((o) => o.fate === 'discarded');
    expect(discarded).toHaveLength(ranking.filter((r) => !r.kept).length);
    expect(discarded.length).toBeGreaterThan(0);
    for (const row of model.offspring) {
      const r = ranking.find((x) => x.individualId === row.id)!;
      expect(row.rank).toBe(r.rank);
      expect(row.fate).toBe(r.kept ? 'survives' : 'discarded');
    }
    for (const row of discarded) expect(row.note).toContain(`rank ${row.rank} of 6`);
    expect(discarded[0]!.note).toContain('best 3');
    expect(model.explanation).toContain('λ = 6');
    // survivors enter the next population best first, after the elite
    expect(model.next.map((n) => n.id)).toEqual(replacement(run).population);
    expect(model.next.slice(1).map((n) => n.source)).toEqual(['offspring', 'offspring', 'offspring']);
  });

  test('a tie at the cut is named, since the earlier-made offspring ranks first', () => {
    // two identical selections of a 4-individual population make equal fitness likely; search seeds for a boundary tie
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      const p: GaParams = { ...params, elites: 0, truncation: { enabled: true, lambda: 8 }, mutation: { enabled: false, mode: 'per-gene', probability: 0 } };
      const run: GaRun = createRun(gaAlgorithm, { setup, params: p, seed });
      run.forwardCycle();
      const ranking = replacement(run).ranking!;
      const room = 4;
      const fitnessOf = (id: number) => run.events(1).flatMap((e) => (e.stage === 'evaluation' && e.individual.id === id ? [e.individual.fitness] : []))[0]!;
      if (fitnessOf(ranking[room - 1]!.individualId) !== fitnessOf(ranking[room]!.individualId)) continue;
      found = true;
      const model = replacementModel(at(run, 'replacement', 1), p);
      const kept = model.offspring.find((o) => o.id === ranking[room - 1]!.individualId)!;
      const lost = model.offspring.find((o) => o.id === ranking[room]!.individualId)!;
      expect(kept.note).toContain('tie');
      expect(lost.note).toContain('tie');
      expect(lost.note).toContain('made earlier');
    }
    expect(found).toBe(true);
  });
});

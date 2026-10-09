import { describe, expect, test } from 'vitest';
import { formatBits, gaAlgorithm, goldberg, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { crossoverModel, mutationModel } from './variation-models';

const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const setup: GaSetup = { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] } };
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;

/** A run with generation 1 made, plus the parameters it was made with. */
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
const crossoverEvents = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
const mutationEvents = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));

describe('crossover model', () => {
  test('on entering the stage every pair is waiting, its parents are known, and the explanation names pc and the operator', () => {
    const { run, p } = make();
    const model = crossoverModel(at(run, 'crossover', 0), p.crossover);
    expect(model.pairs).toHaveLength(2);
    expect(model.pairs.every((pair) => !pair.revealed && pair.children.length === 0)).toBe(true);
    expect(model.explanation).toContain('one-point');
    expect(model.explanation).toContain('u < pc (0.8)');
    const pairing = run.events(1).flatMap((e) => (e.stage === 'pairing' ? [e] : []));
    model.pairs.forEach((pair, k) => {
      expect(pair.parentA.id).toBe(pairing[k]!.parentAId);
      expect(pair.parentB.id).toBe(pairing[k]!.parentBId);
      expect(pair.parentA.bits).toHaveLength(5);
    });
  });

  test('each micro-step reveals one pair: its draw, decision, cuts, and both children with their inheritance, equal to the engine’s', () => {
    const { run, p } = make();
    const engine = crossoverEvents(run);
    for (let k = 1; k <= engine.length; k++) {
      const model = crossoverModel(at(run, 'crossover', k), p.crossover);
      const pair = model.pairs[k - 1]!;
      const event = engine[k - 1]!;
      expect(model.pairs.filter((x) => x.revealed)).toHaveLength(k);
      expect(pair).toMatchObject({ pair: k, revealed: true, current: true, decision: event.decision });
      expect(pair.draw).toEqual(event.draw);
      expect(pair.cuts).toEqual(event.cuts ?? []);
      expect(pair.children.map((c) => [c.offspring, c.bits, c.sources.join(''), c.discarded])).toEqual(
        event.children.map((c) => [c.offspring, formatBits(c.chromosome), c.sources.join(''), c.discarded]),
      );
    }
  });

  test('probability 1: every pair recombines; its children are marked as recombined', () => {
    const { run, p } = make({ crossover: { enabled: true, operator: 'one-point', probability: 1 } });
    const model = crossoverModel(at(run, 'crossover', 2), p.crossover);
    for (const pair of model.pairs) {
      expect(pair.decision).toBe('recombined');
      expect(pair.cuts).toHaveLength(1);
      expect(pair.children.every((c) => c.origin === 'recombined')).toBe(true);
    }
  });

  test('a pair that fails its draw is a bypass: copies of parent A and parent B, with the reason', () => {
    const { run, p } = make({ crossover: { enabled: true, operator: 'one-point', probability: 0 } });
    const model = crossoverModel(at(run, 'crossover', 2), p.crossover);
    for (const pair of model.pairs) {
      expect(pair).toMatchObject({ decision: 'bypassed', reason: 'draw-failed' });
      expect(pair.draw!.u).toBeGreaterThanOrEqual(0);
      expect(pair.children.map((c) => [c.bits, c.origin])).toEqual([[pair.parentA.bits, 'copy of A'], [pair.parentB.bits, 'copy of B']]);
      expect(pair.cuts).toEqual([]);
    }
  });

  test('with crossover switched off every pair is still shown, as a bypass with no draw', () => {
    const { run, p } = make({ crossover: { enabled: false, operator: 'one-point', probability: 0.8 } });
    const entered = crossoverModel(at(run, 'crossover', 0), p.crossover);
    expect(entered.enabled).toBe(false);
    expect(entered.explanation).toContain('switched off');
    expect(entered.explanation).toContain('copies of the parents');
    const model = crossoverModel(at(run, 'crossover', 2), p.crossover);
    for (const pair of model.pairs) {
      expect(pair).toMatchObject({ decision: 'bypassed', reason: 'switched-off' });
      expect(pair.draw).toBeUndefined();
      expect(pair.children.map((c) => c.origin)).toEqual(['copy of A', 'copy of B']);
    }
  });

  test('two-point crossover has two cuts, and uniform has none but lists the genes taken from the other parent', () => {
    const two = make({ crossover: { enabled: true, operator: 'two-point', probability: 1 } });
    const twoModel = crossoverModel(at(two.run, 'crossover', 2), two.p.crossover);
    for (const pair of twoModel.pairs) expect(pair.cuts).toHaveLength(2);

    const uniform = make({ crossover: { enabled: true, operator: 'uniform', probability: 1 } });
    const model = crossoverModel(at(uniform.run, 'crossover', 2), uniform.p.crossover);
    expect(model.explanation).toContain('uniform');
    for (const pair of model.pairs) {
      expect(pair.cuts).toEqual([]);
      const fromB = pair.children[0]!.sources.flatMap((s, g) => (s === 'B' ? [g + 1] : []));
      expect(pair.swapped).toEqual(fromB);
    }
  });

  test('an odd offspring count: the last pair’s second child is marked as dropped', () => {
    const { run, p } = make({ elites: 1 }); // three offspring, so four parents
    const model = crossoverModel(at(run, 'crossover', 2), p.crossover);
    expect(model.pairs[1]!.secondChildDropped).toBe(true);
    expect(model.pairs[1]!.children.map((c) => c.discarded)).toEqual([false, true]);
    expect(model.pairs[0]!.secondChildDropped).toBe(false);
  });
});

describe('mutation model', () => {
  test('on entering the stage every offspring is waiting, with its chromosome as crossover left it', () => {
    const { run, p } = make();
    const model = mutationModel(at(run, 'mutation', 0), p.mutation);
    const children = crossoverEvents(run).flatMap((e) => e.children).filter((c) => !c.discarded);
    expect(model.rows).toHaveLength(children.length);
    expect(model.rows.map((r) => [r.offspring, r.before])).toEqual(children.map((c) => [c.offspring, formatBits(c.chromosome)]));
    expect(model.rows.every((r) => !r.revealed && r.after === undefined)).toBe(true);
    expect(model.geneCount).toBe(5);
    expect(model.explanation).toContain('u < pm (0.05)');
  });

  test('each micro-step reveals one offspring with every gene’s draw, which genes flipped, and the final chromosome, equal to the engine’s', () => {
    const { run, p } = make({ mutation: { enabled: true, mode: 'per-gene', probability: 0.3 } });
    const engine = mutationEvents(run);
    for (let k = 1; k <= engine.length; k++) {
      const model = mutationModel(at(run, 'mutation', k), p.mutation);
      const row = model.rows[k - 1]!;
      const event = engine[k - 1]!;
      expect(row).toMatchObject({ offspring: event.offspring, revealed: true, current: true, decision: event.decision });
      expect(row.after).toBe(formatBits(event.after));
      expect(row.before).toBe(formatBits(event.before));
      expect(row.flipped).toEqual(event.flipped);
      expect(row.geneDraws).toEqual(event.geneDraws);
      expect(model.rows.slice(k).every((r) => !r.revealed)).toBe(true);
    }
  });

  test('per-individual mode shows the individual draw and the chosen gene instead of per-gene draws', () => {
    const { run, p } = make({ mutation: { enabled: true, mode: 'per-individual', probability: 1 } });
    const engine = mutationEvents(run);
    const model = mutationModel(at(run, 'mutation', engine.length), p.mutation);
    expect(model.mode).toBe('per-individual');
    expect(model.explanation).toContain('one more draw picks the single gene');
    model.rows.forEach((row, k) => {
      expect(row.geneDraws).toBeUndefined();
      expect(row.individualDraw).toBe(engine[k]!.individualDraw!.u);
      expect(row.chosenGene).toEqual(engine[k]!.chosenGene);
      expect(row.flipped).toEqual([engine[k]!.chosenGene!.gene]);
    });
  });

  test('with mutation switched off every offspring is shown as a bypass: unchanged, with no draws', () => {
    const { run, p } = make({ mutation: { enabled: false, mode: 'per-gene', probability: 0.05 } });
    const entered = mutationModel(at(run, 'mutation', 0), p.mutation);
    expect(entered.enabled).toBe(false);
    expect(entered.explanation).toContain('switched off');
    const model = mutationModel(at(run, 'mutation', entered.rows.length), p.mutation);
    for (const row of model.rows) {
      expect(row).toMatchObject({ decision: 'bypassed', flipped: [] });
      expect(row.after).toBe(row.before);
      expect(row.geneDraws).toBeUndefined();
    }
  });

  test('the explanation names pm and the mode', () => {
    const { run, p } = make({ mutation: { enabled: true, mode: 'per-gene', probability: 0.25 } });
    const model = mutationModel(at(run, 'mutation', 0), p.mutation);
    expect(model.threshold).toBe(0.25);
    expect(model.explanation).toContain('Every gene of every offspring gets its own draw');
    expect(model.explanation).toContain('u < pm (0.25)');
  });
});

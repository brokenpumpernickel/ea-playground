import { describe, expect, test } from 'vitest';
import { gaAlgorithm, goldberg, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { atCycleEnd, populationTable } from './population';

const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const setup: GaSetup = { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] } };
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const make = (overrides: Partial<GaParams> = {}): GaRun =>
  createRun(gaAlgorithm, { setup, params: { ...params, ...overrides }, seed: 42 });
const table = (run: GaRun) => populationTable(run.view(), atCycleEnd(run.layout(run.cursor.cycle), run.cursor));
const to = (run: GaRun, cycle: number, stage: number, micro: number) => expect(run.moveTo({ cycle, stage, micro })).toBe(true);

describe('the initial population (cycle 0)', () => {
  test('shows the scored population, with no selection information yet', () => {
    const run = make();
    const t = table(run);
    expect(t.title).toBe('Population · generation 0');
    expect(t.rows.map((r) => [r.id, r.chromosome, r.decoded, r.fitness])).toEqual([
      [1, '01101', 13, 169],
      [2, '11000', 24, 576],
      [3, '01000', 8, 64],
      [4, '10011', 19, 361],
    ]);
    for (const row of t.rows) {
      expect(row.weight).toBeUndefined();
      expect(row.probability).toBeUndefined();
      expect(row.parentCount).toBeUndefined();
      expect(row.elite).toBe(false);
    }
  });
});

describe('inside a generation: the parents', () => {
  test('the title says whose population this is, and the rows are the generation’s starting population', () => {
    const run = make();
    run.forwardCycle();
    to(run, 1, 0, 0);
    const t = table(run);
    expect(t.title).toBe('Parents · generation 0');
    expect(t.rows.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  test('weights and probabilities come from the selection events, once the stage is entered', () => {
    const run = make();
    run.forwardCycle();
    to(run, 1, 0, 0);
    const t = table(run);
    expect(t.rows.map((r) => r.weight)).toEqual([169, 576, 64, 361]);
    expect(t.rows.map((r) => r.probability!.toFixed(3))).toEqual(['0.144', '0.492', '0.055', '0.309']);
  });

  test('parent counts appear as spins are revealed, and add up to the pool', () => {
    const run = make();
    run.forwardCycle();
    to(run, 1, 0, 0);
    expect(table(run).rows.every((r) => r.parentCount === undefined)).toBe(true);

    const spins = run.events(1).flatMap((e) => (e.stage === 'selection' && e.kind === 'spin' ? [e.individualId] : []));
    for (let k = 1; k <= spins.length; k++) {
      to(run, 1, 0, k);
      const counts = table(run).rows.map((r) => r.parentCount);
      const expected = [1, 2, 3, 4].map((id) => spins.slice(0, k).filter((s) => s === id).length);
      expect(counts).toEqual(expected);
    }
    expect(table(run).rows.reduce((n, r) => n + (r.parentCount ?? 0), 0)).toBe(4);
  });

  test('later stages keep the parents on show, with their final counts', () => {
    const run = make();
    run.forwardCycle();
    to(run, 1, 2, 1); // crossover, first pair
    const t = table(run);
    expect(t.title).toBe('Parents · generation 0');
    expect(t.rows.reduce((n, r) => n + (r.parentCount ?? 0), 0)).toBe(4);
  });

  test('tournaments count wins as parents, and there are no weights or probabilities', () => {
    const run = make({ selection: { method: 'tournament', size: 2 } });
    run.forwardCycle();
    to(run, 1, 0, 4);
    const t = table(run);
    expect(t.rows.reduce((n, r) => n + (r.parentCount ?? 0), 0)).toBe(4);
    for (const row of t.rows) {
      expect(row.weight).toBeUndefined();
      expect(row.probability).toBeUndefined();
    }
  });
});

describe('when a generation is complete: the new population', () => {
  test('the table switches to the population just made, with the generation number', () => {
    const run = make();
    run.forwardCycle();
    expect(atCycleEnd(run.layout(1), run.cursor)).toBe(true);
    const t = table(run);
    expect(t.title).toBe('Population · generation 1');
    expect(t.rows.map((r) => r.id)).toEqual(run.snapshot(1).state.population.map((i) => i.id));
    expect(t.rows.map((r) => r.fitness)).toEqual(run.snapshot(1).state.population.map((i) => i.fitness));
    for (const row of t.rows) expect(row.weight).toBeUndefined();
  });

  test('elites are marked with ★, and only at the end, when the replacement is known', () => {
    const run = make({ elites: 2 });
    run.forwardCycle();
    const t = table(run);
    const elites = run.events(1).flatMap((e) => (e.stage === 'replacement' ? [...e.elites] : []));
    expect(elites).toHaveLength(2);
    expect(t.rows.filter((r) => r.elite).map((r) => r.id)).toEqual(elites);

    const evaluation = run.layout(1).findIndex((stage) => stage.stage === 'evaluation');
    to(run, 1, evaluation, run.layout(1)[evaluation]!.micros); // evaluation done, replacement not yet
    expect(table(run).rows.some((r) => r.elite)).toBe(false);
  });

  test('at the start of the next generation the new population becomes the parents', () => {
    const run = make();
    run.forwardCycle();
    run.forwardCycle();
    to(run, 2, 0, 0);
    const t = table(run);
    expect(t.title).toBe('Parents · generation 1');
    expect(t.rows.map((r) => r.id)).toEqual(run.snapshot(1).state.population.map((i) => i.id));
  });
});

describe('knowing where a generation ends', () => {
  test('only the last position of the last stage is the end', () => {
    const run = make();
    run.forwardCycle();
    const layout = run.layout(1);
    const last = layout.length - 1;
    expect(atCycleEnd(layout, { cycle: 1, stage: last, micro: layout[last]!.micros })).toBe(true);
    expect(atCycleEnd(layout, { cycle: 1, stage: last, micro: 0 })).toBe(false);
    expect(atCycleEnd(layout, { cycle: 1, stage: 0, micro: layout[0]!.micros })).toBe(false);
  });

  test('cycle 0 has one stage, whose last micro-step is its end', () => {
    const run = make();
    expect(atCycleEnd(run.layout(0), { cycle: 0, stage: 0, micro: 4 })).toBe(true);
    expect(atCycleEnd(run.layout(0), { cycle: 0, stage: 0, micro: 3 })).toBe(false);
  });
});

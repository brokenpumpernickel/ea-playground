import { describe, expect, test } from 'vitest';
import { gaAlgorithm, tspProblem, type GaEvent, type GaParams, type TspOptions } from '../engine';
import { createRun } from '../run';
import { describer } from './describe';
import { displayOf } from './format';
import { defaultsOf, entryOf } from './problems';
import { tourInfoOf } from './tour-cells';

const entry = entryOf('tsp')!;
const events = (options: TspOptions, change: (p: GaParams) => GaParams = (p) => p, generation = 1, seed = 7) => {
  const d = defaultsOf(entry, options);
  const run = createRun(gaAlgorithm, { setup: { problem: entry.create(options), init: d.init }, params: change(d.params), seed });
  run.forwardCycle();
  return run.events(generation);
};
const lines = (options: TspOptions, stage: GaEvent['stage'], change?: (p: GaParams) => GaParams, generation = 1) => {
  const problem = tspProblem(options);
  const display = displayOf(problem);
  return events(options, change, generation)
    .filter((e) => e.stage === stage)
    .map((e) => ({ e, text: describer(display)(e) }));
};
const info = (options: TspOptions) => tourInfoOf(tspProblem(options));
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
const small: TspOptions = { instance: 'circle', n: 8, seed: 1 };

describe('the narration of a TSP run', () => {
  test('a crossover line gives the operator, the slice positions from 1 and the lengths of the children, never the tours', () => {
    const ox = lines(berlin, 'crossover', (p) => ({ ...p, crossover: { ...p.crossover, operator: 'ox', probability: 1 } }));
    expect(ox).toHaveLength(6);
    for (const { e, text } of ox) {
      if (e.stage !== 'crossover') throw new Error('stage');
      const i = info(berlin);
      const lengths = e.children.filter((c) => !c.discarded).map((c) => i.lengthText(i.lengthOf(c.chromosome))).join(' and ');
      expect(text).toBe(`Pair ${e.pair}: u = ${String(Math.round(e.draw!.u * 1000) / 1000)} < pc 1 → OX, slice positions ${e.cuts![0]! + 1} to ${e.cuts![1]} → children ${lengths}${e.children[1]!.discarded ? ' · second child dropped' : ''}`);
      expect(text.length).toBeLessThan(110);
    }
  });

  test('a cycle crossover line says how many cycles, a partial-mapped one the slice', () => {
    const cx = lines(small, 'crossover', (p) => ({ ...p, crossover: { ...p.crossover, operator: 'cx', probability: 1 } }));
    for (const { e, text } of cx) {
      if (e.stage !== 'crossover') throw new Error('stage');
      expect(text).toMatch(new RegExp(`^Pair ${e.pair}: u = [\\d.]+ < pc 1 → CX, ${e.cycles!.length} cycles? → children [\\d.,]+( and [\\d.,]+)?( · second child dropped)?$`));
    }
    const pmx = lines(small, 'crossover', (p) => ({ ...p, crossover: { ...p.crossover, operator: 'pmx', probability: 1 } }));
    for (const { text } of pmx) expect(text).toMatch(/→ PMX, slice positions \d+ to \d+ → children/);
  });

  test('a bypass says why and gives the lengths of the copies', () => {
    const off = lines(small, 'crossover', (p) => ({ ...p, crossover: { ...p.crossover, enabled: false } }));
    for (const { e, text } of off) {
      if (e.stage !== 'crossover') throw new Error('stage');
      expect(text).toMatch(new RegExp(`^Pair ${e.pair}: crossover is off → bypassed: children are copies, [\\d.,]+( and [\\d.,]+)?( · second child dropped)?$`));
    }
    const failed = lines(small, 'crossover', (p) => ({ ...p, crossover: { ...p.crossover, probability: 0 } }));
    expect(failed[0]!.text).toMatch(/^Pair 1: u = [\d.]+ ≥ pc 0 → bypassed: children are copies, /);
  });

  test('a mutation line gives the draw, the move in words and the length before and after', () => {
    const all = lines(berlin, 'mutation', (p) => ({ ...p, mutation: { ...p.mutation, probability: 1, operator: 'inversion' } }));
    expect(all).toHaveLength(11);
    for (const { e, text } of all) {
      if (e.stage !== 'mutation') throw new Error('stage');
      expect(text).toMatch(new RegExp(`^Offspring ${e.offspring}: u = [\\d.]+ < pm 1 → reverse the slice from position ${e.move!.first + 1} to ${e.move!.second + 1}: length [\\d,]+ → [\\d,]+ \\([+−±][\\d,]+\\)$`));
    }
  });

  test('an unchanged offspring and a switched-off mutation are said, with the length', () => {
    const never = lines(small, 'mutation', (p) => ({ ...p, mutation: { ...p.mutation, probability: 0 } }));
    expect(never[0]!.text).toMatch(/^Offspring 1: u = [\d.]+ ≥ pm 0 → unchanged \(length [\d.,]+\)$/);
    const off = lines(small, 'mutation', (p) => ({ ...p, mutation: { ...p.mutation, enabled: false } }));
    expect(off[0]!.text).toMatch(/^Offspring 1: mutation is off → unchanged \(length [\d.,]+\)$/);
  });

  test('an evaluation line has the length, the gap and the fitness, and no tour', () => {
    const evaluation = lines(berlin, 'evaluation');
    expect(evaluation).toHaveLength(11);
    for (const { text } of evaluation) {
      expect(text).toMatch(/^Offspring \d+: length [\d,]+, [\d.]+% over the optimum 7,542 → fitness -[\d]+ \(individual \d+\)$/);
    }
  });

  test('the first individuals of the setup are written with a brief tour', () => {
    const setup = lines(berlin, 'setup', undefined, 0);
    expect(setup[0]!.text).toMatch(/^Individual \d+ \(\d+ \d+ \d+ \d+ \d+ … 45 more … \d+ \d+\): length [\d,]+, /);
  });
});

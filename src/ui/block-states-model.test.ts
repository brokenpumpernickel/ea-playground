import { describe, expect, test } from 'vitest';
import { gaAlgorithm, trapDefaults, trapProblem, type GaEvent, type GaParams, type GaSetup, type Linkage, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { blockInfoOf } from './block-context';
import { blockStateCounts, blockStatesModel, describeBlockStates } from './block-states-model';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const make = (linkage: Linkage, seed: number, blockSize = 4, blocks = 5, generations = 6, size = 12) => {
  const problem = trapProblem({ blockSize, blocks, linkage });
  const params: GaParams = { ...trapDefaults.params, stop: { generationLimit: 100 } };
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size } }, params, seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { run, info: blockInfoOf(problem), problem };
};

describe('how many individuals have each block at all ones, in between, and at all zeros', () => {
  test('hand-worked on three chromosomes', () => {
    const info = blockInfoOf(trapProblem({ blockSize: 2, blocks: 2, linkage: 'tight' }));
    // blocks: (genes 1-2) (genes 3-4)
    const population = [[1, 1, 0, 0], [0, 0, 0, 1], [1, 1, 1, 1]].map((chromosome) => ({ chromosome }));
    expect(blockStateCounts(info, population)).toEqual([
      { block: 1, optimum: 2, between: 0, attractor: 1 },
      { block: 2, optimum: 1, between: 1, attractor: 1 },
    ]);
  });

  test('loose linkage counts the genes the block really owns', () => {
    const info = blockInfoOf(trapProblem({ blockSize: 2, blocks: 2, linkage: 'loose' }));
    // block 1 owns genes 1 and 3, block 2 owns genes 2 and 4
    const population = [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 0]].map((chromosome) => ({ chromosome }));
    expect(blockStateCounts(info, population)).toEqual([
      { block: 1, optimum: 1, between: 1, attractor: 1 },
      { block: 2, optimum: 1, between: 1, attractor: 1 },
    ]);
  });

  test.each(['tight', 'loose'] as const)('%s: for every recorded generation of several runs the counts equal a direct count of the population, and each block’s three counts add up to the population', (linkage) => {
    for (let seed = 1; seed <= 6; seed++) {
      const { run, info, problem } = make(linkage, seed);
      for (let g = 0; g <= run.lastCycle; g++) {
        const population = run.snapshot(g).state.population;
        const counts = blockStateCounts(info, population);
        expect(counts).toHaveLength(5);
        counts.forEach((c, b) => {
          expect(c.optimum + c.between + c.attractor).toBe(population.length);
          expect(c.optimum).toBe(population.filter((i) => problem.outcomeOf(i.chromosome).blocks[b]!.state === 'optimum').length);
          expect(c.attractor).toBe(population.filter((i) => problem.outcomeOf(i.chromosome).blocks[b]!.state === 'attractor').length);
          expect(c.optimum).toBe(population.filter((i) => info.blockGenes[b]!.every((gene) => i.chromosome[gene] === 1)).length);
          expect(c.attractor).toBe(population.filter((i) => info.blockGenes[b]!.every((gene) => i.chromosome[gene] === 0)).length);
        });
      }
    }
  });
});

describe('the model of the panel over the recorded generations', () => {
  test('has the counts of the generation the cursor is on and, for every recorded generation, the totals of blocks at all ones and all zeros', () => {
    const { run, info } = make('tight', 3);
    const model = blockStatesModel(run, info, 4);
    expect(model.generation).toBe(4);
    expect(model.size).toBe(12);
    expect(model.blocks).toEqual(blockStateCounts(info, run.snapshot(4).state.population));
    expect(model.history.map((h) => h.generation)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    model.history.forEach((h, g) => {
      const counts = blockStateCounts(info, run.snapshot(g).state.population);
      expect(h.optimum).toBe(counts.reduce((t, c) => t + c.optimum, 0));
      expect(h.attractor).toBe(counts.reduce((t, c) => t + c.attractor, 0));
    });
  });

  test('the history line names the generations up to the cursor and keeps at most the last seven', () => {
    const { run, info } = make('tight', 3, 4, 5, 12);
    const text = blockStatesModel(run, info, 12).historyText;
    expect(text).toMatch(/^blocks at all zeros, generations 6–12: (\d+ · ){6}\d+$/);
    expect(blockStatesModel(run, info, 3).historyText).toMatch(/^blocks at all zeros, generations 0–3: (\d+ · ){3}\d+$/);
    expect(blockStatesModel(run, info, 0).historyText).toMatch(/^blocks at all zeros, generation 0: \d+$/);
  });

  test('scrubbing back changes the counts to those of that generation and leaves the history', () => {
    const { run, info } = make('loose', 2);
    const now = blockStatesModel(run, info, 6);
    const back = blockStatesModel(run, info, 2);
    expect(back.history).toEqual(now.history);
    expect(back.blocks).toEqual(blockStateCounts(info, run.snapshot(2).state.population));
  });
});

describe('the sentence for a screen reader', () => {
  test('says each block’s three counts and the population size', () => {
    const { run, info } = make('tight', 3, 4, 2, 2, 8);
    const model = blockStatesModel(run, info, 2);
    const text = describeBlockStates(model);
    expect(text).toContain('Generation 2 of the trap, 8 individuals:');
    expect(text).toContain(`block 1: ${model.blocks[0]!.optimum} all ones, ${model.blocks[0]!.between} in between, ${model.blocks[0]!.attractor} all zeros`);
    expect(text).toContain(`block 2: ${model.blocks[1]!.optimum} all ones`);
  });
});

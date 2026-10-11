import { describe, expect, test } from 'vitest';
import type { TrapOptions } from '../engine';
import { createFakeScheduler } from '../run/fake-scheduler';
import { entryOf } from './problems';
import { createSession } from './session.svelte';

const entry = entryOf('trap')!;
const trapSession = (options: TrapOptions = entry.defaultOptions() as TrapOptions) =>
  createSession({ scheduler: createFakeScheduler(), drawSeed: () => 7, config: { setup: { problem: entry.create(options), init: entry.defaults.init }, params: entry.defaults.params, seed: 5, problem: 'trap', options } });

describe('a session running the trap', () => {
  test('knows its blocks: their genes, the optimum and all zeros, and how a chromosome scores; and it is not mistaken for a knapsack', () => {
    const session = trapSession({ blockSize: 3, blocks: 4, linkage: 'loose' });
    expect(session.bag).toBeUndefined();
    const blocks = session.blocks!;
    expect(blocks.blockSize).toBe(3);
    expect(blocks.blocks).toBe(4);
    expect(blocks.linkage).toBe('loose');
    expect(blocks.optimum).toBe(12);
    expect(blocks.attractor).toBe(8);
    expect(blocks.blockGenes).toEqual([
      [0, 4, 8],
      [1, 5, 9],
      [2, 6, 10],
      [3, 7, 11],
    ]);
    expect(blocks.outcomeOf([1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]).fitness).toBe(4); // loose: each block owns exactly one of the first four genes, so u = 1 and each scores 3 − 1 − 1 = 1
  });

  test('follows the running problem: the brand area, the table and the plots show the trap, and the knapsack and the other problems have no blocks', () => {
    const session = trapSession();
    expect(session.problemEntry.id).toBe('trap');
    expect(session.problemEntry.subtitle(session.problemOptions)).toBe('5 blocks of 4 · tight · optimum 20');
    expect(session.table.rows).toHaveLength(12);
    expect(session.table.rows[0]!.cells!.length).toBeGreaterThan(0);
    const other = createSession({ scheduler: createFakeScheduler(), drawSeed: () => 7 });
    expect(other.blocks).toBeUndefined();
    const knap = entryOf('knapsack')!;
    const options = knap.defaultOptions();
    const knapsack = createSession({ scheduler: createFakeScheduler(), drawSeed: () => 7, config: { setup: { problem: knap.create(options), init: knap.defaults.init }, params: knap.defaults.params, seed: 5, problem: 'knapsack', options } });
    expect(knapsack.blocks).toBeUndefined();
    expect(knapsack.bag).toBeDefined();
  });

  test('switching to the trap through the menu restarts under its own defaults and options, and the run is the trap', () => {
    const session = createSession({ scheduler: createFakeScheduler(), drawSeed: () => 7 });
    session.requestProblemSwitch('trap');
    session.confirmReset();
    expect(session.problemEntry.id).toBe('trap');
    expect(session.problemOptions).toEqual({ blockSize: 4, blocks: 5, linkage: 'tight' });
    expect(session.problem.chromosomeLength).toBe(20);
    expect(session.blocks!.blockGenes).toHaveLength(5);
  });
});

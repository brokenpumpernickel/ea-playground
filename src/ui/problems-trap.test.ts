import { describe, expect, test } from 'vitest';
import { entryOf, problemIds } from './problems';

describe('the trap entry', () => {
  const entry = entryOf('trap')!;

  test('is the fourth problem, named Trap with the logo Tr, and the others are where they were', () => {
    expect(problemIds()).toEqual(['goldberg', 'target-string', 'knapsack', 'trap']);
    expect(entry.name).toBe('Trap');
    expect(entry.logo).toBe('Tr');
    expect(entry.hasOptions).toBe(true);
    expect(entry.genePanel).toBe('blocks');
    expect(entry.diversityNote).toBe('mean pairwise Hamming, 0–1');
  });

  test('its default options are 5 blocks of 4, tight, and a copy each time', () => {
    const a = entry.defaultOptions() as unknown as { blockSize: number; blocks: number; linkage: string };
    expect(a).toEqual({ blockSize: 4, blocks: 5, linkage: 'tight' });
    a.blockSize = 8;
    expect((entry.defaultOptions() as unknown as { blockSize: number }).blockSize).toBe(4);
  });

  test('says what it is in the brand area: blocks, linkage and the optimum', () => {
    expect(entry.subtitle(entry.defaultOptions())).toBe('5 blocks of 4 · tight · optimum 20');
    expect(entry.subtitle({ blockSize: 3, blocks: 10, linkage: 'loose' })).toBe('10 blocks of 3 · loose · optimum 30');
    expect(entry.subtitle({ blockSize: 2, blocks: 1, linkage: 'tight' })).toBe('1 block of 2 · tight · optimum 2');
    expect(entry.subtitle(undefined)).toBe('Deceptive trap functions');
  });

  test('options are validated in words, whatever they are', () => {
    const good = entry.defaultOptions() as unknown as Record<string, unknown>;
    expect(entry.validateOptions(good)).toEqual([]);
    expect(entry.validateOptions('x')).toEqual(['"options" must be an object with "blockSize", "blocks" and "linkage".']);
    expect(entry.validateOptions({})).toEqual(['"options" is missing "blockSize".', '"options" is missing "blocks".', '"options" is missing "linkage".']);
    expect(entry.validateOptions({ ...good, extra: 1 })).toEqual(['"options" has an unknown key "extra".']);
    expect(entry.validateOptions({ ...good, blockSize: '4', blocks: null, linkage: 1 })).toEqual(['"options.blockSize" must be a number.', '"options.blocks" must be a number.', '"options.linkage" must be text.']);
    expect(entry.validateOptions({ ...good, blockSize: 1 })).toEqual(['Block size must be a whole number from 2 to 8 (it is 1).']);
    expect(entry.validateOptions({ ...good, blocks: 11 })).toEqual(['The number of blocks must be a whole number from 1 to 10 (it is 11).']);
    expect(entry.validateOptions({ ...good, blockSize: 8, blocks: 6 })).toEqual(['Block size × blocks: at most 30 genes in all (8 × 6 = 48).']);
    expect(entry.validateOptions({ ...good, linkage: 'random' })).toEqual(['Linkage must be one of tight, loose.']);
  });

  test('the option messages are grouped by field for the drawer', () => {
    const fields = entry.validateOptionFields({ blockSize: 9, blocks: 0, linkage: 'x' } as never);
    expect(Object.keys(fields).sort()).toEqual(['blockSize', 'blocks', 'genes', 'linkage']);
    expect(fields.blockSize).toHaveLength(1);
    expect(fields.blocks).toHaveLength(1);
    expect(fields.linkage).toHaveLength(1);
    expect(fields.genes).toHaveLength(0);
  });

  test('the problem it builds is the trap for those options, and with none it is the default trap', () => {
    const problem = entry.create(entry.defaultOptions());
    expect(problem.chromosomeLength).toBe(20);
    expect(problem.knownOptimumFitness).toBe(20);
    expect(entry.create(undefined).chromosomeLength).toBe(20);
    expect(entry.create({ blockSize: 3, blocks: 4, linkage: 'loose' }).chromosomeLength).toBe(12);
  });

  test('a fresh run starts with a random population, the default seed and a stop target equal to the optimum; the other entries are unchanged', () => {
    expect(entry.defaults.init.kind).toBe('random');
    expect(entry.defaults.params.stop.targetFitness).toBe(20);
    expect(entryOf('knapsack')!.defaults.params.stop.targetFitness).toBe(123);
  });
});

import { describe, expect, test } from 'vitest';
import { binaryAlphabet, parseBits } from './chromosome';
import { trapContribution, trapDefaultOptions, trapDefaults, trapLimits, trapProblem, validateTrap, validateTrapFields, type TrapOptions } from './trap';

const options = (blockSize: number, blocks: number, linkage: TrapOptions['linkage'] = 'tight'): TrapOptions => ({ blockSize, blocks, linkage });
const genes = (bits: string) => [...bits.replace(/ /g, '')].map(Number);
const everyChromosome = (length: number) => Array.from({ length: 2 ** length }, (_, n) => Array.from({ length }, (_, g) => (n >> g) & 1));

describe('the trap contribution of one block', () => {
  test('is k for all ones and k − 1 − u for u ones otherwise (Deb and Goldberg), worked out for k = 4', () => {
    expect([0, 1, 2, 3, 4].map((u) => trapContribution(u, 4))).toEqual([3, 2, 1, 0, 4]);
  });

  test.each([2, 3, 5, 8])('for k = %i: all ones is the best, the others fall as ones are added, and all zeros is the second best', (k) => {
    const scores = Array.from({ length: k + 1 }, (_, u) => trapContribution(u, k));
    expect(scores[k]).toBe(k);
    expect(scores[0]).toBe(k - 1);
    for (let u = 0; u < k - 1; u++) expect(scores[u]! - scores[u + 1]!).toBe(1);
    expect(scores[k - 1]).toBe(0);
    expect(Math.max(...scores.slice(0, k))).toBe(k - 1);
  });
});

describe('which genes belong to which block', () => {
  test('tight: block b owns the genes b·k … b·k + k − 1', () => {
    expect(trapProblem(options(4, 5)).blockGenes).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
      [12, 13, 14, 15],
      [16, 17, 18, 19],
    ]);
  });

  test('loose: block b owns the genes b, b + m, b + 2m, … (a fixed interleave)', () => {
    expect(trapProblem(options(4, 5, 'loose')).blockGenes).toEqual([
      [0, 5, 10, 15],
      [1, 6, 11, 16],
      [2, 7, 12, 17],
      [3, 8, 13, 18],
      [4, 9, 14, 19],
    ]);
    expect(trapProblem(options(3, 2, 'loose')).blockGenes).toEqual([
      [0, 2, 4],
      [1, 3, 5],
    ]);
  });

  test('every gene belongs to exactly one block and every block has k genes, for every valid size and both linkages', () => {
    for (const linkage of ['tight', 'loose'] as const) {
      for (let k = trapLimits.minBlockSize; k <= trapLimits.maxBlockSize; k++) {
        for (let m = trapLimits.minBlocks; m <= trapLimits.maxBlocks; m++) {
          if (k * m > trapLimits.maxGenes) continue;
          const owned = trapProblem(options(k, m, linkage)).blockGenes;
          expect(owned).toHaveLength(m);
          expect(owned.every((block) => block.length === k)).toBe(true);
          expect(owned.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: k * m }, (_, g) => g));
        }
      }
    }
  });
});

describe('the problem', () => {
  test('has k × m binary genes, the known optimum k × m, no landscape, and the columns Decoded and Fitness', () => {
    const p = trapProblem(options(4, 5));
    expect(p.chromosomeLength).toBe(20);
    expect(p.alphabet).toEqual(binaryAlphabet);
    expect(p.knownOptimumFitness).toBe(20);
    expect(p.attractorFitness).toBe(15);
    expect(p.landscape).toBeUndefined();
    expect(p.options).toEqual(options(4, 5));
    expect(p.columns.map((c) => c.header)).toEqual(['Decoded', 'Fitness']);
    expect(p.mayBeInfeasible).toBeUndefined();
  });

  test('the Decoded column is the one the population table may drop when it needs the room, and says what it counts', () => {
    const decoded = trapProblem(options(4, 5)).columns[0]!;
    expect(decoded.optional).toBe(true);
    expect(decoded.note).toBe('1s per block');
  });

  test('hand-worked chromosomes, tight: all ones 20, all zeros 15, 1111|0000|0100|0000|1111 is 4+3+2+3+4 = 16, 0000|0000|1110|0000|0110 is 3+3+0+3+1 = 10', () => {
    const p = trapProblem(options(4, 5));
    expect(p.evaluate(genes('1111 1111 1111 1111 1111'))).toEqual({ decoded: '4 · 4 · 4 · 4 · 4', objective: 20, fitness: 20 });
    expect(p.evaluate(genes('0000 0000 0000 0000 0000'))).toEqual({ decoded: '0 · 0 · 0 · 0 · 0', objective: 15, fitness: 15 });
    expect(p.evaluate(genes('1111 0000 0100 0000 1111'))).toEqual({ decoded: '4 · 0 · 1 · 0 · 4', objective: 16, fitness: 16 });
    expect(p.evaluate(genes('0000 0000 1110 0000 0110'))).toEqual({ decoded: '0 · 0 · 3 · 0 · 2', objective: 10, fitness: 10 });
  });

  test('hand-worked, loose: the same string 1111|0000|0100|0000|1111 is 2+1+1+1+1 = 6, because every block holds one gene of each quarter', () => {
    const p = trapProblem(options(4, 5, 'loose'));
    expect(p.evaluate(genes('1111 0000 0100 0000 1111'))).toEqual({ decoded: '1 · 2 · 2 · 2 · 2', objective: 6, fitness: 6 });
    expect(p.evaluate(genes('1111 1111 1111 1111 1111')).fitness).toBe(20);
    expect(p.evaluate(genes('0000 0000 0000 0000 0000')).fitness).toBe(15);
  });

  test.each([
    [2, 3, 'tight'],
    [2, 3, 'loose'],
    [3, 3, 'tight'],
    [3, 3, 'loose'],
    [4, 2, 'tight'],
    [4, 2, 'loose'],
    [2, 6, 'loose'],
  ] as const)('k = %i, m = %i, %s: brute force over all chromosomes finds the optimum k × m only at all ones, and the lowest fitness is 0', (k, m, linkage) => {
    const p = trapProblem(options(k, m, linkage));
    const fitness = everyChromosome(k * m).map((c) => ({ c, f: p.evaluate(c).fitness }));
    expect(Math.max(...fitness.map((x) => x.f))).toBe(k * m);
    expect(p.knownOptimumFitness).toBe(k * m);
    expect(fitness.filter((x) => x.f === k * m).map((x) => x.c.join(''))).toEqual(['1'.repeat(k * m)]);
    expect(p.evaluate(Array.from({ length: k * m }, () => 0)).fitness).toBe(m * (k - 1));
    expect(p.attractorFitness).toBe(m * (k - 1));
    expect(Math.min(...fitness.map((x) => x.f))).toBe(0);
  });

  test('fitness is the sum of the block contributions, for generated chromosomes of every valid size and both linkages', () => {
    let state = 12345;
    const next = () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (const linkage of ['tight', 'loose'] as const) {
      for (const [k, m] of [[2, 1], [3, 10], [8, 3], [5, 6], [6, 5]] as const) {
        const p = trapProblem(options(k, m, linkage));
        for (let trial = 0; trial < 20; trial++) {
          const c = Array.from({ length: k * m }, () => (next() < 0.5 ? 1 : 0));
          const direct = p.blockGenes.map((block) => trapContribution(block.filter((g) => c[g] === 1).length, k)).reduce((a, b) => a + b, 0);
          expect(p.evaluate(c).fitness).toBe(direct);
          expect(p.outcomeOf(c).fitness).toBe(direct);
        }
      }
    }
  });

  test('outcomeOf says, per block, its genes, how many are 1, its contribution and whether it is all ones, all zeros or in between', () => {
    const outcome = trapProblem(options(4, 5)).outcomeOf(genes('1111 0000 0100 0000 1111'));
    expect(outcome.fitness).toBe(16);
    expect(outcome.blocks.map((b) => [b.ones, b.contribution, b.state])).toEqual([
      [4, 4, 'optimum'],
      [0, 3, 'attractor'],
      [1, 2, 'between'],
      [0, 3, 'attractor'],
      [4, 4, 'optimum'],
    ]);
    expect(outcome.blocks[2]!.genes).toEqual([8, 9, 10, 11]);
    const loose = trapProblem(options(4, 5, 'loose')).outcomeOf(genes('1111 0000 0100 0000 1111'));
    expect(loose.blocks[0]).toMatchObject({ genes: [0, 5, 10, 15], ones: 1, contribution: 2, state: 'between' });
  });

  test('a one-gene-per-block trap with k = 2 has no block that is both all ones and all zeros, and k = 8 works', () => {
    const p = trapProblem(options(8, 3));
    expect(p.evaluate(genes('11111111 00000000 11111110')).fitness).toBe(8 + 7 + 0);
    expect(p.chromosomeLength).toBe(24);
  });

  test('says in a sentence what a score means', () => {
    const p = trapProblem(options(4, 5));
    const scores = p.evaluate(genes('1111 0000 0100 0000 1111'));
    expect(p.scoreText!(scores)).toBe('ones per block 4 · 0 · 1 · 0 · 4 → 4 + 3 + 2 + 3 + 4 = 16');
    expect(p.evaluationExplanation).toContain('k − 1 − u');
  });

  test('parseBits is not needed to read a chromosome: a chromosome spelled with parseBits evaluates the same', () => {
    const p = trapProblem(options(4, 5));
    expect(p.evaluate(parseBits('11110000010000001111')).fitness).toBe(16);
  });
});

describe('validation', () => {
  test('the default options are valid and are 5 blocks of 4, tight', () => {
    expect(trapDefaultOptions).toEqual({ blockSize: 4, blocks: 5, linkage: 'tight' });
    expect(validateTrap(trapDefaultOptions)).toEqual([]);
  });

  test('the limits are 2 to 8 genes per block, 1 to 10 blocks, at most 30 genes in all', () => {
    expect(trapLimits).toEqual({ minBlockSize: 2, maxBlockSize: 8, minBlocks: 1, maxBlocks: 10, maxGenes: 30 });
    expect(validateTrap(options(2, 1))).toEqual([]);
    expect(validateTrap(options(8, 3))).toEqual([]);
    expect(validateTrap(options(3, 10))).toEqual([]);
    expect(validateTrap(options(6, 5))).toEqual([]);
  });

  test.each([
    [options(1, 5), 'blockSize', 'Block size must be a whole number from 2 to 8 (it is 1).'],
    [options(9, 2), 'blockSize', 'Block size must be a whole number from 2 to 8 (it is 9).'],
    [options(3.5, 5), 'blockSize', 'Block size must be a whole number from 2 to 8 (it is 3.5).'],
    [{ ...options(4, 5), blockSize: '4' as unknown as number }, 'blockSize', 'Block size must be a whole number from 2 to 8 (it is not a number).'],
    [options(4, 0), 'blocks', 'The number of blocks must be a whole number from 1 to 10 (it is 0).'],
    [options(2, 11), 'blocks', 'The number of blocks must be a whole number from 1 to 10 (it is 11).'],
    [{ ...options(4, 5), blocks: Number.NaN }, 'blocks', 'The number of blocks must be a whole number from 1 to 10 (it is not a number).'],
    [options(8, 6), 'genes', 'Block size × blocks: at most 30 genes in all (8 × 6 = 48).'],
    [options(4, 8), 'genes', 'Block size × blocks: at most 30 genes in all (4 × 8 = 32).'],
    [{ ...options(4, 5), linkage: 'random' as unknown as 'tight' }, 'linkage', 'Linkage must be one of tight, loose.'],
  ] as const)('%j is refused under %s with: %s', (bad, field, message) => {
    expect(validateTrapFields(bad)[field]).toEqual([message]);
    expect(validateTrap(bad)).toEqual([message]);
    expect(() => trapProblem(bad)).toThrow(message);
  });

  test('a total of genes is only reported when both sizes are themselves valid, so a bad size is named once', () => {
    expect(validateTrapFields(options(9, 20)).genes).toEqual([]);
    expect(validateTrap(options(9, 20))).toHaveLength(2);
  });
});

describe('the defaults', () => {
  test('are the measured ones: 5 blocks of 4 tight, a population of 12, tournaments of 2, one-point crossover 0.8, per-gene mutation 0.05, no elites, stop at generation 100, at the optimum 20 and after 70 generations without improvement', () => {
    expect(trapDefaults.options).toEqual({ blockSize: 4, blocks: 5, linkage: 'tight' });
    expect(trapDefaults.populationSize).toBe(12);
    expect(trapDefaults.params).toEqual({
      selection: { method: 'tournament', size: 2 },
      crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
      mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
      elites: 0,
      stop: { generationLimit: 100, targetFitness: 20, stagnationWindow: 70 },
    });
  });

  test('the stop target is the optimum of the default trap', () => {
    expect(trapDefaults.params.stop.targetFitness).toBe(trapProblem(trapDefaults.options).knownOptimumFitness);
  });
});

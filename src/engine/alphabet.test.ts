import { describe, expect, test } from 'vitest';
import { binaryAlphabet, formatGenes, parseGenes } from './chromosome';
import { goldberg } from './goldberg';
import { initialize } from './initialize';
import { fitnessColumn, type Problem } from './problem';
import { scripted } from './test-support';
import { createRng } from '../run/rng';

/** A problem over any alphabet, scoring by how many genes are the last symbol (the score is not what these tests are about). */
const over = (symbols: string, length: number): Problem => ({
  chromosomeLength: length,
  alphabet: [...symbols],
  columns: [fitnessColumn],
  evaluate: (c) => {
    const fitness = c.filter((g) => g === symbols.length - 1).length;
    return { decoded: formatGenes(c, [...symbols]), objective: fitness, fitness };
  },
});
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const forty = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';

describe('genes and alphabets', () => {
  test('the binary alphabet shows gene 0 as 0 and gene 1 as 1, in both directions', () => {
    expect(binaryAlphabet).toEqual(['0', '1']);
    expect(formatGenes([0, 1, 1, 0, 1], binaryAlphabet)).toBe('01101');
    expect(parseGenes('01101', binaryAlphabet)).toEqual([0, 1, 1, 0, 1]);
  });

  test('letters, including a space, round-trip through their positions in the alphabet', () => {
    const alphabet = [...letters];
    const genes = parseGenes('HELLO WORLD', alphabet)!;
    expect(genes).toEqual([7, 4, 11, 11, 14, 26, 22, 14, 17, 11, 3]);
    expect(formatGenes(genes, alphabet)).toBe('HELLO WORLD');
  });

  test('a character that is not in the alphabet makes parsing fail, rather than guessing', () => {
    expect(parseGenes('01x01', binaryAlphabet)).toBeUndefined();
    expect(parseGenes('hello', [...letters])).toBeUndefined(); // case matters
  });

  test('Goldberg declares the binary alphabet and the columns it has always shown: x and fitness', () => {
    expect(goldberg.alphabet).toBe(binaryAlphabet);
    const scores = goldberg.evaluate([1, 1, 0, 0, 1]);
    expect(goldberg.columns.map((c) => [c.header, c.show(scores)])).toEqual([['x', '25'], ['Fitness', '625']]);
  });
});

describe('random initialization over an alphabet', () => {
  test('for the binary alphabet a gene is 1 exactly when its draw is below 0.5, as it always was', () => {
    const { population } = initialize(goldberg, { kind: 'random', size: 1 }, scripted(0.0, 0.49999, 0.5, 0.75, 0.999999));
    expect(population[0]!.chromosome).toEqual([1, 1, 0, 0, 0]);
  });

  test('for k symbols the draw u picks index k − 1 − ⌊u·k⌋, so every index is reachable and none is out of range', () => {
    const problem = over('abc', 6);
    const { population } = initialize(problem, { kind: 'random', size: 1 }, scripted(0, 0.3333, 0.34, 0.6666, 0.67, 0.999999));
    expect(population[0]!.chromosome).toEqual([2, 2, 1, 1, 0, 0]);
  });

  test.each([
    ['3 symbols', 'abc'],
    ['27 symbols', letters],
    ['40 symbols', forty],
  ])('%s: every gene is a valid index and the symbols are used about equally often', (_name, symbols) => {
    const problem = over(symbols, 10);
    const k = symbols.length;
    const { population } = initialize(problem, { kind: 'random', size: 4000 }, createRng(11));
    const counts = new Array<number>(k).fill(0);
    for (const individual of population) for (const g of individual.chromosome) counts[g]!++;
    expect(counts.reduce((a, b) => a + b, 0)).toBe(40000);
    const expected = 40000 / k;
    for (const count of counts) {
      // five standard deviations of a binomial count, so a fair generator essentially never fails this
      const tolerance = 5 * Math.sqrt(40000 * (1 / k) * (1 - 1 / k));
      expect(Math.abs(count - expected)).toBeLessThan(tolerance);
    }
  });

  test('the same seed gives the same population, a different seed another', () => {
    const problem = over(letters, 8);
    const a = initialize(problem, { kind: 'random', size: 5 }, createRng(3)).population.map((i) => i.chromosome);
    expect(initialize(problem, { kind: 'random', size: 5 }, createRng(3)).population.map((i) => i.chromosome)).toEqual(a);
    expect(initialize(problem, { kind: 'random', size: 5 }, createRng(4)).population.map((i) => i.chromosome)).not.toEqual(a);
  });
});

describe('explicit initialization over an alphabet', () => {
  const explicit = (problem: Problem, chromosomes: string[]) => () => initialize(problem, { kind: 'explicit', chromosomes }, createRng(1));

  test('strings of letters become genes and are scored', () => {
    const problem = over(letters, 5);
    const { population } = initialize(problem, { kind: 'explicit', chromosomes: ['HELLO', 'WORLD'] }, createRng(1));
    expect(population.map((i) => i.chromosome)).toEqual([[7, 4, 11, 11, 14], [22, 14, 17, 11, 3]]);
    expect(population.map((i) => i.decoded)).toEqual(['HELLO', 'WORLD']);
  });

  test('a symbol outside the alphabet is refused, naming the chromosome and what is allowed', () => {
    expect(explicit(over('abc', 3), ['abc', 'abd'])).toThrow('Chromosome 2 ("abd") may only contain the characters a, b and c');
    expect(explicit(over(letters, 3), ['ABC', 'AbC'])).toThrow('Chromosome 2 ("AbC") may only contain the characters of the alphabet (27 symbols)');
    expect(explicit(goldberg, ['01101', '11x00'])).toThrow('Chromosome 2 ("11x00") may only contain the characters 0 and 1');
  });

  test('the wrong length is refused with the length the problem needs', () => {
    expect(explicit(over(letters, 5), ['HELLO', 'HI'])).toThrow('Chromosome 2 has 2 genes, but this problem needs 5');
  });
});

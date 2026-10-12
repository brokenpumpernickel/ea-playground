import { describe, expect, test } from 'vitest';
import { checkReal, formatReal, parseReal } from './chromosome';
import { initialize } from './initialize';
import { metricsOf, metricsOfProblem } from './metrics';
import { isRealProblem } from './problem';
import { goldberg } from './goldberg';
import { realSphere, scripted } from './test-support';
import { createRng } from '../run/rng';
import { startRun } from './generation';

const box = realSphere([{ lo: -5, hi: 5 }, { lo: -5, hi: 5 }]);

describe('which representation a problem has', () => {
  test('a problem with bounds is real-valued and has no alphabet; the symbol problems are not', () => {
    expect(isRealProblem(box)).toBe(true);
    expect(box.alphabet).toEqual([]);
    expect(isRealProblem(goldberg)).toBe(false);
  });
});

describe('reading and writing a real chromosome', () => {
  test('numbers separated by spaces or commas, with either minus sign, a decimal point or an exponent', () => {
    expect(parseReal('1.5 -2.25')).toEqual([1.5, -2.25]);
    expect(parseReal('1.5, −2.25')).toEqual([1.5, -2.25]);
    expect(parseReal('  3\t4e-1  ')).toEqual([3, 0.4]);
    expect(parseReal('.5 +2')).toEqual([0.5, 2]);
  });

  test('text that is not numbers is not a chromosome', () => {
    expect(parseReal('')).toBeUndefined();
    expect(parseReal('1.5 abc')).toBeUndefined();
    expect(parseReal('1..2 3')).toBeUndefined();
    expect(parseReal('1.5 Infinity')).toBeUndefined();
    expect(parseReal('1.5 NaN')).toBeUndefined();
  });

  test('is shown to three decimals with a real minus sign, and written in full for the data', () => {
    expect(formatReal([-2.5054321, 1.2], 3)).toBe('−2.505 1.200');
    expect(formatReal([-2.5054321, 1.2])).toBe('-2.5054321 1.2');
    expect(parseReal(formatReal([0.1 + 0.2, -1e-7]))).toEqual([0.1 + 0.2, -1e-7]); // the full form round-trips exactly
  });

  test('every gene inside its bounds passes; the ones outside are named in words', () => {
    expect(checkReal([5, -5], box.bounds!)).toEqual([]);
    expect(checkReal([5.001, 0], box.bounds!)).toEqual(['gene 1 (5.001) is outside its bounds from −5 to 5']);
    expect(checkReal([-6, 7], box.bounds!)).toEqual(['gene 1 (−6) is outside its bounds from −5 to 5', 'gene 2 (7) is outside its bounds from −5 to 5']);
  });
});

describe('initializing a real-valued population', () => {
  test('every gene is lo + u × (hi − lo) from one draw, genes in order, individuals in order', () => {
    const rng = scripted(0, 0.5, 0.25, 0.75);
    const { population } = initialize(box, { kind: 'random', size: 2 }, rng);
    expect(population.map((i) => i.chromosome)).toEqual([[-5, 0], [-2.5, 2.5]]);
    expect(rng.used).toBe(4);
    expect(population.map((i) => i.id)).toEqual([1, 2]);
  });

  test('the bounds of each gene are its own', () => {
    const wide = realSphere([{ lo: 0, hi: 10 }, { lo: -1, hi: 1 }]);
    const { population } = initialize(wide, { kind: 'random', size: 1 }, scripted(0.3, 0.3));
    expect(population[0]!.chromosome[0]).toBeCloseTo(3, 12);
    expect(population[0]!.chromosome[1]).toBeCloseTo(-0.4, 12);
  });

  test('is reproducible by seed, lies inside the bounds, and the individuals are scored by the problem', () => {
    const a = initialize(box, { kind: 'random', size: 50 }, createRng(7)).population;
    const b = initialize(box, { kind: 'random', size: 50 }, createRng(7)).population;
    expect(a).toEqual(b);
    for (const i of a) {
      expect(i.chromosome).toHaveLength(2);
      expect(i.chromosome.every((x) => x >= -5 && x < 5)).toBe(true);
      expect(i.fitness).toBe(-(i.chromosome[0]! ** 2 + i.chromosome[1]! ** 2));
      expect(i.origin).toEqual({ kind: 'initial' });
    }
    expect(new Set(a.map((i) => i.chromosome)).size).toBe(50); // no two share an array
  });

  test('draws are made in order, so the first individual is the same for any size', () => {
    const one = initialize(box, { kind: 'random', size: 1 }, createRng(3)).population[0]!;
    const many = initialize(box, { kind: 'random', size: 9 }, createRng(3)).population[0]!;
    expect(one.chromosome).toEqual(many.chromosome);
  });
});

describe('a hand-edited real-valued population', () => {
  test('numbers are read, scored and kept in full precision', () => {
    const { population } = initialize(box, { kind: 'explicit', chromosomes: ['1 2', '-0.5, 3.25'] }, createRng(1));
    expect(population.map((i) => i.chromosome)).toEqual([[1, 2], [-0.5, 3.25]]);
    expect(population.map((i) => i.fitness)).toEqual([-5, -(0.25 + 10.5625)]);
  });

  test('wrong text, the wrong number of genes and a gene outside its bounds are named in words, with the chromosome', () => {
    const fail = (text: string) => () => initialize(box, { kind: 'explicit', chromosomes: ['0 0', text] }, createRng(1));
    expect(fail('1 x')).toThrow('Chromosome 2 ("1 x") may only contain numbers separated by spaces');
    expect(fail('1')).toThrow('Chromosome 2 has 1 number, but this problem needs 2');
    expect(fail('1 2 3')).toThrow('Chromosome 2 has 3 numbers, but this problem needs 2');
    expect(fail('6 0')).toThrow('Chromosome 2: gene 1 (6) is outside its bounds from −5 to 5');
  });
});

describe('metrics of a real-valued population', () => {
  const run = (...chromosomes: string[]) => startRun(box, { kind: 'explicit', chromosomes }, createRng(1)).state;

  test('best, worst, average and distinct points are read as for any problem; alleles are absent, not invented', () => {
    const m = metricsOfProblem(run('0 0', '1 1', '1 1', '2 0'), box);
    expect([m.best, m.worst, m.average]).toEqual([0, -4, -(0 + 2 + 2 + 4) / 4]);
    expect(m.distinct).toBe(3);
    expect(m.symbolCounts).toEqual([]);
    expect(m.alleleFrequencies).toEqual([]);
  });

  test('diversity is the mean pairwise distance between points, each gene scaled to its bounds, divided by the diagonal of the bounds', () => {
    expect(metricsOfProblem(run('-5 -5', '5 5'), box).diversity).toBeCloseTo(1, 12); // opposite corners: the diagonal itself
    expect(metricsOfProblem(run('1 1', '1 1'), box).diversity).toBe(0);
    expect(metricsOfProblem(run('3 3'), box).diversity).toBe(0); // one individual has no pairs
    // (−5,0), (5,0), (0,5): normalised (0,.5), (1,.5), (.5,1): distances 1, √.5, √.5 → mean (1 + 2·√.5) / 3, over √2
    expect(metricsOfProblem(run('-5 0', '5 0', '0 5'), box).diversity).toBeCloseTo((1 + 2 * Math.SQRT1_2) / 3 / Math.SQRT2, 12);
  });

  test('the metrics of a symbol problem are unchanged when asked either way', () => {
    const state = startRun(goldberg, { kind: 'explicit', chromosomes: ['01101', '11000'] }, createRng(1)).state;
    expect(metricsOfProblem(state, goldberg)).toEqual(metricsOf(state, 2));
  });
});

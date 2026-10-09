import { describe, expect, test } from 'vitest';
import { parseBits } from './chromosome';
import { goldberg } from './goldberg';

const allFiveBitChromosomes = Array.from({ length: 32 }, (_, v) => v.toString(2).padStart(5, '0'));

describe('Goldberg x² problem', () => {
  test('chromosomes have five genes', () => {
    expect(goldberg.chromosomeLength).toBe(5);
  });

  test.each([
    ['00000', 0, 0],
    ['01101', 13, 169],
    ['11000', 24, 576],
    ['01000', 8, 64],
    ['10011', 19, 361],
    ['11111', 31, 961],
  ])('%s decodes to x = %i with objective and fitness %i', (bits, x, square) => {
    expect(goldberg.evaluate(parseBits(bits))).toEqual({ decoded: x, objective: square, fitness: square });
  });

  test('every chromosome decodes as an ordinary binary number, most significant bit first', () => {
    for (const bits of allFiveBitChromosomes) {
      const x = parseInt(bits, 2);
      expect(goldberg.evaluate(parseBits(bits))).toEqual({ decoded: x, objective: x * x, fitness: x * x });
    }
  });

  test('the known optimum is the best fitness any chromosome reaches', () => {
    const best = Math.max(...allFiveBitChromosomes.map((bits) => goldberg.evaluate(parseBits(bits)).fitness));
    expect(goldberg.knownOptimumFitness).toBe(best);
    expect(goldberg.knownOptimumFitness).toBe(961);
  });
});

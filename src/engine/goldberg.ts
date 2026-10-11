import type { Chromosome } from './chromosome';
import type { Problem, Scores } from './problem';

/**
 * Goldberg's introductory example: maximise f(x) = x² for integer x in [0, 31].
 * The five-bit chromosome is plain binary, most significant bit first. Fitness equals the objective value.
 */
export const goldberg: Problem & { readonly knownOptimumFitness: number } = {
  chromosomeLength: 5,
  knownOptimumFitness: 31 * 31,
  landscape: { label: 'f(x) = x²', domain: [0, 31], fitnessAt: (x) => x * x },
  evaluate(chromosome: Chromosome): Scores {
    const x = chromosome.reduce<number>((value, bit) => value * 2 + bit, 0);
    return { decoded: x, objective: x * x, fitness: x * x };
  },
};

import type { RunState } from './generation';

/** What the plots show for one generation. Derived from the run state, so it can always be recomputed from a snapshot. */
export interface GenerationMetrics {
  readonly generation: number;
  /** The best, worst and mean fitness of the current population. */
  readonly best: number;
  readonly worst: number;
  readonly average: number;
  /** The best fitness seen in any generation so far; never lower than `best`. */
  readonly bestSoFar: number;
  /** How many individuals have been scored so far. */
  readonly evaluations: number;
  /**
   * Mean Hamming distance over all pairs of individuals, divided by the chromosome length: 0 when every
   * chromosome is the same, 1 for a complementary pair. A population of one has no pairs, so 0.
   */
  readonly diversity: number;
  /** How many different chromosomes are present. */
  readonly distinct: number;
  /** For each gene, the share of individuals with a 1 there. */
  readonly alleleFrequencies: readonly number[];
}

const cache = new WeakMap<RunState, GenerationMetrics>();

/** States are never modified, so the result for a state never changes; asking again returns the same object. */
export function metricsOf(state: RunState): GenerationMetrics {
  const known = cache.get(state);
  if (known) return known;

  const population = state.population;
  const size = population.length;
  if (size === 0) throw new Error('Cannot compute metrics for an empty population');

  const fitness = population.map((i) => i.fitness);
  const length = population[0]!.chromosome.length;
  const ones = Array.from({ length }, (_, gene) => population.reduce((count, i) => count + i.chromosome[gene]!, 0));

  // Pairs that differ at a gene: each of the k individuals with a 1 against each of the size − k with a 0.
  // Summing over genes and dividing by the number of pairs and by the length is the same number as comparing
  // every pair directly (the tests check this), in time proportional to size × length instead of size² × length.
  const differingGenes = ones.reduce((sum, k) => sum + k * (size - k), 0);
  const pairs = (size * (size - 1)) / 2;

  const metrics: GenerationMetrics = {
    generation: state.generation,
    best: Math.max(...fitness),
    worst: Math.min(...fitness),
    average: fitness.reduce((sum, f) => sum + f, 0) / size,
    bestSoFar: state.bestFitnessSoFar,
    evaluations: state.evaluations,
    diversity: pairs === 0 ? 0 : differingGenes / pairs / length,
    distinct: new Set(population.map((i) => i.chromosome.join(''))).size,
    alleleFrequencies: ones.map((k) => k / size),
  };
  cache.set(state, metrics);
  return metrics;
}

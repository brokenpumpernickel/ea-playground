import type { RunState } from './generation';
import type { Bounds, Problem } from './problem';

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
  /** For each gene, the share of individuals with a 1 there (meaningful for the binary problems). */
  readonly alleleFrequencies: readonly number[];
  /** For each gene position, how many individuals have each symbol there: `symbolCounts[gene][symbol]`. */
  readonly symbolCounts: readonly (readonly number[])[];
  /**
   * Only for a problem that reports feasibility: how many individuals of the population are feasible, the best fitness
   * among them (null when there is none), and the best feasible fitness seen in any generation so far.
   */
  readonly feasible?: { readonly count: number; readonly best: number | null; readonly bestSoFar: number | null };
}

function feasibleMetrics(state: RunState): NonNullable<GenerationMetrics['feasible']> {
  const feasible = state.population.filter((i) => i.feasible !== false);
  return { count: feasible.length, best: feasible.length === 0 ? null : Math.max(...feasible.map((i) => i.fitness)), bestSoFar: state.feasibility!.bestSoFar };
}

const cache = new WeakMap<RunState, { readonly alphabetSize: number; readonly bounds: readonly Bounds[] | undefined; readonly metrics: GenerationMetrics }>();

/** The metrics of a state for the problem it belongs to: symbol counts for an alphabet, distances inside the bounds for a real problem. */
export function metricsOfProblem(state: RunState, problem: Pick<Problem, 'alphabet' | 'bounds'>): GenerationMetrics {
  return metricsOf(state, problem.alphabet.length, problem.bounds);
}

/**
 * Mean Euclidean distance over all pairs of points with each gene scaled to its bounds (so every gene spans 0 to 1),
 * divided by the diagonal of that unit box: 0 when all points coincide, 1 for opposite corners.
 */
function realDiversity(state: RunState, bounds: readonly Bounds[]): number {
  const unit = state.population.map((i) => i.chromosome.map((x, k) => (x - bounds[k]!.lo) / (bounds[k]!.hi - bounds[k]!.lo)));
  let total = 0;
  for (let a = 0; a < unit.length; a++) {
    for (let b = a + 1; b < unit.length; b++) total += Math.hypot(...unit[a]!.map((x, k) => x - unit[b]![k]!));
  }
  const pairs = (unit.length * (unit.length - 1)) / 2;
  return pairs === 0 ? 0 : total / pairs / Math.sqrt(bounds.length);
}

/**
 * States are never modified, so the result for a state never changes; asking again returns the same object.
 * `alphabetSize` is how many symbols a gene can take (2 for the binary problems). With `bounds` the genes are real
 * numbers: there are no symbols to count, so `symbolCounts` and `alleleFrequencies` are empty, and diversity is a distance.
 */
export function metricsOf(state: RunState, alphabetSize = 2, bounds?: readonly Bounds[]): GenerationMetrics {
  const known = cache.get(state);
  if (known && known.alphabetSize === alphabetSize && known.bounds === bounds) return known.metrics;

  const population = state.population;
  const size = population.length;
  if (size === 0) throw new Error('Cannot compute metrics for an empty population');

  const fitness = population.map((i) => i.fitness);
  if (bounds) {
    const metrics: GenerationMetrics = {
      generation: state.generation,
      best: Math.max(...fitness),
      worst: Math.min(...fitness),
      average: fitness.reduce((sum, f) => sum + f, 0) / size,
      bestSoFar: state.bestFitnessSoFar,
      evaluations: state.evaluations,
      diversity: realDiversity(state, bounds),
      distinct: new Set(population.map((i) => i.chromosome.join(','))).size,
      alleleFrequencies: [],
      symbolCounts: [],
      ...(state.feasibility ? { feasible: feasibleMetrics(state) } : {}),
    };
    cache.set(state, { alphabetSize, bounds, metrics });
    return metrics;
  }
  const length = population[0]!.chromosome.length;
  const symbolCounts = Array.from({ length }, (_, gene) => {
    const counts = new Array<number>(alphabetSize).fill(0);
    for (const individual of population) {
      const symbol = individual.chromosome[gene]!;
      if (!(symbol >= 0 && symbol < alphabetSize)) throw new Error(`A gene (${symbol}) is outside the alphabet of ${alphabetSize} symbols`);
      counts[symbol]!++;
    }
    return counts;
  });

  // At each gene the pairs that differ are all pairs minus the pairs with the same symbol: (NÂ² âˆ’ Î£ cÂ²) / 2, where c is
  // how many individuals have each symbol there. Summing over genes and dividing by the number of pairs and by the
  // length is the same number as comparing every pair directly (the tests check this), in time proportional to
  // size Ã— length instead of sizeÂ² Ã— length. For two symbols it equals the original kÂ·(N âˆ’ k) formula exactly.
  const differingGenes = symbolCounts.reduce((sum, counts) => sum + (size * size - counts.reduce((squares, c) => squares + c * c, 0)) / 2, 0);
  const pairs = (size * (size - 1)) / 2;

  const metrics: GenerationMetrics = {
    generation: state.generation,
    best: Math.max(...fitness),
    worst: Math.min(...fitness),
    average: fitness.reduce((sum, f) => sum + f, 0) / size,
    bestSoFar: state.bestFitnessSoFar,
    evaluations: state.evaluations,
    diversity: pairs === 0 ? 0 : differingGenes / pairs / length,
    distinct: new Set(population.map((i) => i.chromosome.join(','))).size,
    alleleFrequencies: symbolCounts.map((counts) => (counts[1] ?? 0) / size),
    symbolCounts,
    ...(state.feasibility ? { feasible: feasibleMetrics(state) } : {}),
  };
  cache.set(state, { alphabetSize, bounds, metrics });
  return metrics;
}

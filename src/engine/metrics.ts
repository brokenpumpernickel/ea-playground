import { canonicalRoute, edgeKey, tourEdgeSet } from './chromosome';
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
  /**
   * Only for a problem whose individuals have decoded numbers inside known bounds (the landscape, in either representation):
   * `diversity` is the mean distance between all pairs of points, each value scaled to its bounds, over the diagonal of the
   * bounds (0 when every point is the same, 1 for opposite corners), and `spread` is the standard deviation of each value
   * (over the whole population, not a sample) as a share of that value's range. For a binary-coded run the top-level
   * `diversity` stays the Hamming one; for a real-valued run it is this same number.
   */
  readonly decoded?: { readonly diversity: number; readonly spread: readonly number[] };
  /**
   * Only for a permutation problem (ADR 0007): `diversity` is the mean, over all pairs of individuals, of the share of edges the
   * two tours do not have in common (0 when every tour is the same route, 1 when no pair shares an edge) and `distinct` counts
   * distinct routes (rotations and reversals are one route). `bestRoute` is the best individual's tour (the first one if several
   * tie) and `agreement` has, for each of its edges in tour order, the share of the population that uses that edge.
   */
  readonly tour?: { readonly distinctRoutes: number; readonly bestRoute: readonly number[]; readonly agreement: readonly number[] };
}

function feasibleMetrics(state: RunState): NonNullable<GenerationMetrics['feasible']> {
  const feasible = state.population.filter((i) => i.feasible !== false);
  return { count: feasible.length, best: feasible.length === 0 ? null : Math.max(...feasible.map((i) => i.fitness)), bestSoFar: state.feasibility!.bestSoFar };
}

const cache = new WeakMap<RunState, { readonly alphabetSize: number; readonly bounds: readonly Bounds[] | undefined; readonly metrics: GenerationMetrics }>();

/** The metrics of a state for the problem it belongs to: symbol counts for an alphabet, distances inside the bounds for a real problem. */
export function metricsOfProblem(state: RunState, problem: Pick<Problem, 'alphabet' | 'bounds' | 'decodedBounds' | 'permutation'>): GenerationMetrics {
  if (problem.permutation) return tourMetrics(state);
  const base = metricsOf(state, problem.alphabet.length, problem.bounds);
  const decodedBounds = problem.decodedBounds;
  if (!decodedBounds) return base;
  const known = decodedCache.get(state);
  if (known && known.base === base && known.decodedBounds === decodedBounds) return known.metrics;
  const points = state.population.map((i) => {
    if (!i.values || i.values.length !== decodedBounds.length) throw new Error(`Individual ${i.id} has no decoded values to measure`);
    return i.values;
  });
  const metrics: GenerationMetrics = { ...base, decoded: { diversity: pointsDiversity(points, decodedBounds), spread: spreadOf(points, decodedBounds) } };
  decodedCache.set(state, { base, decodedBounds, metrics });
  return metrics;
}

const tourCache = new WeakMap<RunState, GenerationMetrics>();

/** The metrics of a population of tours: fitness as always, the edge-based measures for what a permutation has instead of alleles. */
function tourMetrics(state: RunState): GenerationMetrics {
  const known = tourCache.get(state);
  if (known) return known;
  const population = state.population;
  const size = population.length;
  if (size === 0) throw new Error('Cannot compute metrics for an empty population');
  const fitness = population.map((i) => i.fitness);
  const edgeSets = population.map((i) => tourEdgeSet(i.chromosome));
  const counts = new Map<string, number>();
  for (const edges of edgeSets) for (const edge of edges) counts.set(edge, (counts.get(edge) ?? 0) + 1);
  // a pair shares an edge when both have it: c·(c − 1)/2 pairs for an edge that c individuals have
  let sharedPairs = 0;
  for (const c of counts.values()) sharedPairs += (c * (c - 1)) / 2;
  const edgesPerTour = edgeSets[0]!.size;
  const pairs = (size * (size - 1)) / 2;
  const best = population.reduce((b, i) => (i.fitness > b.fitness ? i : b));
  const n = best.chromosome.length;
  const bestEdges = n < 2 ? [] : [...new Set(best.chromosome.map((city, k) => edgeKey(city, best.chromosome[(k + 1) % n]!)))];
  const routes = new Set(population.map((i) => canonicalRoute(i.chromosome).join(',')));
  const metrics: GenerationMetrics = {
    generation: state.generation,
    best: Math.max(...fitness),
    worst: Math.min(...fitness),
    average: fitness.reduce((sum, f) => sum + f, 0) / size,
    bestSoFar: state.bestFitnessSoFar,
    evaluations: state.evaluations,
    diversity: pairs === 0 || edgesPerTour === 0 ? 0 : 1 - sharedPairs / pairs / edgesPerTour,
    distinct: routes.size,
    alleleFrequencies: [],
    symbolCounts: [],
    ...(state.feasibility ? { feasible: feasibleMetrics(state) } : {}),
    tour: { distinctRoutes: routes.size, bestRoute: [...best.chromosome], agreement: bestEdges.map((edge) => (counts.get(edge) ?? 0) / size) },
  };
  tourCache.set(state, metrics);
  return metrics;
}

const decodedCache = new WeakMap<RunState, { readonly base: GenerationMetrics; readonly decodedBounds: readonly Bounds[]; readonly metrics: GenerationMetrics }>();

/**
 * Mean Euclidean distance over all pairs of points with each value scaled to its bounds (so every value spans 0 to 1),
 * divided by the diagonal of that unit box: 0 when all points coincide, 1 for opposite corners.
 */
function pointsDiversity(points: readonly (readonly number[])[], bounds: readonly Bounds[]): number {
  const unit = points.map((p) => p.map((x, k) => (x - bounds[k]!.lo) / (bounds[k]!.hi - bounds[k]!.lo)));
  let total = 0;
  for (let a = 0; a < unit.length; a++) {
    for (let b = a + 1; b < unit.length; b++) total += Math.hypot(...unit[a]!.map((x, k) => x - unit[b]![k]!));
  }
  const pairs = (unit.length * (unit.length - 1)) / 2;
  return pairs === 0 ? 0 : total / pairs / Math.sqrt(bounds.length);
}

/** The standard deviation of each value over the population (dividing by N), as a share of its range. */
function spreadOf(points: readonly (readonly number[])[], bounds: readonly Bounds[]): number[] {
  return bounds.map(({ lo, hi }, k) => {
    const mean = points.reduce((sum, p) => sum + p[k]!, 0) / points.length;
    return Math.sqrt(points.reduce((sum, p) => sum + (p[k]! - mean) ** 2, 0) / points.length) / (hi - lo);
  });
}

const realDiversity = (state: RunState, bounds: readonly Bounds[]): number => pointsDiversity(state.population.map((i) => i.chromosome), bounds);

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

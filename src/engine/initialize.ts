import { checkReal, checkTour, parseGenes, parseReal, parseTour, type Chromosome } from './chromosome';
import type { Bounds, Problem, Scores } from './problem';
import type { Rng } from '../run/rng';

/** Where an individual came from, so lineage can be shown without re-deriving it from events. */
export type Origin =
  | { readonly kind: 'initial' }
  | {
      readonly kind: 'offspring';
      /** The generation this offspring was born into (1 for the first generation made from the initial population). */
      readonly generation: number;
      /** Its number within that generation: O1, O2, â€¦ */
      readonly offspring: number;
      readonly parentAId: number;
      readonly parentBId: number;
      /** False when crossover was bypassed (switched off or failed its draw) and the chromosome is a copy of a parent's. */
      readonly recombined: boolean;
      /** 1-based genes that mutation flipped. */
      readonly flipped: readonly number[];
    };

export interface Individual extends Omit<Scores, 'repaired'> {
  /** Stable identity within a run, so events can refer to an individual and its provenance. */
  readonly id: number;
  readonly chromosome: Chromosome;
  readonly origin: Origin;
}

/** The setup stage: the initial population is scored once before generation 1. */
export interface SetupEvent {
  readonly stage: 'setup';
  readonly kind: 'evaluated';
  readonly individual: Individual;
  /** Only when evaluation repaired the chromosome: the chromosome as it was given, before repair. The individual holds the repaired one. */
  readonly repairedFrom?: Chromosome;
}

/**
 * Scores a chromosome and builds the individual it belongs to. When evaluation repairs the chromosome, the individual
 * carries the repaired one and `repairedFrom` is the original (otherwise it is absent, so problems without repair
 * produce exactly the individuals and events they always did).
 */
export function evaluated(
  problem: Problem,
  chromosome: Chromosome,
  identity: Pick<Individual, 'id' | 'origin'>,
): { individual: Individual; repairedFrom?: Chromosome } {
  const { repaired, ...scores } = problem.evaluate(chromosome);
  const changed = repaired !== undefined && repaired.some((gene, k) => gene !== chromosome[k]);
  return {
    individual: { ...identity, chromosome: changed ? [...repaired] : chromosome, ...scores },
    ...(changed ? { repairedFrom: chromosome } : {}),
  };
}

export type Initialization =
  /** Genes are drawn one at a time, individual by individual; a gene is 1 when its draw is below 0.5. */
  | { kind: 'random'; size: number }
  /** Hand-written chromosomes such as '01101', for textbook presets and hand-edited populations. */
  | { kind: 'explicit'; chromosomes: readonly string[] };

export function initialize(
  problem: Problem,
  init: Initialization,
  rng: Rng,
): { population: Individual[]; events: SetupEvent[] } {
  const chromosomes = init.kind === 'random' ? randomChromosomes(problem, init.size, rng) : explicitChromosomes(problem, init.chromosomes);
  const scored = chromosomes.map((chromosome, k) => evaluated(problem, chromosome, { id: k + 1, origin: { kind: 'initial' } }));
  const population = scored.map((s) => s.individual);
  const events = scored.map((s): SetupEvent => ({ stage: 'setup', kind: 'evaluated', individual: s.individual, ...(s.repairedFrom ? { repairedFrom: s.repairedFrom } : {}) }));
  return { population, events };
}

function randomChromosomes(problem: Problem, size: number, rng: Rng): Chromosome[] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Population size must be a whole number of at least 1');
  if (problem.permutation) {
    // a Fisher–Yates shuffle of the cities 0 … n − 1: for i from n − 1 down to 1 one draw u picks j = ⌊u·(i + 1)⌋ and genes i and j swap (n − 1 draws), individuals in order
    return Array.from({ length: size }, () => {
      const tour = Array.from({ length: problem.chromosomeLength }, (_, city) => city);
      for (let i = tour.length - 1; i >= 1; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [tour[i], tour[j]] = [tour[j]!, tour[i]!];
      }
      return tour;
    });
  }
  if (problem.bounds) {
    // a real gene is lo + uÂ·(hi âˆ’ lo), one draw per gene, genes in order, individuals in order
    const bounds = problem.bounds;
    return Array.from({ length: size }, () => bounds.map(({ lo, hi }) => lo + rng.next() * (hi - lo)));
  }
  const k = problem.alphabet.length;
  // the symbol index is k âˆ’ 1 âˆ’ âŒŠuÂ·kâŒ‹, which for the binary alphabet is the original rule: a gene is 1 when its draw is below 0.5
  return Array.from({ length: size }, () => Array.from({ length: problem.chromosomeLength }, () => k - 1 - Math.floor(rng.next() * k)));
}

function explicitChromosomes(problem: Problem, texts: readonly string[]): Chromosome[] {
  if (texts.length === 0) throw new Error('The initial population needs at least one chromosome');
  if (problem.permutation) return texts.map((text, k) => explicitTour(problem.chromosomeLength, text, `Chromosome ${k + 1}`));
  if (problem.bounds) return texts.map((text, k) => explicitReal(problem.bounds!, text, `Chromosome ${k + 1}`));
  return texts.map((text, k) => {
    const label = `Chromosome ${k + 1}`;
    const genes = parseGenes(text, problem.alphabet);
    if (!genes) throw new Error(`${label} ("${text}") may only contain the characters ${describeAlphabet(problem.alphabet)}`);
    if (text.length !== problem.chromosomeLength) {
      throw new Error(`${label} has ${text.length} genes, but this problem needs ${problem.chromosomeLength}`);
    }
    return genes;
  });
}

function explicitTour(n: number, text: string, label: string): Chromosome {
  const tour = parseTour(text);
  if (!tour) throw new Error(`${label} ("${text}") may only contain city numbers separated by spaces`);
  if (tour.length !== n) throw new Error(`${label} has ${tour.length} ${tour.length === 1 ? 'city' : 'cities'}, but this problem needs ${n}`);
  const wrong = checkTour(tour, n);
  if (wrong.length > 0) throw new Error(`${label}: ${wrong.join('; ')}`);
  return tour;
}

function explicitReal(bounds: readonly Bounds[], text: string, label: string): Chromosome {
  const genes = parseReal(text);
  if (!genes) throw new Error(`${label} ("${text}") may only contain numbers separated by spaces`);
  if (genes.length !== bounds.length) {
    throw new Error(`${label} has ${genes.length} ${genes.length === 1 ? 'number' : 'numbers'}, but this problem needs ${bounds.length}`);
  }
  const outside = checkReal(genes, bounds);
  if (outside.length > 0) throw new Error(`${label}: ${outside.join('; ')}`);
  return genes;
}

/** "0 and 1", "a, b and c", or for a long alphabet just how many symbols it has. */
export function describeAlphabet(alphabet: readonly string[]): string {
  if (alphabet.length > 8) return `of the alphabet (${alphabet.length} symbols)`;
  return alphabet.length < 2 ? alphabet.join('') : `${alphabet.slice(0, -1).join(', ')} and ${alphabet[alphabet.length - 1]}`;
}

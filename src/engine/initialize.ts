import { parseBits, type Bit, type Chromosome } from './chromosome';
import type { Problem, Scores } from './problem';
import type { Rng } from './rng';

export interface Individual extends Scores {
  /** Stable identity within a run, so events can refer to an individual and its provenance. */
  readonly id: number;
  readonly chromosome: Chromosome;
}

/** The setup stage: the initial population is scored once before generation 1. */
export interface SetupEvent {
  readonly stage: 'setup';
  readonly kind: 'evaluated';
  readonly individual: Individual;
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
  const population = chromosomes.map(
    (chromosome, k): Individual => ({ id: k + 1, chromosome, ...problem.evaluate(chromosome) }),
  );
  const events = population.map((individual): SetupEvent => ({ stage: 'setup', kind: 'evaluated', individual }));
  return { population, events };
}

function randomChromosomes(problem: Problem, size: number, rng: Rng): Chromosome[] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Population size must be a whole number of at least 1');
  return Array.from({ length: size }, () =>
    Array.from({ length: problem.chromosomeLength }, (): Bit => (rng.next() < 0.5 ? 1 : 0)),
  );
}

function explicitChromosomes(problem: Problem, texts: readonly string[]): Chromosome[] {
  if (texts.length === 0) throw new Error('The initial population needs at least one chromosome');
  return texts.map((text, k) => {
    const label = `Chromosome ${k + 1}`;
    if (!/^[01]*$/.test(text)) throw new Error(`${label} ("${text}") may only contain the characters 0 and 1`);
    if (text.length !== problem.chromosomeLength) {
      throw new Error(`${label} has ${text.length} genes, but this problem needs ${problem.chromosomeLength}`);
    }
    return parseBits(text);
  });
}

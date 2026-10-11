import type { Chromosome } from './chromosome';

/** What a chromosome means and how good it is. Fitness is always maximised (see CONTEXT.md). */
export interface Scores {
  /** The decoded solution shown to students (for Goldberg, the integer x; for a string problem, the string). */
  decoded: number | string;
  /** The problem's native measure of the decoded solution. */
  objective: number;
  /** The maximised quantity derived from the objective by a visible rule. */
  fitness: number;
}

/** A problem with one decoded number can show its fitness as a curve over every value that number can take. */
export interface Landscape {
  /** What the curve is called, for example "f(x) = x²". */
  readonly label: string;
  /** The smallest and largest decoded value (whole numbers). */
  readonly domain: readonly [number, number];
  /** The fitness of a decoded value, the same number `evaluate` gives. */
  fitnessAt(x: number): number;
}

/** One column of the population table: its header, an optional note under it, and how a value is shown. */
export interface ProblemColumn {
  readonly header: string;
  readonly note?: string;
  readonly show: (scores: Scores) => string;
}

/** The one column every problem can offer: its fitness. */
export const fitnessColumn: ProblemColumn = { header: 'Fitness', show: (scores) => String(scores.fitness) };

export interface Problem {
  readonly chromosomeLength: number;
  /** The symbols a gene can take, in order; a gene is stored as its position here (see ADR 0004). Binary is `0`, `1`. */
  readonly alphabet: readonly string[];
  /** The columns the population table and the evaluation view show for this problem, besides the chromosome. */
  readonly columns: readonly ProblemColumn[];
  /** The best fitness any chromosome can have, when it is known; plots draw it as a reference line and stop criteria can aim at it. */
  readonly knownOptimumFitness?: number;
  /** Present when the decoded solution is a single whole number, so its fitness can be drawn as a curve. */
  readonly landscape?: Landscape;
  evaluate(chromosome: Chromosome): Scores;
}

import type { Chromosome } from './chromosome';

/** What a chromosome means and how good it is. Fitness is always maximised (see CONTEXT.md). */
export interface Scores {
  /** The decoded solution shown to students (for Goldberg, the integer x; for a string problem, the string). */
  decoded: number | string;
  /**
   * When the decoded solution is several numbers (the landscape's x and y), those numbers, so views can place an
   * individual without parsing `decoded`. Absent for problems whose solution is not numeric.
   */
  values?: readonly number[];
  /** The problem's native measure of the decoded solution. */
  objective: number;
  /** The maximised quantity derived from the objective by a visible rule. */
  fitness: number;
  /**
   * Whether the individual respects the problem's constraint. Absent means it does, which is what every problem
   * without a constraint reports (see ADR 0005).
   */
  feasible?: boolean;
  /**
   * Set when evaluating the chromosome repaired it (Lamarckian repair): the chromosome after repair. The engine
   * stores it as the individual's chromosome and records the original in the evaluation event, so it is never a field
   * of an individual.
   */
  repaired?: Chromosome;
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
  /**
   * When the column is a quantity measured against a limit (the knapsack's weight against its capacity), the views draw
   * a small bar of it beside the text. The text always says the same thing, so the bar is never the only carrier.
   */
  readonly meter?: (scores: Scores) => { readonly value: number; readonly limit: number };
  /** A column the population table may leave out when the selection columns need the room (what it shows is also in the evaluation view). */
  readonly optional?: boolean;
}

/** The one column every problem can offer: its fitness. */
export const fitnessColumn: ProblemColumn = { header: 'Fitness', show: (scores) => String(scores.fitness) };

/** The closed interval a real-valued gene lives in. */
export interface Bounds {
  readonly lo: number;
  readonly hi: number;
}

/** True when the problem's genes are numbers inside bounds (ADR 0006) rather than symbols of an alphabet. */
export const isRealProblem = (problem: Pick<Problem, 'bounds'>): boolean => problem.bounds !== undefined;

export interface Problem {
  readonly chromosomeLength: number;
  /**
   * The symbols a gene can take, in order; a gene is stored as its position here (see ADR 0004). Binary is `0`, `1`.
   * A real-valued problem (one with `bounds`) has no alphabet: this is empty and its genes are the numbers themselves.
   */
  readonly alphabet: readonly string[];
  /** Present for a real-valued problem: the bounds of each gene, in gene order (ADR 0006); absent for the symbol problems. */
  readonly bounds?: readonly Bounds[];
  /**
   * Present when each individual's `Scores.values` are numbers inside known bounds (the landscape, in either
   * representation): the bounds of each value, so the metrics can measure diversity and spread in decoded space.
   */
  readonly decodedBounds?: readonly Bounds[];
  /** The columns the population table and the evaluation view show for this problem, besides the chromosome. */
  readonly columns: readonly ProblemColumn[];
  /** How a score reads in a sentence, such as "4 of 5 positions match"; without it sentences use the decoded value (x = 13). */
  readonly scoreText?: (scores: Scores) => string;
  /** What the evaluation stage does, in a sentence, when the generic one (decode, score) would not say it. */
  readonly evaluationExplanation?: string;
  /**
   * What evaluation did to this chromosome, for the evaluation view's "What happened" column and the narration: a short
   * `summary` for the table ("skipped F I J K L") and `details` for the narration, one sentence per step. Called with the
   * chromosome as mutation left it, before any repair.
   */
  explainEvaluation?(chromosome: Chromosome): { readonly summary: string; readonly details: readonly string[] };
  /** The columns the evaluation view shows when it should differ from the table's (Goldberg also shows the objective value). */
  readonly evaluationColumns?: readonly ProblemColumn[];
  /**
   * True when some individuals can be infeasible (the knapsack under a penalty), so the plots draw the best feasible
   * fitness as a line of its own; false or absent when every individual is feasible by construction.
   */
  readonly mayBeInfeasible?: boolean;
  /** The best fitness any chromosome can have, when it is known; plots draw it as a reference line and stop criteria can aim at it. */
  readonly knownOptimumFitness?: number;
  /** Present when the decoded solution is a single whole number, so its fitness can be drawn as a curve. */
  readonly landscape?: Landscape;
  evaluate(chromosome: Chromosome): Scores;
}

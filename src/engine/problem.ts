import type { Chromosome } from './chromosome';

/** What a chromosome means and how good it is. Fitness is always maximised (see CONTEXT.md). */
export interface Scores {
  /** The decoded solution shown to students (for Goldberg, the integer x). */
  decoded: number;
  /** The problem's native measure of the decoded solution. */
  objective: number;
  /** The maximised quantity derived from the objective by a visible rule. */
  fitness: number;
}

export interface Problem {
  readonly chromosomeLength: number;
  evaluate(chromosome: Chromosome): Scores;
}

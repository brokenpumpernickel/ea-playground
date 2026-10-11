import { formatGenes, goldberg, type Chromosome, type Problem, type ProblemColumn, type Scores } from '../engine';

/** Numbers as the screen shows them: up to three decimals, with no trailing zeros (0.8, 0.144, 576). */
export const num = (v: number): string => String(Math.round(v * 1000) / 1000);

/** "gene 3", "genes 1 and 3", "genes 1, 3 and 5". */
export const geneList = (genes: readonly number[]): string =>
  genes.length === 1 ? `gene ${genes[0]}` : `genes ${genes.slice(0, -1).join(', ')} and ${genes[genes.length - 1]}`;

/** How a problem's chromosomes and scores are shown: the symbols, and the columns of the tables. */
export interface Display {
  readonly show: (chromosome: Chromosome) => string;
  readonly columns: readonly ProblemColumn[];
  readonly evaluationColumns: readonly ProblemColumn[];
  /** How a score reads in a sentence; absent when sentences use the decoded value. */
  readonly scoreText?: (scores: Scores) => string;
  readonly evaluationExplanation?: string;
}

export const displayOf = (problem: Problem): Display => ({
  show: (chromosome) => formatGenes(chromosome, problem.alphabet),
  columns: problem.columns,
  evaluationColumns: problem.evaluationColumns ?? problem.columns,
  ...(problem.scoreText ? { scoreText: problem.scoreText } : {}),
  ...(problem.evaluationExplanation ? { evaluationExplanation: problem.evaluationExplanation } : {}),
});

/** Goldberg's display, which the models use when they are not given another (the binary problems all look like it). */
export const goldbergDisplay: Display = displayOf(goldberg);

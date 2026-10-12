import { formatGenes, formatReal, goldberg, type Chromosome, type LandscapeProblem, type Problem, type ProblemColumn, type Scores } from '../engine';
import { landscapeInfoOf, type LandscapeInfo } from './landscape-context';

/** Numbers as the screen shows them: up to three decimals, with no trailing zeros (0.8, 0.144, 576). */
export const num = (v: number): string => String(Math.round(v * 1000) / 1000);

/** "gene 3", "genes 1 and 3", "genes 1, 3 and 5". */
export const geneList = (genes: readonly number[]): string =>
  genes.length === 1 ? `gene ${genes[0]}` : `genes ${genes.slice(0, -1).join(', ')} and ${genes[genes.length - 1]}`;

/** How a problem's chromosomes and scores are shown: the symbols, and the columns of the tables. */
export interface Display {
  readonly show: (chromosome: Chromosome) => string;
  /** How many symbols a gene can take. */
  readonly alphabetSize: number;
  /** How many genes a chromosome has. */
  readonly chromosomeLength: number;
  readonly columns: readonly ProblemColumn[];
  readonly evaluationColumns: readonly ProblemColumn[];
  /** How a score reads in a sentence; absent when sentences use the decoded value. */
  readonly scoreText?: (scores: Scores) => string;
  readonly evaluationExplanation?: string;
  /** What evaluation did to a chromosome, in a short form for the table and in full for the narration (see `Problem.explainEvaluation`). */
  readonly explainEvaluation?: Problem['explainEvaluation'];
  /** Present for the landscape: how a chromosome decodes to a point, which the operator views show beside it. */
  readonly landscape?: LandscapeInfo;
}

export const displayOf = (problem: Problem): Display => ({
  show: (chromosome) => (problem.bounds ? formatReal(chromosome, 3) : formatGenes(chromosome, problem.alphabet)),
  alphabetSize: problem.alphabet.length,
  chromosomeLength: problem.chromosomeLength,
  columns: problem.columns,
  evaluationColumns: problem.evaluationColumns ?? problem.columns,
  ...(problem.scoreText ? { scoreText: problem.scoreText } : {}),
  ...(problem.evaluationExplanation ? { evaluationExplanation: problem.evaluationExplanation } : {}),
  ...(problem.explainEvaluation ? { explainEvaluation: problem.explainEvaluation.bind(problem) } : {}),
  ...('pointOf' in problem && 'info' in problem ? { landscape: landscapeInfoOf(problem as LandscapeProblem) } : {}),
});

/** Goldberg's display, which the models use when they are not given another (the binary problems all look like it). */
export const goldbergDisplay: Display = displayOf(goldberg);

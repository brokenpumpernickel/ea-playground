import { binaryAlphabet, type Chromosome } from './chromosome';
import { fitnessColumn, type Problem, type ProblemColumn, type Scores } from './problem';

/**
 * The deceptive trap: the chromosome is divided into equal blocks and each block is scored by a trap function of how many
 * of its genes are 1 (Deb and Goldberg's k-bit trap). With u ones in a block of k genes the block scores k when u = k and
 * k − 1 − u otherwise, so every block is pulled toward all zeros although all ones is best. Fitness is the sum over blocks.
 *
 * Linkage decides which genes make a block. Tight: a block's genes sit side by side. Loose: the blocks are interleaved,
 * block b owns genes b, b + m, b + 2m, … (0-based), a fixed arrangement, so a crossover cut falls inside almost every block.
 */
export type Linkage = 'tight' | 'loose';

export interface TrapOptions {
  /** Genes per block, k. */
  readonly blockSize: number;
  /** Number of blocks, m. */
  readonly blocks: number;
  readonly linkage: Linkage;
}

export const linkages: readonly Linkage[] = ['tight', 'loose'];

export const trapLimits = { minBlockSize: 2, maxBlockSize: 8, minBlocks: 1, maxBlocks: 10, maxGenes: 30 } as const;

export const trapDefaultOptions: TrapOptions = { blockSize: 4, blocks: 5, linkage: 'tight' };

/** The score of one block with `ones` of its `blockSize` genes set to 1. */
export const trapContribution = (ones: number, blockSize: number): number => (ones === blockSize ? blockSize : blockSize - 1 - ones);

export type BlockState = 'optimum' | 'attractor' | 'between';

/** One block of one chromosome, with everything the views explain. */
export interface TrapBlock {
  readonly index: number;
  /** The 0-based positions of the block's genes, in order. */
  readonly genes: readonly number[];
  readonly ones: number;
  readonly contribution: number;
  /** All ones (the block's optimum), all zeros (the deceptive attractor) or in between. */
  readonly state: BlockState;
}

export interface TrapOutcome {
  readonly blocks: readonly TrapBlock[];
  readonly fitness: number;
}

export type TrapProblem = Problem & {
  readonly options: TrapOptions;
  readonly knownOptimumFitness: number;
  /** What all zeros scores, m × (k − 1): where following the fitness uphill from a random start tends to end. */
  readonly attractorFitness: number;
  /** The positions of each block's genes. */
  readonly blockGenes: readonly (readonly number[])[];
  outcomeOf(chromosome: Chromosome): TrapOutcome;
};

const showNumber = (x: unknown): string => (typeof x === 'number' && Number.isFinite(x) ? String(x) : 'not a number');
const wholeIn = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

/** What is wrong with the options, in words, each under the field it concerns. */
export function validateTrapFields(options: TrapOptions): {
  readonly blockSize: string[];
  readonly blocks: string[];
  readonly linkage: string[];
  readonly genes: string[];
} {
  const { minBlockSize, maxBlockSize, minBlocks, maxBlocks, maxGenes } = trapLimits;
  const sizeOk = wholeIn(options.blockSize, minBlockSize, maxBlockSize);
  const blocksOk = wholeIn(options.blocks, minBlocks, maxBlocks);
  return {
    blockSize: sizeOk ? [] : [`Block size must be a whole number from ${minBlockSize} to ${maxBlockSize} (it is ${showNumber(options.blockSize)}).`],
    blocks: blocksOk ? [] : [`The number of blocks must be a whole number from ${minBlocks} to ${maxBlocks} (it is ${showNumber(options.blocks)}).`],
    linkage: linkages.includes(options.linkage) ? [] : [`Linkage must be one of ${linkages.join(', ')}.`],
    genes: sizeOk && blocksOk && options.blockSize * options.blocks > maxGenes ? [`Block size × blocks: at most ${maxGenes} genes in all (${options.blockSize} × ${options.blocks} = ${options.blockSize * options.blocks}).`] : [],
  };
}

/** Everything wrong with these options, or an empty list. */
export function validateTrap(options: TrapOptions): string[] {
  const { blockSize, blocks, linkage, genes } = validateTrapFields(options);
  return [...blockSize, ...blocks, ...linkage, ...genes];
}

/** The 0-based positions of every block's genes. */
function ownership({ blockSize: k, blocks: m, linkage }: TrapOptions): number[][] {
  return Array.from({ length: m }, (_, b) => Array.from({ length: k }, (_, j) => (linkage === 'tight' ? b * k + j : b + j * m)));
}

const state = (ones: number, k: number): BlockState => (ones === k ? 'optimum' : ones === 0 ? 'attractor' : 'between');
const joinDots = (parts: readonly (string | number)[]) => parts.join(' · ');

/** The problem for these options; throws with the first validation message when they are not valid. */
export function trapProblem(options: TrapOptions): TrapProblem {
  const problems = validateTrap(options);
  if (problems.length > 0) throw new Error(problems[0]);
  const { blockSize: k, blocks: m } = options;
  const blockGenes = ownership(options);
  const outcomeOf = (chromosome: Chromosome): TrapOutcome => {
    const blocks = blockGenes.map((genes, index): TrapBlock => {
      const ones = genes.reduce((total, g) => total + (chromosome[g] === 1 ? 1 : 0), 0);
      return { index, genes, ones, contribution: trapContribution(ones, k), state: state(ones, k) };
    });
    return { blocks, fitness: blocks.reduce((total, b) => total + b.contribution, 0) };
  };
  const onesOf = (scores: Scores) => String(scores.decoded).split(' · ').map(Number);
  const columns: ProblemColumn[] = [{ header: 'Decoded', note: '1s per block', optional: true, show: (scores) => String(scores.decoded) }, fitnessColumn];
  return {
    options,
    chromosomeLength: k * m,
    alphabet: binaryAlphabet,
    columns,
    blockGenes,
    knownOptimumFitness: k * m,
    attractorFitness: m * (k - 1),
    scoreText(scores) {
      const ones = onesOf(scores);
      return `ones per block ${scores.decoded} → ${ones.map((u) => trapContribution(u, k)).join(' + ')} = ${scores.fitness}`;
    },
    evaluationExplanation: `Trap: each block of ${k} genes scores ${k} when all its genes are 1 and k − 1 − u otherwise, where u is how many of its genes are 1, so every block is pulled toward all zeros. Fitness is the sum of the ${m} blocks.`,
    evaluate(chromosome): Scores {
      const { blocks, fitness } = outcomeOf(chromosome);
      return { decoded: joinDots(blocks.map((b) => b.ones)), objective: fitness, fitness };
    },
    outcomeOf,
  };
}

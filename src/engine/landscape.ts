import { binaryAlphabet, formatReal, type Chromosome } from './chromosome';
import type { Bounds, Problem, ProblemColumn, Scores } from './problem';

/**
 * The two-dimensional fitness landscape: evolve a point (x, y) on one of four functions. The same landscape can be
 * searched with real-valued genes (the two numbers themselves) or with a binary code of 2·n bits (n per variable) decoded
 * onto the bounds, in plain binary or Gray code (ADR 0006). Fitness is always maximised: the minimised functions use −f.
 */
export type LandscapeFunction = 'single-peak' | 'two-peaks' | 'rastrigin' | 'himmelblau';
export const landscapeFunctions: readonly LandscapeFunction[] = ['single-peak', 'two-peaks', 'rastrigin', 'himmelblau'];

/** Real-valued genes, or bits decoded in plain binary, or bits decoded from Gray code. */
export type LandscapeRepresentation = 'real' | 'plain' | 'gray';
export const landscapeRepresentations: readonly LandscapeRepresentation[] = ['real', 'plain', 'gray'];

export interface LandscapeOptions {
  readonly function: LandscapeFunction;
  readonly representation: LandscapeRepresentation;
  /** Bits per variable, n; used by the binary-coded representations only. */
  readonly bitsPerVariable: number;
}

export const landscapeLimits = { minBits: 4, maxBits: 12 } as const;

export const landscapeDefaultOptions: LandscapeOptions = { function: 'single-peak', representation: 'real', bitsPerVariable: 10 };

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface LandscapeFunctionInfo {
  readonly id: LandscapeFunction;
  readonly name: string;
  /** Whether the function f itself is to be made large or small; fitness is f or −f accordingly. */
  readonly goal: 'maximise' | 'minimise';
  readonly formula: string;
  /** The bounds of both variables. */
  readonly bounds: Bounds;
  /** The point(s) where the objective is best, to double precision. */
  readonly optima: readonly Point[];
  /** f(x, y), the function as written in `formula`. */
  readonly objective: (x: number, y: number) => number;
}

const twoPeaks = (x: number, y: number): number => 0.6 * Math.exp(-((x + 2.5) ** 2 + (y + 2.5) ** 2) / 8) + Math.exp(-((x - 3) ** 2 + (y - 3) ** 2) / 0.5);

export const landscapeFunctionInfo: Record<LandscapeFunction, LandscapeFunctionInfo> = {
  'single-peak': {
    id: 'single-peak',
    name: 'Single peak',
    goal: 'maximise',
    formula: 'f(x, y) = exp(−((x − 2)² + (y + 1)²) / 8)',
    bounds: { lo: -5, hi: 5 },
    optima: [{ x: 2, y: -1 }],
    objective: (x, y) => Math.exp(-((x - 2) ** 2 + (y + 1) ** 2) / 8),
  },
  'two-peaks': {
    id: 'two-peaks',
    name: 'Two peaks',
    goal: 'maximise',
    formula: 'f(x, y) = 0.6·exp(−((x + 2.5)² + (y + 2.5)²) / 8) + exp(−((x − 3)² + (y − 3)²) / 0.5)',
    bounds: { lo: -5, hi: 5 },
    // The narrow hill's top, found numerically (the broad hill's tail shifts it a little from (3, 3)); a test checks it against a grid.
    optima: [{ x: 2.999892804, y: 2.999892804 }],
    objective: twoPeaks,
  },
  rastrigin: {
    id: 'rastrigin',
    name: 'Rastrigin',
    goal: 'minimise',
    formula: 'f(x, y) = 20 + (x² − 10·cos 2πx) + (y² − 10·cos 2πy)',
    bounds: { lo: -5.12, hi: 5.12 },
    optima: [{ x: 0, y: 0 }],
    objective: (x, y) => 20 + (x * x - 10 * Math.cos(2 * Math.PI * x)) + (y * y - 10 * Math.cos(2 * Math.PI * y)),
  },
  himmelblau: {
    id: 'himmelblau',
    name: 'Himmelblau',
    goal: 'minimise',
    formula: 'f(x, y) = (x² + y − 11)² + (x + y² − 7)²',
    bounds: { lo: -5, hi: 5 },
    // The four minima, solved to double precision from x² + y = 11 and x + y² = 7.
    optima: [
      { x: 3, y: 2 },
      { x: -2.805118086952745, y: 3.131312518250573 },
      { x: -3.779310253377747, y: -3.2831859912861696 },
      { x: 3.5844283403304917, y: -1.8481265269644036 },
    ],
    objective: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
  },
};

const show = (value: number): string => formatReal([value], 3);
const showNumber = (value: unknown): string => (typeof value === 'number' ? (Number.isFinite(value) ? String(value) : 'not a number') : JSON.stringify(value));
const wholeIn = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

/** What is wrong with the options, in words, each under the field it concerns. */
export function validateLandscapeFields(options: LandscapeOptions): {
  readonly function: string[];
  readonly representation: string[];
  readonly bitsPerVariable: string[];
} {
  const { minBits, maxBits } = landscapeLimits;
  const binaryCoded = options.representation === 'plain' || options.representation === 'gray';
  return {
    function: landscapeFunctions.includes(options.function) ? [] : [`Function must be one of ${landscapeFunctions.join(', ')} (it is ${showNumber(options.function)}).`],
    representation: landscapeRepresentations.includes(options.representation)
      ? []
      : [`Representation must be one of ${landscapeRepresentations.join(', ')} (it is ${showNumber(options.representation)}).`],
    bitsPerVariable:
      !binaryCoded || wholeIn(options.bitsPerVariable, minBits, maxBits)
        ? []
        : [`Bits per variable must be a whole number from ${minBits} to ${maxBits} (it is ${showNumber(options.bitsPerVariable)}).`],
  };
}

/** Everything wrong with these options, or an empty list. */
export function validateLandscape(options: LandscapeOptions): string[] {
  const fields = validateLandscapeFields(options);
  return [...fields.function, ...fields.representation, ...fields.bitsPerVariable];
}

/** The integer a group of bits spells: in plain binary the bits themselves, in Gray code the integer whose reflected Gray word they are. */
export function integerOfBits(bits: Chromosome, coding: 'plain' | 'gray'): number {
  let value = 0;
  let previous = 0;
  for (const bit of bits) {
    const binary = coding === 'plain' ? bit : previous ^ bit; // Gray: each binary bit is the previous binary bit XOR this Gray bit
    value = value * 2 + binary;
    previous = binary;
  }
  return value;
}

/** lo + (hi − lo) · v / (2ⁿ − 1) for the n bits, so all zeros is the lower bound and the largest integer the upper bound. */
export function decodeVariable(bits: Chromosome, coding: 'plain' | 'gray', { lo, hi }: Bounds): number {
  const v = integerOfBits(bits, coding);
  const top = 2 ** bits.length - 1;
  return v === top ? hi : lo + ((hi - lo) * v) / top;
}

export type LandscapeProblem = Problem & {
  readonly options: LandscapeOptions;
  readonly info: LandscapeFunctionInfo;
  /** The best fitness any point has (the function's optimum, or its negative for a minimised one). */
  readonly knownOptimumFitness: number;
  /** The point a chromosome stands for (its two genes, or its two decoded variables). */
  pointOf(chromosome: Chromosome): Point;
  /** f at a point of the plane. */
  objectiveAt(x: number, y: number): number;
  /** The fitness at a point of the plane, the same number `evaluate` gives for a chromosome standing there. */
  fitnessAt(x: number, y: number): number;
};

/** The problem for these options; throws with the first validation message when they are not valid. */
export function landscapeProblem(options: LandscapeOptions): LandscapeProblem {
  const problems = validateLandscape(options);
  if (problems.length > 0) throw new Error(problems[0]);
  const info = landscapeFunctionInfo[options.function];
  const minimised = info.goal === 'minimise';
  const objectiveAt = info.objective;
  // 0 − f rather than −f, so a fitness of zero is a plain zero and never −0
  const fitnessAt = (x: number, y: number): number => (minimised ? 0 - objectiveAt(x, y) : objectiveAt(x, y));
  const best = info.optima[0]!;
  const knownOptimumFitness = fitnessAt(best.x, best.y);
  const n = options.bitsPerVariable;
  const coding = options.representation === 'gray' ? 'gray' : 'plain';
  const real = options.representation === 'real';
  const pointOf = (chromosome: Chromosome): Point =>
    real
      ? { x: chromosome[0]!, y: chromosome[1]! }
      : { x: decodeVariable(chromosome.slice(0, n), coding, info.bounds), y: decodeVariable(chromosome.slice(n, 2 * n), coding, info.bounds) };

  const text = (scores: Scores) => `(${show(scores.values![0]!)}, ${show(scores.values![1]!)})`;
  const minus = (value: number) => String(value).replace('-', '−');
  const columns: ProblemColumn[] = [
    { header: 'x', show: (scores) => show(scores.values![0]!) },
    { header: 'y', show: (scores) => show(scores.values![1]!) },
    ...(minimised ? [{ header: 'f(x, y)', show: (scores: Scores) => String(scores.objective) }] : []),
    { header: 'Fitness', ...(minimised ? { note: '= −f' } : {}), show: (scores) => String(scores.fitness) },
  ];
  return {
    options,
    info,
    chromosomeLength: real ? 2 : 2 * n,
    alphabet: real ? [] : binaryAlphabet,
    ...(real ? { bounds: [info.bounds, info.bounds] } : {}),
    columns,
    knownOptimumFitness,
    scoreText: (scores) => (minimised ? `${text(scores)}: f = ${minus(scores.objective)}, so fitness = ${minus(scores.fitness)}` : `${text(scores)}: f = ${minus(scores.objective)}, fitness ${minus(scores.fitness)}`),
    evaluationExplanation: `Landscape: the point (x, y)${real ? ' is read from the two genes' : ` is decoded from the ${2 * n} bits (${n} for x, then ${n} for y, in ${coding === 'gray' ? 'Gray code' : 'plain binary'}) onto ${show(info.bounds.lo)} to ${show(info.bounds.hi)}`}, and ${info.formula} is evaluated there.${minimised ? ' f is to be made small, so fitness = −f: higher fitness is always better.' : ' Higher f is better, so fitness = f.'}`,
    pointOf,
    objectiveAt,
    fitnessAt,
    evaluate(chromosome): Scores {
      const { x, y } = pointOf(chromosome);
      const objective = objectiveAt(x, y);
      return { decoded: `(${show(x)}, ${show(y)})`, values: [x, y], objective, fitness: minimised ? 0 - objective : objective };
    },
  };
}

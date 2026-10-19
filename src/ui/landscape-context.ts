import { landscapeFitnessRange, type Bounds, type LandscapeFunction, type LandscapeProblem, type LandscapeRepresentation, type Peak, type Point } from '../engine';

/**
 * Where a view finds the landscape it is drawing chromosomes for: how a chromosome is written (a pair of numbers, or bits
 * per variable decoded in plain binary or Gray code), what the function is called and where a chromosome lands. The app
 * sets it once for the whole screen (a getter, so it follows the running problem); with no landscape running (the other
 * problems, or a view drawn on its own in a test) it gives nothing and nothing changes.
 */
export const landscapeContextKey = Symbol('landscape');

export interface LandscapeInfo {
  readonly id: LandscapeFunction;
  readonly representation: LandscapeRepresentation;
  /** Bits per variable; 0 for the real-valued representation. */
  readonly bits: number;
  readonly name: string;
  /** The bounds of both variables. */
  readonly bounds: Bounds;
  /** Whether f is minimised (fitness = −f). */
  readonly minimised: boolean;
  /** The point a chromosome stands for. */
  pointOf(chromosome: readonly number[]): Point;
  /** The fitness at any point of the plane (what the heatmap and surface draw), the optimum point(s) and the fitness range of the function. */
  fitnessAt(x: number, y: number): number;
  readonly optima: readonly Point[];
  /** The hills worth telling apart; absent where there are too many to name. */
  readonly peaks?: readonly Peak[] | undefined;
  readonly fitnessRange: { readonly min: number; readonly max: number };
}

export type LandscapeGetter = () => LandscapeInfo | undefined;

/** The landscape info of a running landscape problem. */
export const landscapeInfoOf = (problem: LandscapeProblem): LandscapeInfo => ({
  id: problem.info.id,
  representation: problem.options.representation,
  bits: problem.options.representation === 'real' ? 0 : problem.options.bitsPerVariable,
  name: problem.info.name,
  bounds: problem.info.bounds,
  minimised: problem.info.goal === 'minimise',
  pointOf: problem.pointOf.bind(problem),
  fitnessAt: problem.fitnessAt,
  optima: problem.info.optima,
  peaks: problem.info.peaks,
  fitnessRange: landscapeFitnessRange(problem),
});

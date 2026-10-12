import type { Bounds, LandscapeProblem, LandscapeRepresentation, Point } from '../engine';

/**
 * Where a view finds the landscape it is drawing chromosomes for: how a chromosome is written (a pair of numbers, or bits
 * per variable decoded in plain binary or Gray code), what the function is called and where a chromosome lands. The app
 * sets it once for the whole screen (a getter, so it follows the running problem); with no landscape running (the other
 * problems, or a view drawn on its own in a test) it gives nothing and nothing changes.
 */
export const landscapeContextKey = Symbol('landscape');

export interface LandscapeInfo {
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
}

export type LandscapeGetter = () => LandscapeInfo | undefined;

/** The landscape info of a running landscape problem. */
export const landscapeInfoOf = (problem: LandscapeProblem): LandscapeInfo => ({
  representation: problem.options.representation,
  bits: problem.options.representation === 'real' ? 0 : problem.options.bitsPerVariable,
  name: problem.info.name,
  bounds: problem.info.bounds,
  minimised: problem.info.goal === 'minimise',
  pointOf: problem.pointOf.bind(problem),
});

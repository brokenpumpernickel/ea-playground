/**
 * Where a view finds out that the running problem draws its chromosomes as tours (a permutation of cities, ADR 0007): the app
 * sets it once for the whole screen (a getter, so it follows the running problem); with no tour problem running it gives
 * nothing and nothing changes.
 */
export const tourContextKey = Symbol('tour');

export interface TourInfo {
  /** How many cities a tour visits. */
  readonly cities: number;
}

export type TourGetter = () => TourInfo | undefined;

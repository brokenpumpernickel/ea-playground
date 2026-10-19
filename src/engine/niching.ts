import type { Problem } from './problem';

/**
 * Niching: keeping the population spread over several good places instead of letting it all gather on one. Two methods,
 * both measured by the distance the problem gives between two individuals (for the landscape, between their decoded points):
 * fitness sharing (selection weights divided by how crowded each individual\'s neighbourhood is) and deterministic crowding
 * (children replace their nearest parent). The configuration is optional everywhere; absent means none, so a run made
 * without it is exactly the run it always was.
 */
export const nichingMethods = ['none', 'sharing', 'crowding'] as const;
export type NichingMethod = (typeof nichingMethods)[number];

/** The method, and the two numbers of the sharing kernel, kept while another method is chosen (as truncation\'s λ is). */
export interface NichingConfig {
  readonly method: NichingMethod;
  /** The niche radius σ: two individuals closer than this share fitness. In the units of the problem\'s distance (x, y units for the landscape). */
  readonly sigma: number;
  /** The shape α of the triangular kernel sh(d) = 1 − (d/σ)^α: 1 is a straight slope. */
  readonly alpha: number;
}

export const nichingDefaults = { sigma: 2, alpha: 1 } as const;

const shown = (value: unknown): string => (typeof value === 'number' ? (Number.isFinite(value) ? String(value) : 'not a number') : JSON.stringify(value));
const positive = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0;

const methodNames: Record<Exclude<NichingMethod, 'none'>, string> = { sharing: 'Fitness sharing', crowding: 'Deterministic crowding' };

/** What is wrong with a niching configuration for this problem, in words, or an empty list. */
export function validateNiching(niching: NichingConfig, problem: Pick<Problem, 'distance'>): string[] {
  const problems: string[] = [];
  if (!nichingMethods.includes(niching.method)) problems.push(`Niching must be one of ${nichingMethods.join(', ')} (it is ${shown(niching.method)}).`);
  if (!positive(niching.sigma)) problems.push(`σ (the niche radius) must be a number greater than 0 (it is ${shown(niching.sigma)}).`);
  if (!positive(niching.alpha)) problems.push(`α (the shape of the sharing kernel) must be a number greater than 0 (it is ${shown(niching.alpha)}).`);
  if ((niching.method === 'sharing' || niching.method === 'crowding') && problem.distance === undefined) {
    problems.push(`${methodNames[niching.method]} needs a distance between individuals, and this problem has none.`);
  }
  return problems;
}

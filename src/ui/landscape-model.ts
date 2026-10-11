import type { Landscape } from '../engine';
import { niceCeiling } from './plot-models';

/** The curve of fitness over the decoded value, and where the individuals shown on screen sit on it. */
export interface LandscapeMark {
  /** The decoded value. */
  readonly x: number;
  readonly fitness: number;
  /** How many individuals share this value. */
  readonly count: number;
  /** The best fitness in the population. */
  readonly best: boolean;
}

export interface LandscapeModel {
  readonly label: string;
  readonly curve: readonly { readonly x: number; readonly y: number }[];
  readonly domain: readonly [number, number];
  readonly xTicks: readonly number[];
  readonly yMax: number;
  readonly yTicks: readonly number[];
  /** One per distinct decoded value, left to right. */
  readonly marks: readonly LandscapeMark[];
  readonly size: number;
}

export function landscapeModel(landscape: Landscape, population: readonly { readonly decoded: number; readonly fitness: number }[]): LandscapeModel {
  const [lo, hi] = landscape.domain;
  const curve = Array.from({ length: hi - lo + 1 }, (_, k) => ({ x: lo + k, y: landscape.fitnessAt(lo + k) }));
  const yMax = niceCeiling(Math.max(...curve.map((p) => p.y)));
  const best = Math.max(...population.map((i) => i.fitness));
  const counts = new Map<number, number>();
  for (const i of population) counts.set(i.decoded, (counts.get(i.decoded) ?? 0) + 1);
  const marks = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([x, count]): LandscapeMark => ({ x, count, fitness: landscape.fitnessAt(x), best: landscape.fitnessAt(x) === best }));
  // a tick every five values
  const xTicks = Array.from({ length: Math.floor((hi - lo) / 5) + 1 }, (_, k) => lo + 5 * k);
  return { label: landscape.label, curve, domain: landscape.domain, xTicks, yMax, yTicks: Array.from({ length: 5 }, (_, k) => (yMax / 4) * k), marks, size: population.length };
}

import type { Peak } from '../engine';

/** An individual counts as near a peak when its decoded point lies within this distance of the peak's top (the same for every peak and function). */
export const peakRadius = 1.5;

export interface PeakCount {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly count: number;
}

/** How many of the points lie within `peakRadius` of each peak, in the peaks' own order. */
export const occupancy = (peaks: readonly Peak[], points: readonly { readonly x: number; readonly y: number }[]): PeakCount[] =>
  peaks.map((p) => ({ name: p.name, x: p.x, y: p.y, count: points.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) <= peakRadius).length }));

/** The same in words, for the screen and the reader of the screen; `size` is the population's size, so the rest can be said too. */
export const occupancySentence = (rows: readonly PeakCount[], size: number): string =>
  `Within ${peakRadius} of a peak: ${rows.map((r) => `${r.name} ${r.count}`).join(', ')}; elsewhere ${size - rows.reduce((n, r) => n + r.count, 0)} of ${size}.`;

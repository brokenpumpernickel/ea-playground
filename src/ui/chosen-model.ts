import { itemName, type GenerationMetrics } from '../engine';

/** For each item, the share of the population that packs it (its gene is 1). */
export interface ChosenShare {
  /** 1-based position of the item's gene. */
  readonly position: number;
  /** The item's letter. */
  readonly letter: string;
  readonly share: number;
}

/** Read from the metrics' symbol counts, so it is exactly the population the rest of the screen shows. */
export function chosenShares(metrics: GenerationMetrics): ChosenShare[] {
  return metrics.alleleFrequencies.map((share, k) => ({ position: k + 1, letter: itemName(k), share }));
}

/** "A 50 percent": what a bar says, for the accessible description. */
export const describeChosen = (shares: readonly ChosenShare[]): string =>
  `Share of the population that packs each item: ${shares.map((s) => `item ${s.letter}, ${Math.round(s.share * 100)} percent`).join('; ')}.`;

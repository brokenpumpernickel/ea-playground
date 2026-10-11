import type { GaEvent, GaParams, GaSetup, RunState } from '../engine';
import type { Run } from '../run';
import type { BlockInfo } from './block-context';

/**
 * What the trap's "Block states" panel draws: for each block, how many of the individuals have it at all ones (its
 * optimum), at all zeros (the deceptive attractor) or in between, and how many blocks in all sit at each over the
 * recorded generations. Read from the recorded populations, so it is exactly what the rest of the screen shows.
 */
export interface BlockStateCounts {
  /** 1-based. */
  readonly block: number;
  readonly optimum: number;
  readonly between: number;
  readonly attractor: number;
}

export interface BlockStatesModel {
  /** The generation the cursor is on. */
  readonly generation: number;
  /** The individuals in that generation. */
  readonly size: number;
  readonly blocks: readonly BlockStateCounts[];
  /** For every recorded generation, how many blocks in all (summed over blocks and individuals) are at all ones and at all zeros. */
  readonly history: readonly { readonly generation: number; readonly optimum: number; readonly attractor: number }[];
  /** The last seven generations up to the cursor, as a line of text. */
  readonly historyText: string;
}

/** Counts the blocks of a population (anything with a chromosome). */
export function blockStateCounts(info: BlockInfo, population: readonly { readonly chromosome: readonly number[] }[]): BlockStateCounts[] {
  return info.blockGenes.map((genes, b) => {
    let optimum = 0;
    let attractor = 0;
    for (const individual of population) {
      const ones = genes.reduce((total, g) => total + (individual.chromosome[g] === 1 ? 1 : 0), 0);
      if (ones === genes.length) optimum++;
      else if (ones === 0) attractor++;
    }
    return { block: b + 1, optimum, between: population.length - optimum - attractor, attractor };
  });
}

const HISTORY_SHOWN = 7;

export function blockStatesModel(run: Run<GaSetup, GaParams, RunState, GaEvent>, info: BlockInfo, now: number): BlockStatesModel {
  const history = Array.from({ length: run.lastCycle + 1 }, (_, generation) => {
    const counts = blockStateCounts(info, run.snapshot(generation).state.population);
    return { generation, optimum: counts.reduce((t, c) => t + c.optimum, 0), attractor: counts.reduce((t, c) => t + c.attractor, 0) };
  });
  const population = run.snapshot(now).state.population;
  const shown = history.filter((h) => h.generation <= now).slice(-HISTORY_SHOWN);
  const first = shown[0]!.generation;
  const range = shown.length === 1 ? `generation ${first}` : `generations ${first}–${shown[shown.length - 1]!.generation}`;
  return {
    generation: now,
    size: population.length,
    blocks: blockStateCounts(info, population),
    history,
    historyText: `blocks at all zeros, ${range}: ${shown.map((h) => h.attractor).join(' · ')}`,
  };
}

/** The panel in words, for a screen reader. */
export const describeBlockStates = (model: BlockStatesModel): string =>
  `Generation ${model.generation} of the trap, ${model.size} individuals: ${model.blocks.map((c) => `block ${c.block}: ${c.optimum} all ones, ${c.between} in between, ${c.attractor} all zeros`).join('; ')}.`;

import { formatBits, type GaEvent, type RunState } from '../engine';
import type { Position, StageLayout, View } from '../run';

export interface PopulationRow {
  readonly id: number;
  readonly chromosome: string;
  readonly decoded: number;
  readonly fitness: number;
  /** Selection weight and probability, once the selection stage has been entered (roulette only). */
  readonly weight?: number;
  readonly probability?: number;
  /** How many times selection has picked this individual so far; undefined until selection shows any result. */
  readonly parentCount?: number;
  readonly elite: boolean;
}

export interface PopulationTable {
  readonly title: string;
  readonly rows: readonly PopulationRow[];
}

/** True at the last position of a cycle: the end of its last stage. */
export function atCycleEnd(layout: readonly StageLayout[], position: Position): boolean {
  const last = layout.length - 1;
  return position.stage === last && position.micro === layout[last]!.micros;
}

/**
 * What the population table shows at the cursor. Inside a generation it shows the parents (the starting population,
 * with the selection results as they are revealed); once the generation is complete it shows the new population.
 * Cycle 0 is the initial population.
 */
export function populationTable(view: View<RunState, GaEvent>, atEnd: boolean): PopulationTable {
  const cycle = view.position.cycle;
  const showNew = cycle === 0 || atEnd;
  const state = showNew ? view.after : view.before!;
  const events = view.events;

  const eliteIds = new Set(events.flatMap((e) => (e.stage === 'replacement' ? e.elites : [])));
  const shares = new Map<number, { weight: number; probability: number }>();
  const picks: number[] = [];
  let sawPick = false;
  if (!showNew) {
    for (const e of events) {
      if (e.stage !== 'selection') continue;
      if (e.kind === 'probabilities') for (const entry of e.entries) shares.set(entry.individualId, entry);
      if (e.kind === 'spin') (picks.push(e.individualId), (sawPick = true));
      if (e.kind === 'tournament') (picks.push(e.winnerId), (sawPick = true));
    }
  }

  return {
    title: showNew ? `Population · generation ${cycle}` : `Parents · generation ${cycle - 1}`,
    rows: state.population.map((i) => ({
      id: i.id,
      chromosome: formatBits(i.chromosome),
      decoded: i.decoded,
      fitness: i.fitness,
      ...(shares.has(i.id) ? { weight: shares.get(i.id)!.weight, probability: shares.get(i.id)!.probability } : {}),
      ...(sawPick ? { parentCount: picks.filter((p) => p === i.id).length } : {}),
      elite: showNew && eliteIds.has(i.id),
    })),
  };
}

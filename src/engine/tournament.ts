import type { Individual } from './initialize';
import type { Rng } from '../run/rng';
import type { SelectionResult } from './selection';

/** Said once, at the start of the stage, so the view can explain that this method never looks at the weight chain. */
export interface TournamentSetupEvent {
  readonly stage: 'selection';
  readonly kind: 'tournament-setup';
  readonly size: number;
  readonly usesWeightChain: false;
  /** Present (true) when fitness sharing is on: the tournaments compare the shared weights, not the fitness. */
  readonly comparesShared?: true;
}

export interface TournamentContestant {
  readonly individualId: number;
  readonly fitness: number;
  /** Fitness sharing only: the shared weight the tournament compared. */
  readonly shared?: number;
  /** The draw that picked this contestant: population position floor(r × N). */
  readonly r: number;
}

/** One tournament. Tournaments are numbered from 1; each one fills one slot of the mating pool. */
export interface TournamentEvent {
  readonly stage: 'selection';
  readonly kind: 'tournament';
  readonly tournament: number;
  readonly contestants: readonly TournamentContestant[];
  readonly winnerId: number;
  /** True when different individuals shared the best fitness, so the lower population position decided. */
  readonly tieBreak: boolean;
}

export function tournamentSelect(
  population: readonly Individual[],
  size: number,
  count: number,
  rng: Rng,
  /** Fitness sharing: the weight to compare for each individual, in population order; absent compares fitness. */
  shared?: readonly number[],
): SelectionResult {
  if (!Number.isInteger(size) || size < 1) throw new Error('Tournament size must be a whole number of at least 1');
  if (!Number.isInteger(count) || count < 0) throw new Error('The number of tournaments must be a whole number of at least 0');
  if (population.length === 0) throw new Error('Tournament selection needs at least one individual');
  const events: (TournamentSetupEvent | TournamentEvent)[] = [
    { stage: 'selection', kind: 'tournament-setup', size, usesWeightChain: false, ...(shared ? { comparesShared: true as const } : {}) },
  ];
  const pool: number[] = [];
  for (let tournament = 1; tournament <= count; tournament++) {
    const drawn = Array.from({ length: size }, () => {
      const r = rng.next();
      const position = Math.floor(r * population.length);
      return { position, r, individual: population[position]!, value: shared ? shared[position]! : population[position]!.fitness };
    });
    const contestants = drawn.map(({ individual, r, position }): TournamentContestant => ({ individualId: individual.id, fitness: individual.fitness, ...(shared ? { shared: shared[position]! } : {}), r }));
    // best fitness (or shared weight) wins; among equals the lower population position, so the winner never depends on the order of the draws
    const bestFitness = Math.max(...drawn.map((d) => d.value));
    const leaders = drawn.filter((d) => d.value === bestFitness);
    const winner = leaders.reduce((best, d) => (d.position < best.position ? d : best));
    const tieBreak = new Set(leaders.map((d) => d.individual.id)).size > 1;
    pool.push(winner.individual.id);
    events.push({ stage: 'selection', kind: 'tournament', tournament, contestants, winnerId: winner.individual.id, tieBreak });
  }
  return { pool, events };
}

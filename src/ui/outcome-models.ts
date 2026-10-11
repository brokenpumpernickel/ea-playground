import type { GaEvent, GaParams, RunState } from '../engine';
import { goldbergDisplay, type Display } from './format';
import type { View } from '../run';
import { num } from './format';

/**
 * The data the evaluation and replacement views draw, worked out from the events visible at the cursor.
 * Everything shown is read from the engine's own events and states, never recomputed.
 */
type GaView = View<RunState, GaEvent>;

/* ---------------------------------------------------------------- evaluation */

export interface EvaluationRow {
  readonly offspring: number;
  readonly revealed: boolean;
  readonly current: boolean;
  readonly bits: string;
  /** 1-based genes that mutation flipped, so the row can mark them. */
  readonly flipped: readonly number[];
  /** Known once this offspring has been scored. */
  readonly id?: number;
  readonly decoded?: number | string;
  readonly objective?: number;
  readonly fitness?: number;
  /** The problem's evaluation columns for this offspring, in order, once it has been scored. */
  readonly cells?: readonly string[];
  readonly meters?: readonly ({ readonly value: number; readonly limit: number } | undefined)[];
  /** When evaluation repaired the chromosome: as mutation left it, and the 1-based genes repair changed. */
  readonly repairedFrom?: string;
  readonly dropped?: readonly number[];
}

export interface EvaluationModel {
  readonly explanation: string;
  /** The headers (and notes) of the problem's evaluation columns. */
  readonly columns: readonly { readonly header: string; readonly note?: string }[];
  readonly rows: readonly EvaluationRow[];
}

export function evaluationModel(view: GaView, display: Display = goldbergDisplay): EvaluationModel {
  const formatBits = display.show;
  const mutated = view.events.flatMap((e) => (e.stage === 'mutation' ? [e] : []));
  const scored = view.events.flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
  const rows = mutated.map((m, k): EvaluationRow => {
    const event = scored[k];
    if (!event) return { offspring: m.offspring, revealed: false, current: false, bits: formatBits(m.after), flipped: m.flipped };
    const i = event.individual;
    return {
      offspring: event.offspring,
      revealed: true,
      current: k === scored.length - 1,
      bits: formatBits(i.chromosome),
      flipped: m.flipped,
      id: i.id,
      decoded: i.decoded,
      objective: i.objective,
      fitness: i.fitness,
      cells: display.evaluationColumns.map((column) => column.show(i)),
      ...(display.evaluationColumns.some((c) => c.meter) ? { meters: display.evaluationColumns.map((column) => column.meter?.(i)) } : {}),
      ...(event.repairedFrom
        ? { repairedFrom: formatBits(event.repairedFrom), dropped: event.repairedFrom.flatMap((g, k) => (g !== i.chromosome[k] ? [k + 1] : [])) }
        : {}),
    };
  });
  return {
    columns: display.evaluationColumns.map(({ header, note }) => ({ header, ...(note ? { note } : {}) })),
    explanation: display.evaluationExplanation ?? 'Each finished offspring is decoded to a solution x, scored by the objective, and given its fitness and a new individual number.',
    rows,
  };
}

/* ---------------------------------------------------------------- replacement */

export interface ReplacementOld {
  readonly id: number;
  readonly bits: string;
  readonly fitness: number;
  /** Known once the replacement step has run. */
  readonly fate?: 'elite' | 'replaced';
}

export interface ReplacementOffspring {
  readonly offspring: number;
  readonly id: number;
  readonly bits: string;
  readonly fitness: number;
  readonly fate?: 'survives' | 'discarded';
  /** With truncation: 1 = best. */
  readonly rank?: number;
  /** Why this offspring survived or was discarded, in full. */
  readonly note?: string;
  /** Its fitness equals that of an offspring on the other side of the cut, so the order they were made in decided. */
  readonly tie?: boolean;
}

export interface ReplacementNext {
  readonly id: number;
  readonly bits: string;
  readonly fitness: number;
  readonly source: 'elite' | 'offspring';
  /** Which offspring this individual is, when it came from one. */
  readonly offspring?: number;
}

export interface ReplacementModel {
  readonly revealed: boolean;
  /** Whether the old population gets a column of its own (it does for bits; strings leave it to the table beside the stage). */
  readonly showOld: boolean;
  readonly explanation: string;
  /** With truncation, once decided: how the offspring were ranked and where the cut fell. */
  readonly cutNote?: string;
  readonly old: readonly ReplacementOld[];
  readonly offspring: readonly ReplacementOffspring[];
  readonly next: readonly ReplacementNext[];
}

export function replacementModel(view: GaView, params: GaParams, display: Display = goldbergDisplay): ReplacementModel {
  const formatBits = display.show;
  const before = view.before!.population;
  const scored = view.events.flatMap((e) => (e.stage === 'evaluation' ? [e.individual] : []));
  const event = view.events.flatMap((e) => (e.stage === 'replacement' ? [e] : []))[0];
  const n = before.length;
  const elites = params.elites;
  const room = n - elites;
  const truncating = params.truncation?.enabled === true;
  const lambda = scored.length;

  const ranking = event?.ranking;
  const rankOf = new Map(ranking?.map((r) => [r.individualId, r]));
  // equal fitness on both sides of the cut means rank alone cannot say who stays: the offspring made first does
  const cutTie =
    ranking && ranking.length > room && room > 0
      ? (() => {
          const fitness = new Map(scored.map((i) => [i.id, i.fitness]));
          const last = fitness.get(ranking[room - 1]!.individualId)!;
          return last === fitness.get(ranking[room]!.individualId) ? last : undefined;
        })()
      : undefined;

  const old = before.map((i): ReplacementOld => ({
    id: i.id,
    bits: formatBits(i.chromosome),
    fitness: i.fitness,
    ...(event ? { fate: event.elites.includes(i.id) ? ('elite' as const) : ('replaced' as const) } : {}),
  }));

  const offspring = scored.map((i): ReplacementOffspring => {
    const base = { offspring: i.origin.kind === 'offspring' ? i.origin.offspring : 0, id: i.id, bits: formatBits(i.chromosome), fitness: i.fitness };
    if (!event) return base;
    const r = rankOf.get(i.id);
    if (!r) return { ...base, fate: event.population.includes(i.id) ? 'survives' : 'discarded' };
    const tied = cutTie !== undefined && i.fitness === cutTie;
    const tie = tied ? ` · tie on fitness ${num(cutTie)} at the cut: the offspring made earlier ranks first` : '';
    return {
      ...base,
      fate: r.kept ? 'survives' : 'discarded',
      rank: r.rank,
      ...(tied ? { tie: true } : {}),
      note: r.kept ? `rank ${r.rank} of ${lambda}, kept${tie}` : `rank ${r.rank} of ${lambda}: only the best ${room} offspring are kept (N − e = ${room})${tie}`,
    };
  });

  const known = new Map([...before, ...scored].map((i) => [i.id, i]));
  const next = (event?.population ?? []).map((id): ReplacementNext => {
    const i = known.get(id)!;
    const isElite = event!.elites.includes(id);
    return {
      id,
      bits: formatBits(i.chromosome),
      fitness: i.fitness,
      source: isElite ? 'elite' : 'offspring',
      ...(i.origin.kind === 'offspring' ? { offspring: i.origin.offspring } : {}),
    };
  });

  const elitism = elites === 0 ? 'No elitism: no old individual is carried over.' : `Elitism: ${elites} ${elites === 1 ? 'elite' : 'elites'}, the best old ${elites === 1 ? 'individual' : 'individuals'}, copied over unchanged.`;
  const fill = truncating
    ? `Offspring truncation: λ = ${lambda} offspring were made and scored; only the best N − e = ${room} survive.`
    : `All ${room} offspring survive and take the remaining places.`;
  const cutNote = ranking ? `Ranked by fitness (1 = best): the best ${room} are kept, ${lambda - room} discarded.` : undefined;
  // a problem with long chromosomes (strings, a dozen items) has no room for a third column: the old population is the table beside the stage
  const showOld = display.alphabetSize <= 2 && display.chromosomeLength <= 8;
  const where = showOld ? '' : ' The old population is in the table on the right.';
  const kept = !showOld && event && event.elites.length > 0 ? ` Elite${event.elites.length === 1 ? '' : 's'}: ${event.elites.map((id) => `#${id}`).join(', ')}.` : '';
  return { revealed: event !== undefined, showOld, explanation: `${elitism}${kept} ${fill}${where}`, ...(cutNote ? { cutNote } : {}), old, offspring, next };
}

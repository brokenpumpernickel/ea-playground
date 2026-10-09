import { formatBits, weightSteps, type GaEvent, type RunState } from '../engine';
import type { View } from '../run';

/**
 * The data the selection and pairing views draw, worked out from the events visible at the cursor. The views
 * hold no logic of their own, so what they show can always be traced to an event.
 */
type GaView = View<RunState, GaEvent>;

const selectionEvents = (view: GaView) => view.events.flatMap((e) => (e.stage === 'selection' ? [e] : []));
const bitsById = (view: GaView) => new Map(view.before!.population.map((i) => [i.id, { bits: formatBits(i.chromosome), x: i.decoded, fitness: i.fitness }]));

/** The mating pool as far as it is known: one slot per parent, filled in the order selection chose them, null until then. */
function poolSlots(events: ReturnType<typeof selectionEvents>, slots: number): (number | null)[] {
  const chosen = events.flatMap((e) => (e.kind === 'spin' ? [e.individualId] : e.kind === 'tournament' ? [e.winnerId] : []));
  return Array.from({ length: slots }, (_, k) => chosen[k] ?? null);
}

/* ------------------------------------------------------------------ roulette */

export interface WeightColumn {
  readonly label: string;
  /** For example "ε = 1": the step's parameters, named as in the chain editor. */
  readonly params: string;
}

export interface WeightRow {
  readonly id: number;
  readonly fitness: number;
  /** The value after each step of the chain, in column order. */
  readonly steps: readonly number[];
  readonly weight: number;
  readonly probability: number;
  /** The individual is picked when lo ≤ r < hi. */
  readonly lo: number;
  readonly hi: number;
  /** The row the current spin landed on. */
  readonly highlighted: boolean;
}

export interface SpinState {
  readonly spin: number;
  readonly revealed: boolean;
  readonly current: boolean;
  readonly r?: number;
  readonly individualId?: number;
}

export interface RouletteModel {
  readonly columns: readonly WeightColumn[];
  readonly rows: readonly WeightRow[];
  /** Why the default chain was replaced, when it was. */
  readonly autoSwitch?: string;
  readonly spins: readonly SpinState[];
  readonly pool: readonly (number | null)[];
  /** The number of the spin revealed last. */
  readonly current?: number;
}

export function selectionModel(view: GaView): RouletteModel {
  const events = selectionEvents(view);
  const chain = events.find((e) => e.kind === 'weight-chain');
  const table = events.find((e) => e.kind === 'probabilities');
  if (chain?.kind !== 'weight-chain' || table?.kind !== 'probabilities') throw new Error('The selection stage has no weight table to show');

  const revealed = events.flatMap((e) => (e.kind === 'spin' ? [e] : []));
  const last = revealed.at(-1);
  const total = view.micros;

  const columns = chain.columns.map((c): WeightColumn => ({
    label: c.label,
    params: weightSteps[c.step].parameters.map((p) => `${p.label} = ${c.params[p.key]}`).join(', '),
  }));

  return {
    columns,
    rows: table.entries.map((entry, k): WeightRow => ({
      id: entry.individualId,
      fitness: chain.raw[k]!,
      steps: chain.columns.map((c) => c.values[k]!),
      weight: chain.weights[k]!,
      probability: entry.probability,
      lo: entry.lo,
      hi: entry.hi,
      highlighted: last?.individualId === entry.individualId,
    })),
    ...(chain.autoSwitch ? { autoSwitch: chain.autoSwitch.reason.replace(/\s*Switched to Shift.*$/, '') } : {}),
    spins: Array.from({ length: total }, (_, k): SpinState => {
      const spin = revealed[k];
      return spin
        ? { spin: k + 1, revealed: true, current: k === revealed.length - 1, r: spin.r, individualId: spin.individualId }
        : { spin: k + 1, revealed: false, current: false };
    }),
    pool: poolSlots(events, total),
    ...(last ? { current: last.spin } : {}),
  };
}

/* ---------------------------------------------------------------- tournament */

export interface Contestant {
  readonly id: number;
  readonly bits: string;
  readonly fitness: number;
  readonly r: number;
  /** Several contestants can be marked when the same individual was drawn more than once. */
  readonly winner: boolean;
}

export interface TournamentCard {
  readonly tournament: number;
  readonly revealed: boolean;
  readonly current: boolean;
  readonly contestants: readonly Contestant[];
  readonly winnerId?: number;
  /** Different individuals shared the best fitness, so the lower population position decided. */
  readonly tieBreak: boolean;
}

export interface TournamentModel {
  readonly size: number;
  readonly cards: readonly TournamentCard[];
  readonly pool: readonly (number | null)[];
}

export function tournamentModel(view: GaView): TournamentModel {
  const events = selectionEvents(view);
  const setup = events.find((e) => e.kind === 'tournament-setup');
  if (setup?.kind !== 'tournament-setup') throw new Error('The selection stage is not tournament selection');
  const revealed = events.flatMap((e) => (e.kind === 'tournament' ? [e] : []));
  const lookup = bitsById(view);
  const total = view.micros;

  return {
    size: setup.size,
    cards: Array.from({ length: total }, (_, k): TournamentCard => {
      const t = revealed[k];
      if (!t) return { tournament: k + 1, revealed: false, current: false, contestants: [], tieBreak: false };
      return {
        tournament: k + 1,
        revealed: true,
        current: k === revealed.length - 1,
        contestants: t.contestants.map((c): Contestant => ({
          id: c.individualId,
          bits: lookup.get(c.individualId)?.bits ?? '',
          fitness: c.fitness,
          r: c.r,
          winner: c.individualId === t.winnerId,
        })),
        winnerId: t.winnerId,
        tieBreak: t.tieBreak,
      };
    }),
    pool: poolSlots(events, total),
  };
}

/* ------------------------------------------------------------------- pairing */

export interface Parent {
  readonly id: number;
  readonly bits: string;
  readonly x: number;
}

export interface PairCard {
  readonly pair: number;
  readonly slotA: number;
  readonly slotB: number;
  readonly a: Parent;
  readonly b: Parent;
  readonly revealed: boolean;
  readonly current: boolean;
  readonly secondChildDropped: boolean;
}

export interface PairingModel {
  /** The whole mating pool, which selection has already finished. */
  readonly pool: readonly number[];
  readonly pairs: readonly PairCard[];
  readonly notes: readonly string[];
}

export function pairingModel(view: GaView): PairingModel {
  const selection = selectionEvents(view);
  const pool = selection.flatMap((e) => (e.kind === 'spin' ? [e.individualId] : e.kind === 'tournament' ? [e.winnerId] : []));
  const lookup = bitsById(view);
  const parent = (id: number): Parent => ({ id, bits: lookup.get(id)?.bits ?? '', x: lookup.get(id)?.x ?? 0 });
  const revealed = view.events.flatMap((e) => (e.stage === 'pairing' ? [e] : []));
  const total = view.micros;

  // Pairing makes no draws: neighbours in the pool are paired, so every pair's parents are known; `revealed` says whether the cursor has reached it.
  const pairs = Array.from({ length: total }, (_, k): PairCard => {
    const event = revealed[k];
    return {
      pair: k + 1,
      slotA: 2 * k + 1,
      slotB: 2 * k + 2,
      a: parent(pool[2 * k]!),
      b: parent(pool[2 * k + 1]!),
      revealed: Boolean(event),
      current: Boolean(event) && k === revealed.length - 1,
      secondChildDropped: event?.secondChildDropped ?? false,
    };
  });

  const notes: string[] = [];
  const counts = new Map<number, number>();
  for (const id of pool) counts.set(id, (counts.get(id) ?? 0) + 1);
  const named = (ids: readonly number[]) => (ids.length === 1 ? `Individual ${ids[0]}` : `Individuals ${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`);
  const verb = (ids: readonly number[]) => (ids.length === 1 ? 'was' : 'were');
  // one note per number of times picked, so a large pool does not produce a wall of text
  const byCount = new Map<number, number[]>();
  for (const [id, n] of counts) if (n > 1) byCount.set(n, [...(byCount.get(n) ?? []), id]);
  for (const [n, ids] of [...byCount].sort((a, b) => b[0] - a[0])) {
    notes.push(`${named(ids)} ${verb(ids)} selected ${n} times, because selection draws with replacement.`);
  }
  const never = [...lookup.keys()].filter((id) => !counts.has(id));
  if (never.length > 0) notes.push(`${named(never)} ${verb(never)} never selected.`);
  if (pairs.some((p) => p.secondChildDropped)) {
    notes.push('Odd offspring count: one extra parent was drawn, and the second child of the last pair will be dropped.');
  }
  return { pool, pairs, notes };
}

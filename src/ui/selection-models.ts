import { weightSteps, type GaEvent, type RunState } from '../engine';
import { goldbergDisplay, type Display } from './format';
import type { View } from '../run';

/**
 * The data the selection and pairing views draw, worked out from the events visible at the cursor. The views
 * hold no logic of their own, so what they show can always be traced to an event.
 */
type GaView = View<RunState, GaEvent>;

const selectionEvents = (view: GaView) => view.events.flatMap((e) => (e.stage === 'selection' ? [e] : []));
const bitsById = (view: GaView, display: Display) => new Map(view.before!.population.map((i) => [i.id, { bits: display.show(i.chromosome), x: i.decoded, fitness: i.fitness }]));

/** The mating pool as far as it is known: one slot per parent, filled in the order selection chose them, null until then. */
function poolSlots(events: ReturnType<typeof selectionEvents>, slots: number): (number | null)[] {
  const chosen = events.flatMap((e) => (e.kind === 'spin' || e.kind === 'draw' ? [e.individualId] : e.kind === 'tournament' ? [e.winnerId] : []));
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
  /** Fitness sharing only: how crowded the individual's neighbourhood is, and the weight divided by that. */
  readonly count?: number;
  readonly shared?: number;
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
  /** Fitness sharing: its radius and shape. The wheel spins on the shared weights. */
  readonly sharing?: { readonly sigma: number; readonly alpha: number };
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

  const sharing = events.find((e) => e.kind === 'sharing');
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
      ...(sharing?.kind === 'sharing' ? { count: sharing.counts[k]!, shared: sharing.shared[k]! } : {}),
    })),
    ...(chain.autoSwitch ? { autoSwitch: chain.autoSwitch.reason.replace(/\s*Switched to Shift.*$/, '') } : {}),
    ...(sharing?.kind === 'sharing' ? { sharing: { sigma: sharing.sigma, alpha: sharing.alpha } } : {}),
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
  /** Fitness sharing only: the shared weight the tournament compared. */
  readonly shared?: number;
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

/** Fitness sharing in a tournament: what each individual was worth to the comparison, since the tournaments compare shared weights. */
export interface SharingTable {
  readonly sigma: number;
  readonly alpha: number;
  /** Fitness was zero or negative somewhere, so it was shifted to positive before the division. */
  readonly shifted: boolean;
  readonly rows: readonly { readonly id: number; readonly fitness: number; /** The weight before the division: fitness, or fitness shifted to positive. */ readonly weight: number; readonly count: number; readonly shared: number }[];
}

export interface TournamentModel {
  readonly size: number;
  /** The tournaments compare shared weights, not fitness. */
  readonly comparesShared: boolean;
  readonly sharing?: SharingTable;
  readonly cards: readonly TournamentCard[];
  readonly pool: readonly (number | null)[];
}

export function tournamentModel(view: GaView, display: Display = goldbergDisplay): TournamentModel {
  const events = selectionEvents(view);
  const setup = events.find((e) => e.kind === 'tournament-setup');
  if (setup?.kind !== 'tournament-setup') throw new Error('The selection stage is not tournament selection');
  const revealed = events.flatMap((e) => (e.kind === 'tournament' ? [e] : []));
  const lookup = bitsById(view, display);
  const total = view.micros;
  const shared = events.find((e) => e.kind === 'sharing');

  return {
    size: setup.size,
    comparesShared: setup.comparesShared === true,
    ...(shared?.kind === 'sharing'
      ? {
          sharing: {
            sigma: shared.sigma,
            alpha: shared.alpha,
            shifted: shared.shifted,
            rows: shared.individualIds.map((id, k) => ({ id, fitness: lookup.get(id)!.fitness, weight: shared.before[k]!, count: shared.counts[k]!, shared: shared.shared[k]! })),
          },
        }
      : {}),
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
          ...(c.shared !== undefined ? { shared: c.shared } : {}),
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

/* ---------------------------------------------------------- deterministic crowding */

export interface DrawState {
  readonly draw: number;
  readonly revealed: boolean;
  readonly current: boolean;
  readonly r?: number;
  readonly individualId?: number;
  readonly bits?: string;
  /** How many individuals were still waiting to be taken when this draw was made (everyone, for the extra parent). */
  readonly waiting?: number;
  readonly extra?: boolean;
}

export interface CrowdingSelectionModel {
  readonly size: number;
  /** An odd population: one extra parent, drawn from everyone, completes the last pair. */
  readonly extra: boolean;
  readonly draws: readonly DrawState[];
  readonly pool: readonly (number | null)[];
  /** The number of the draw revealed last. */
  readonly current?: number;
}

export function crowdingSelectionModel(view: GaView, display: Display = goldbergDisplay): CrowdingSelectionModel {
  const events = selectionEvents(view);
  const setup = events.find((e) => e.kind === 'crowding-setup');
  if (setup?.kind !== 'crowding-setup') throw new Error('The selection stage is not deterministic crowding');
  const revealed = events.flatMap((e) => (e.kind === 'draw' ? [e] : []));
  const lookup = bitsById(view, display);
  const total = view.micros;
  return {
    size: setup.size,
    extra: setup.extra,
    draws: Array.from({ length: total }, (_, k): DrawState => {
      const d = revealed[k];
      if (!d) return { draw: k + 1, revealed: false, current: false };
      return {
        draw: d.draw,
        revealed: true,
        current: k === revealed.length - 1,
        r: d.r,
        individualId: d.individualId,
        bits: lookup.get(d.individualId)?.bits ?? '',
        waiting: d.extra ? setup.size : setup.size - k,
        ...(d.extra ? { extra: true } : {}),
      };
    }),
    pool: poolSlots(events, total),
    ...(revealed.length > 0 ? { current: revealed.at(-1)!.draw } : {}),
  };
}

/* ------------------------------------------------------------------- pairing */

export interface Parent {
  readonly id: number;
  readonly bits: string;
  readonly x: number | string;
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

export function pairingModel(view: GaView, display: Display = goldbergDisplay): PairingModel {
  const selection = selectionEvents(view);
  const pool = selection.flatMap((e) => (e.kind === 'spin' || e.kind === 'draw' ? [e.individualId] : e.kind === 'tournament' ? [e.winnerId] : []));
  const crowdingSetup = selection.find((e) => e.kind === 'crowding-setup');
  const lookup = bitsById(view, display);
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
  if (crowdingSetup?.kind === 'crowding-setup') {
    notes.push('Deterministic crowding: every individual is a parent exactly once, in random order, so none is picked twice or left out.');
    if (crowdingSetup.extra) notes.push('Odd population: one extra parent was drawn from everyone, and the second child of the last pair will be dropped.');
    return { pool, pairs, notes };
  }
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

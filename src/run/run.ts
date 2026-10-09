import type { Algorithm, RunEvent } from './contract';
import { createRng } from './rng';

/** Where the cursor is: a cycle, one of its stages (by index), and a micro-step in that stage (0 = stage just entered). */
export interface Position {
  readonly cycle: number;
  readonly stage: number;
  readonly micro: number;
}

/** The state at a cycle boundary, with everything needed to make the next cycle. */
export interface Snapshot<State, Params> {
  readonly cycle: number;
  readonly state: State;
  /** The generator's position after this cycle; the next cycle starts from here. */
  readonly rngState: number;
  /** The parameters that were in force while this cycle was made. */
  readonly params: Params;
  readonly stops: readonly string[];
}

export interface StageLayout {
  readonly stage: string;
  readonly micros: number;
}

export interface View<State, Event extends RunEvent> {
  readonly position: Position;
  readonly stage: string;
  readonly micros: number;
  /** The state at the start of the cycle; undefined for cycle 0. */
  readonly before: State | undefined;
  /** The state at the end of the cycle. */
  readonly after: State;
  /** Events visible at this position: all earlier stages, and this stage up to the current micro-step. */
  readonly events: readonly Event[];
  readonly stops: readonly string[];
}

export interface RunInit<Setup, Params> {
  readonly setup: Setup;
  readonly params: Params;
  readonly seed: number;
}

export interface RunOptions {
  /** How many cycles' worth of events to keep. Events are regenerated on demand beyond that. Default 4. */
  readonly eventCacheSize?: number;
}

export interface Run<Setup, Params, State, Event extends RunEvent> {
  readonly seed: number;
  readonly setup: Setup;
  /** The last cycle that exists; the live end. */
  readonly lastCycle: number;
  /** The parameters the next cycle will use: pending ones if there are any, otherwise the last cycle's. */
  readonly parameters: Params;
  readonly pendingParameters: Params | undefined;
  readonly cursor: Position;

  snapshot(cycle: number): Snapshot<State, Params>;
  events(cycle: number): readonly Event[];
  layout(cycle: number): readonly StageLayout[];
  view(): View<State, Event>;

  /** Each move returns false (and does nothing) only when there is nowhere to go. Moving forward past the live end makes the next cycle. */
  forwardMicro(): boolean;
  backMicro(): boolean;
  /** To the end of the current stage, or of the next one if already there. */
  forwardStage(): boolean;
  /** To the end of the previous stage. */
  backStage(): boolean;
  /** To the end of the current cycle, or of the next one if already there. */
  forwardCycle(): boolean;
  /** To the end of the previous cycle. */
  backCycle(): boolean;
  /** To any position that exists in a recorded cycle; false (and no move) otherwise. */
  moveTo(position: Position): boolean;
  /**
   * Records new parameters. At the live end they become pending and apply when the next cycle is made.
   * Scrubbed into the past, nothing changes and the cycles that would be discarded are returned for confirmation;
   * pass `confirmDiscard: true` to truncate the history after the cursor's cycle and then record them.
   */
  setParameters(
    params: Params,
    options?: { confirmDiscard?: boolean },
  ): { status: 'pending' | 'needs-confirmation'; discarded: number[] };
  /** A setup can only change by a reset: a different one is refused, naming what differs. */
  setSetup(setup: Setup): { status: 'unchanged' | 'reset-required'; differences: string[] };
  /** Starts again from cycle 0. Keeps the seed, setup and parameters unless given new ones (the caller supplies any new seed). */
  reset(options?: { setup?: Setup; params?: Params; seed?: number }): void;
  warnings(): string[];
  /** Moves forward a cycle at a time until `condition` holds for the snapshot reached, or `maxCycles` is used up (default 2,000). */
  runUntil(
    condition: (snapshot: Snapshot<State, Params>) => boolean,
    options?: { maxCycles?: number },
  ): { reason: 'condition' | 'max-cycles'; cycles: number };
}

export function createRun<Setup, Params, State, Event extends RunEvent>(
  algorithm: Algorithm<Setup, Params, State, Event>,
  init: RunInit<Setup, Params>,
  options: RunOptions = {},
): Run<Setup, Params, State, Event> {
  const cacheSize = options.eventCacheSize ?? 4;
  const snapshots: Snapshot<State, Params>[] = [];
  const eventCache = new Map<number, readonly Event[]>();
  const layouts = new Map<number, readonly StageLayout[]>();
  let setup = init.setup;
  let seed = init.seed;
  let pending: Params | undefined;
  let cursor: Position = { cycle: 0, stage: 0, micro: 0 };

  const remember = (cycle: number, events: readonly Event[]) => {
    if (cacheSize <= 0) return;
    eventCache.delete(cycle);
    eventCache.set(cycle, events);
    while (eventCache.size > cacheSize) eventCache.delete(eventCache.keys().next().value!);
  };

  /** Cycle 0: the initial state, made from the seed. */
  const begin = (params: Params) => {
    snapshots.length = 0;
    eventCache.clear();
    layouts.clear();
    pending = undefined;
    const rng0 = createRng(seed);
    const started = algorithm.start(setup, rng0);
    snapshots.push({ cycle: 0, state: started.state, rngState: rng0.state(), params, stops: [] });
    remember(0, started.events);
  };
  begin(init.params);

  const snapshot = (cycle: number) => {
    const found = snapshots[cycle];
    if (!found) throw new Error(`Cycle ${cycle} does not exist (the last cycle is ${snapshots.length - 1})`);
    return found;
  };

  const events = (cycle: number): readonly Event[] => {
    const cached = eventCache.get(cycle);
    if (cached) return cached;
    const regenerated =
      cycle === 0
        ? algorithm.start(setup, createRng(seed)).events
        : (() => {
            const before = snapshot(cycle - 1);
            return algorithm.step(before.state, setup, snapshot(cycle).params, createRng(before.rngState)).events;
          })();
    remember(cycle, regenerated);
    return regenerated;
  };

  const layout = (cycle: number): readonly StageLayout[] => {
    const known = layouts.get(cycle);
    if (known) return known;
    const stages: { stage: string; micros: number }[] = [];
    for (const event of events(cycle)) {
      let entry = stages.find((s) => s.stage === event.stage);
      if (!entry) stages.push((entry = { stage: event.stage, micros: 0 }));
      entry.micros = Math.max(entry.micros, algorithm.microStepOf(event) ?? 0);
    }
    layouts.set(cycle, stages);
    return stages;
  };

  const positionsOf = (cycle: number): Position[] =>
    layout(cycle).flatMap((s, stage) => Array.from({ length: s.micros + 1 }, (_, micro) => ({ cycle, stage, micro })));
  const cycleEnd = (cycle: number): Position => positionsOf(cycle).at(-1)!;
  const stageEnds = (cycle: number): Position[] => layout(cycle).map((s, stage) => ({ cycle, stage, micro: s.micros }));
  const compare = (a: Position, b: Position) => a.cycle - b.cycle || a.stage - b.stage || a.micro - b.micro;
  const same = (a: Position, b: Position) => compare(a, b) === 0;

  /** Makes cycles until `cycle` exists. Pending parameters apply to the first cycle made. */
  const ensureCycle = (cycle: number) => {
    while (snapshots.length - 1 < cycle) {
      const before = snapshots.at(-1)!;
      const params = pending ?? before.params;
      pending = undefined;
      const rng = createRng(before.rngState);
      const result = algorithm.step(before.state, setup, params, rng);
      const made = snapshots.length;
      snapshots.push({ cycle: made, state: result.state, rngState: rng.state(), params, stops: result.stops });
      remember(made, result.events);
    }
  };

  cursor = cycleEnd(0);

  return {
    get seed() {
      return seed;
    },
    get setup() {
      return setup;
    },
    get lastCycle() {
      return snapshots.length - 1;
    },
    get parameters() {
      return pending ?? snapshots.at(-1)!.params;
    },
    get pendingParameters() {
      return pending;
    },
    get cursor() {
      return cursor;
    },
    snapshot,
    events,
    layout,
    view() {
      const stageLayout = layout(cursor.cycle)[cursor.stage]!;
      const all = events(cursor.cycle);
      const stageOrder = layout(cursor.cycle).map((s) => s.stage);
      const visible = all.filter((event) => {
        const index = stageOrder.indexOf(event.stage);
        if (index < cursor.stage) return true;
        if (index > cursor.stage) return false;
        const micro = algorithm.microStepOf(event);
        return micro === null || micro <= cursor.micro;
      });
      return {
        position: cursor,
        stage: stageLayout.stage,
        micros: stageLayout.micros,
        before: cursor.cycle === 0 ? undefined : snapshot(cursor.cycle - 1).state,
        after: snapshot(cursor.cycle).state,
        events: visible,
        stops: snapshot(cursor.cycle).stops,
      };
    },
    forwardMicro() {
      const positions = positionsOf(cursor.cycle);
      const index = positions.findIndex((p) => same(p, cursor));
      if (index + 1 < positions.length) {
        cursor = positions[index + 1]!;
      } else {
        ensureCycle(cursor.cycle + 1);
        cursor = positionsOf(cursor.cycle + 1)[0]!;
      }
      return true;
    },
    backMicro() {
      const positions = positionsOf(cursor.cycle);
      const index = positions.findIndex((p) => same(p, cursor));
      if (index > 0) {
        cursor = positions[index - 1]!;
        return true;
      }
      if (cursor.cycle === 0) return false;
      cursor = cycleEnd(cursor.cycle - 1);
      return true;
    },
    forwardStage() {
      const next = stageEnds(cursor.cycle).find((p) => compare(p, cursor) > 0);
      if (next) {
        cursor = next;
      } else {
        ensureCycle(cursor.cycle + 1);
        cursor = stageEnds(cursor.cycle + 1)[0]!;
      }
      return true;
    },
    backStage() {
      const earlier = stageEnds(cursor.cycle).filter((p) => compare(p, cursor) < 0);
      const target = earlier.at(-1) ?? (cursor.cycle > 0 ? stageEnds(cursor.cycle - 1).at(-1) : undefined);
      if (!target) return false;
      cursor = target;
      return true;
    },
    forwardCycle() {
      const end = cycleEnd(cursor.cycle);
      if (!same(cursor, end)) {
        cursor = end;
        return true;
      }
      ensureCycle(cursor.cycle + 1);
      cursor = cycleEnd(cursor.cycle + 1);
      return true;
    },
    backCycle() {
      if (cursor.cycle === 0) return false;
      cursor = cycleEnd(cursor.cycle - 1);
      return true;
    },
    moveTo(position) {
      if (!Number.isInteger(position.cycle) || position.cycle < 0 || position.cycle > snapshots.length - 1) return false;
      const stage = layout(position.cycle)[position.stage];
      if (!stage || !Number.isInteger(position.micro) || position.micro < 0 || position.micro > stage.micros) return false;
      cursor = { cycle: position.cycle, stage: position.stage, micro: position.micro };
      return true;
    },
    setParameters(params, { confirmDiscard = false } = {}) {
      const discarded = Array.from({ length: snapshots.length - 1 - cursor.cycle }, (_, k) => cursor.cycle + 1 + k);
      if (discarded.length > 0) {
        if (!confirmDiscard) return { status: 'needs-confirmation', discarded };
        snapshots.length = cursor.cycle + 1;
        for (const cycle of discarded) {
          eventCache.delete(cycle);
          layouts.delete(cycle);
        }
      }
      pending = params;
      return { status: 'pending', discarded };
    },
    setSetup(next) {
      const differences = algorithm.setupDifferences(setup, next);
      return { status: differences.length === 0 ? 'unchanged' : 'reset-required', differences };
    },
    reset(options = {}) {
      const params = options.params ?? pending ?? snapshots.at(-1)!.params;
      if (options.setup !== undefined) setup = options.setup;
      if (options.seed !== undefined) seed = options.seed;
      begin(params);
      cursor = cycleEnd(0);
    },
    warnings() {
      return algorithm.warnings(setup, pending ?? snapshots.at(-1)!.params);
    },
    runUntil(condition, { maxCycles = 2000 } = {}) {
      for (let cycles = 1; cycles <= maxCycles; cycles++) {
        this.forwardCycle();
        if (condition(snapshot(cursor.cycle))) return { reason: 'condition', cycles };
      }
      return { reason: 'max-cycles', cycles: maxCycles };
    },
  };
}

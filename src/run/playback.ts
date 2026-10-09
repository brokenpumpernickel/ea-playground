import type { RunEvent } from './contract';
import type { Run } from './run';

/**
 * Continuous playback over a run: which tier, play and pause, and when to stop by itself.
 *
 * It never changes what the run contains. It only decides how the cursor moves and how fast, so the same seed
 * gives the same run at every tier. It knows nothing about rendering: it reports which animations a view should
 * play, and the view decides how.
 */

/** Anything that can run a callback later. Injected, because this layer has no access to browser timers. */
export interface Scheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type TierName = 'slow' | 'medium' | 'fast' | 'maximum';

/** Which parts of a view should animate. */
export interface AnimationFlags {
  readonly micro: boolean;
  readonly stage: boolean;
  readonly population: boolean;
  readonly plots: boolean;
}

export interface Tier {
  readonly name: TierName;
  readonly label: string;
  /** What one tick advances: a micro-step, a stage (to its end), or generations (to their ends). */
  readonly unit: 'micro' | 'stage' | 'cycle';
  /** For the `cycle` unit, how many generations one tick may make. */
  readonly cyclesPerTick: number;
  readonly intervalMs: number;
  readonly animate: AnimationFlags;
}

/** The four tiers, slowest first. The slider's stops are the indices into this table. */
export const tiers: readonly Tier[] = [
  { name: 'slow', label: 'Slow', unit: 'micro', cyclesPerTick: 1, intervalMs: 1000, animate: { micro: true, stage: true, population: true, plots: true } },
  { name: 'medium', label: 'Medium', unit: 'stage', cyclesPerTick: 1, intervalMs: 1500, animate: { micro: false, stage: true, population: true, plots: true } },
  { name: 'fast', label: 'Fast', unit: 'cycle', cyclesPerTick: 1, intervalMs: 500, animate: { micro: false, stage: false, population: true, plots: true } },
  { name: 'maximum', label: 'Max', unit: 'cycle', cyclesPerTick: 25, intervalMs: 0, animate: { micro: false, stage: false, population: false, plots: false } },
];

const noAnimation: AnimationFlags = { micro: false, stage: false, population: false, plots: false };

export interface PlaybackStatus {
  readonly playing: boolean;
  readonly pausedBecause?: 'user' | 'stop-criterion' | 'error';
  /** For `stop-criterion`: the criteria that newly hold. */
  readonly stops?: readonly string[];
  /** For `error`: what went wrong. */
  readonly error?: string;
}

export interface Playback {
  readonly tiers: readonly Tier[];
  readonly tier: Tier;
  /** 0 to 3, an index into `tiers`. */
  readonly slider: number;
  setSlider(value: number): void;
  setTier(name: TierName): void;

  readonly status: PlaybackStatus;
  play(): void;
  pause(): void;
  toggle(): void;
  /**
   * Jumps, without animation, to the end of the first generation where a criterion that has not already been
   * reported holds (or gives up after 2,000 generations). Stops any playback in progress first.
   */
  runUntilStop(): { reason: 'condition' | 'max-cycles'; cycles: number };

  readonly reducedMotion: boolean;
  setReducedMotion(on: boolean): void;
  /** What a view should animate now: the tier's flags, or none at all under reduced motion. */
  readonly animate: AnimationFlags;

  /** Called after every change. Returns a function that stops the notifications. */
  subscribe(listener: (status: PlaybackStatus) => void): () => void;
}

export function createPlayback<Setup, Params, State, Event extends RunEvent>(
  run: Run<Setup, Params, State, Event>,
  options: { scheduler: Scheduler; reducedMotion?: boolean },
): Playback {
  const { scheduler } = options;
  let slider = 0;
  let playing = false;
  let paused: Omit<PlaybackStatus, 'playing'> | undefined;
  let reducedMotion = options.reducedMotion ?? false;
  let timer: unknown;
  /** Stop criteria already reported to the student, which playing again should not stop for a second time. */
  let acknowledged = new Set<string>();
  const listeners = new Set<(status: PlaybackStatus) => void>();

  const status = (): PlaybackStatus => (playing ? { playing: true } : { playing: false, ...paused });
  const notify = () => listeners.forEach((listener) => listener(status()));
  const stopTimer = () => {
    if (timer !== undefined) scheduler.clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (delayMs: number) => {
    stopTimer();
    timer = scheduler.setTimeout(tick, delayMs);
  };
  const pauseFor = (why: Omit<PlaybackStatus, 'playing'>) => {
    stopTimer();
    playing = false;
    paused = why;
    notify();
  };

  const atCycleEnd = () => {
    const layout = run.layout(run.cursor.cycle);
    return run.cursor.stage === layout.length - 1 && run.cursor.micro === layout[layout.length - 1]!.micros;
  };

  /** At the end of a generation: the criteria that newly hold. Also forgets acknowledged criteria that no longer hold. */
  const newStops = (): string[] => {
    if (!atCycleEnd()) return [];
    const holding = run.snapshot(run.cursor.cycle).stops;
    acknowledged = new Set([...acknowledged].filter((reason) => holding.includes(reason)));
    const fresh = holding.filter((reason) => !acknowledged.has(reason));
    holding.forEach((reason) => acknowledged.add(reason));
    return fresh;
  };

  function tick() {
    timer = undefined;
    const tier = tiers[slider]!;
    try {
      const moves = tier.unit === 'cycle' ? tier.cyclesPerTick : 1;
      for (let k = 0; k < moves; k++) {
        if (tier.unit === 'micro') run.forwardMicro();
        else if (tier.unit === 'stage') run.forwardStage();
        else run.forwardCycle();
        const fresh = newStops();
        if (fresh.length > 0) {
          pauseFor({ pausedBecause: 'stop-criterion', stops: fresh });
          return;
        }
      }
    } catch (error) {
      pauseFor({ pausedBecause: 'error', error: error instanceof Error ? error.message : String(error) });
      return;
    }
    notify();
    schedule(tier.intervalMs);
  }

  const setSlider = (value: number) => {
    const next = Math.min(tiers.length - 1, Math.max(0, Math.round(value)));
    if (next === slider) return;
    slider = next;
    if (playing) schedule(tiers[slider]!.intervalMs); // the pending tick moves to the new tier's pace
    notify();
  };

  return {
    tiers,
    get tier() {
      return tiers[slider]!;
    },
    get slider() {
      return slider;
    },
    setSlider,
    setTier(name) {
      setSlider(tiers.findIndex((t) => t.name === name));
    },

    get status() {
      return status();
    },
    play() {
      if (playing) return;
      playing = true;
      paused = undefined;
      schedule(0);
      notify();
    },
    pause() {
      if (!playing) return;
      pauseFor({ pausedBecause: 'user' });
    },
    toggle() {
      if (playing) this.pause();
      else this.play();
    },
    runUntilStop() {
      if (playing) pauseFor({ pausedBecause: 'user' });
      const known = new Set([...run.snapshot(run.cursor.cycle).stops, ...acknowledged]);
      const result = run.runUntil((snapshot) => snapshot.stops.some((reason) => !known.has(reason)));
      const holding = run.snapshot(run.cursor.cycle).stops;
      acknowledged = new Set(holding);
      paused = result.reason === 'condition' ? { pausedBecause: 'stop-criterion', stops: holding.filter((r) => !known.has(r)) } : { pausedBecause: 'user' };
      notify();
      return result;
    },

    get reducedMotion() {
      return reducedMotion;
    },
    setReducedMotion(on) {
      if (on === reducedMotion) return;
      reducedMotion = on;
      notify();
    },
    get animate() {
      return reducedMotion ? noAnimation : tiers[slider]!.animate;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

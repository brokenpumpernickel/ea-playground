import { gaAlgorithm, metricsOf, type GaEvent, type GaParams, type GaSetup, type GenerationMetrics, type RunState } from '../engine';
import { createPlayback, createRun, type AnimationFlags, type Playback, type PlaybackStatus, type Position, type Run, type Scheduler, type Tier, type View } from '../run';
import { defaultParams, defaultSeed, defaultSetup } from './config';
import { plotModel, type PlotModel } from './plot-models';
import { atCycleEnd, populationTable, type PopulationTable } from './population';

export type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;

export interface SessionOptions {
  /** Runs callbacks later; the app passes the browser's timers, tests pass a fake. */
  scheduler: Scheduler;
  seed?: number;
  reducedMotion?: boolean;
  /** Where "New seed" gets its number from. */
  drawSeed?: () => number;
}

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

/**
 * Everything the screen needs, in one place: the run, its playback, and the views derived from the cursor.
 * Svelte components read these getters; every action bumps `version`, which is what makes them re-read.
 */
export interface PendingChange {
  readonly params: GaParams;
  /** The generations that will be removed, in order. */
  readonly discarded: readonly number[];
  /** The generation the run will continue from. */
  readonly from: number;
}

const generationRange = (cycles: readonly number[]) => (cycles.length === 1 ? `Generation ${cycles[0]} will` : `Generations ${cycles[0]}–${cycles[cycles.length - 1]} will`);

export function createSession(options: SessionOptions) {
  const run: GaRun = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: options.seed ?? defaultSeed });
  const playback: Playback = createPlayback(run, { scheduler: options.scheduler, reducedMotion: options.reducedMotion });
  const drawSeed = options.drawSeed ?? randomSeed;

  /** Parameters waiting for the user to confirm discarding the generations after the cursor. */
  let change = $state<PendingChange | undefined>(undefined);

  let version = $state(0);
  const bump = () => {
    version++;
  };
  playback.subscribe(bump);

  /** A manual action stops playback first, then changes the run, then tells the screen. */
  const act = (change: () => void) => {
    playback.pause();
    change();
    bump();
  };

  const liveEnd = (): Position => {
    const layout = run.layout(run.lastCycle);
    return { cycle: run.lastCycle, stage: layout.length - 1, micro: layout[layout.length - 1]!.micros };
  };
  const isLive = () => {
    const end = liveEnd();
    const at = run.cursor;
    return at.cycle === end.cycle && at.stage === end.stage && at.micro === end.micro;
  };
  const currentView = (): View<RunState, GaEvent> => run.view();
  const isEnd = () => atCycleEnd(run.layout(run.cursor.cycle), run.cursor);
  const shownMetrics = () => {
    const view = currentView();
    return metricsOf(view.position.cycle === 0 || isEnd() ? view.after : view.before!);
  };

  return {
    run,
    playback,

    /** Changes whenever anything on screen may have changed. */
    get version() {
      return version;
    },
    get view(): View<RunState, GaEvent> {
      void version;
      return currentView();
    },
    get atCycleEnd(): boolean {
      void version;
      return isEnd();
    },
    get table(): PopulationTable {
      void version;
      return populationTable(currentView(), isEnd());
    },
    /** Metrics of the population the table shows. */
    get metrics(): GenerationMetrics {
      void version;
      return shownMetrics();
    },
    /** Every recorded generation's metrics and the plot axes, with the cursor's generation marked. */
    get plots(): PlotModel {
      void version;
      return plotModel(run, shownMetrics().generation, run.setup.problem.knownOptimumFitness);
    },
    get seed(): number {
      void version;
      return run.seed;
    },
    get lastCycle(): number {
      void version;
      return run.lastCycle;
    },
    get status(): PlaybackStatus {
      void version;
      return playback.status;
    },
    get tier(): Tier {
      void version;
      return playback.tier;
    },
    get slider(): number {
      void version;
      return playback.slider;
    },
    get animate(): AnimationFlags {
      void version;
      return playback.animate;
    },

    /** True when the cursor is at the end of the newest generation. */
    get atLive(): boolean {
      void version;
      return isLive();
    },
    /** The notice shown before parameters that would discard later generations are applied. */
    get pendingChange(): PendingChange | undefined {
      return change;
    },
    get discardNotice(): string | undefined {
      return change && `${generationRange(change.discarded)} be discarded. The run continues from generation ${change.from} with the new settings.`;
    },

    stepMicro: () => act(() => void run.forwardMicro()),
    backMicro: () => act(() => void run.backMicro()),
    stepStage: () => act(() => void run.forwardStage()),
    stepGeneration: () => act(() => void run.forwardCycle()),

    /** Moves the cursor to any recorded position; never makes a new generation. */
    scrubTo(position: Position): boolean {
      playback.pause();
      const moved = run.moveTo(position);
      bump();
      return moved;
    },
    /** One micro-step through the recorded history; stays put at the live end rather than making a generation. */
    scrubMicro(delta: 1 | -1): void {
      act(() => {
        if (delta < 0) run.backMicro();
        else if (!isLive()) run.forwardMicro();
      });
    },
    /** A generation at a time through the recorded history; stays put at the live end. */
    scrubGeneration(delta: 1 | -1): void {
      act(() => {
        if (delta < 0) run.backCycle();
        else if (run.cursor.cycle < run.lastCycle) run.forwardCycle();
      });
    },
    returnToLive: () => act(() => void run.moveTo(liveEnd())),

    /**
     * Applies new parameters. Looking at the past, nothing changes until the notice is confirmed, because the
     * generations after the cursor were made with the old ones.
     */
    changeParameters(params: GaParams): { status: 'applied' | 'needs-confirmation' } {
      const result = run.setParameters(params);
      if (result.status === 'pending') {
        change = undefined;
        bump();
        return { status: 'applied' };
      }
      change = { params, discarded: result.discarded, from: run.cursor.cycle };
      bump();
      return { status: 'needs-confirmation' };
    },
    confirmChange() {
      if (!change) return;
      const { params } = change;
      change = undefined;
      act(() => void run.setParameters(params, { confirmDiscard: true }));
    },
    cancelChange() {
      change = undefined;
      bump();
    },

    play: () => playback.play(),
    pause: () => playback.pause(),
    toggle: () => playback.toggle(),
    setSlider: (value: number) => playback.setSlider(value),
    setReducedMotion: (on: boolean) => playback.setReducedMotion(on),
    runUntilStop() {
      const result = playback.runUntilStop();
      bump();
      return result;
    },

    /** Starts again from generation 0 with the same seed. */
    reset: () =>
      act(() => {
        change = undefined;
        run.reset();
      }),
    /** Starts again with a fresh seed. */
    newSeed: () =>
      act(() => {
        change = undefined;
        run.reset({ seed: drawSeed() });
      }),
  };
}

export type Session = ReturnType<typeof createSession>;

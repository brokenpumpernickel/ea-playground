import { gaAlgorithm, metricsOf, type KnapsackProblem, type TrapProblem, type Problem, type GaEvent, type GaParams, type GaSetup, type GenerationMetrics, type RunState } from '../engine';
import { createPlayback, createRun, type AnimationFlags, type Playback, type PlaybackStatus, type Position, type Run, type Scheduler, type Tier, type View } from '../run';
import { defaultParams, defaultSeed, defaultSetup } from './config';
import type { BagInfo } from './bag-context';
import type { BlockInfo } from './block-context';
import { changes, draftOf } from './drawer-model';
import { displayOf, type Display } from './format';
import { entryOf, type ProblemEntry, type ProblemOptions } from './problems';
import type { Preset } from './presets';
import { configOf, type RunConfig } from './run-config';
import { plotModel, type PlotModel } from './plot-models';
import { atCycleEnd, populationTable, type PopulationTable } from './population';

export type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;

export interface SessionOptions {
  /** Runs callbacks later; the app passes the browser's timers, tests pass a fake. */
  scheduler: Scheduler;
  seed?: number;
  /** Start from this configuration (a share link) instead of the defaults. */
  config?: { readonly setup: GaSetup; readonly params: GaParams; readonly seed: number; readonly problem?: string; readonly options?: ProblemOptions };
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

/** A setup change that needs the run to start again: held until the user has seen what it costs. */
export interface PendingReset {
  readonly setup: GaSetup;
  readonly seed: number;
  readonly params: GaParams;
  /** Names of the settings that need the reset, as `changes` words them. */
  readonly changed: readonly string[];
  /** Set when the reset loads a preset, by name. */
  readonly preset?: string;
  /** Set when the reset changes the running problem's own options (the string problem's alphabet and target). */
  readonly options?: ProblemOptions;
  /** Set when the reset switches to another problem. */
  readonly problem?: { readonly id: string; readonly options: ProblemOptions | undefined };
}

const settingPhrase = (label: string) => `the ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
const joinWords = (words: readonly string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

const generationRange = (cycles: readonly number[]) => (cycles.length === 1 ? `Generation ${cycles[0]} will` : `Generations ${cycles[0]}–${cycles[cycles.length - 1]} will`);

export function createSession(options: SessionOptions) {
  const run: GaRun = createRun(gaAlgorithm, {
    setup: options.config?.setup ?? defaultSetup,
    params: options.config?.params ?? defaultParams,
    seed: options.config?.seed ?? options.seed ?? defaultSeed,
  });
  const playback: Playback = createPlayback(run, { scheduler: options.scheduler, reducedMotion: options.reducedMotion });
  const drawSeed = options.drawSeed ?? randomSeed;

  /** Parameters waiting for the user to confirm discarding the generations after the cursor. */
  let change = $state<PendingChange | undefined>(undefined);

  /** Which problem is running, and the options it was set up with (an alphabet and a target, say). */
  let problemId = $state(options.config?.problem ?? 'goldberg');
  let problemOptions = $state<ProblemOptions | undefined>(options.config?.options);
  let reset = $state<PendingReset | undefined>(undefined);
  /** The preset the run was started from, until a setting is changed by hand. */
  let presetName = $state<string | undefined>(undefined);
  /** Bumped whenever the setup, seed or parameters are replaced wholesale, so the drawer rereads them. */
  let epoch = $state(0);

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
    return metricsOf(view.position.cycle === 0 || isEnd() ? view.after : view.before!, run.setup.problem.alphabet.length);
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
    /** How this run's problem shows chromosomes and which columns its tables have. */
    get display(): Display {
      void version;
      return displayOf(run.setup.problem);
    },
    get table(): PopulationTable {
      void version;
      return populationTable(currentView(), isEnd(), displayOf(run.setup.problem));
    },
    /** Metrics of the population the table shows. */
    get metrics(): GenerationMetrics {
      void version;
      return shownMetrics();
    },
    /** Every recorded generation's metrics and the plot axes, with the cursor's generation marked. */
    get plots(): PlotModel {
      void version;
      return plotModel(run, shownMetrics().generation, run.setup.problem.knownOptimumFitness, run.setup.problem.mayBeInfeasible === true);
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

    get pendingReset(): PendingReset | undefined {
      return reset;
    },
    get resetNotice(): string | undefined {
      if (!reset) return undefined;
      const switched = reset.problem ? entryOf(reset.problem.id)?.name : undefined;
      const what = switched && reset.preset ? `Loading the preset “${reset.preset}” switches to the problem ${switched} and restarts the run from generation 0.` : switched ? `Switching to the problem ${switched} restarts the run from generation 0.` : reset.preset ? `Loading the preset “${reset.preset}” restarts the run from generation 0.` : `Changing ${joinWords(reset.changed.map(settingPhrase))} restarts the run from generation 0.`;
      const n = run.lastCycle;
      return n === 0 ? `${what} Nothing recorded will be lost.` : `${what.slice(0, -1)} and discards the ${n} recorded ${n === 1 ? 'generation' : 'generations'} (${n === 1 ? '1' : `1–${n}`}).`;
    },
    /** The configuration the run has now, with any pending parameters applied: what a share link carries. */
    get shareConfig(): RunConfig {
      void version;
      return configOf(run.setup, run.parameters, run.seed, problemId, problemOptions);
    },
    /** The engine problem the run has now (it changes when the problem is switched). */
    get problem(): Problem {
      void version;
      return run.setup.problem;
    },
    /** The running knapsack, as the views need it (items, capacity, how a chromosome is packed); absent for other problems. */
    get bag(): BagInfo | undefined {
      void version;
      const p = run.setup.problem as Partial<KnapsackProblem>;
      return p.outcomeOf && p.options && 'items' in p.options ? { items: p.options.items, capacity: p.options.capacity, mayExceed: p.mayBeInfeasible === true, outcomeOf: p.outcomeOf.bind(p) } : undefined;
    },
    /** The running trap, as the views need it (its blocks and how a chromosome scores in each); absent for other problems. */
    get blocks(): BlockInfo | undefined {
      void version;
      const p = run.setup.problem as Partial<TrapProblem>;
      return p.blockGenes && p.options && p.outcomeOf
        ? { blockSize: p.options.blockSize, blocks: p.options.blocks, linkage: p.options.linkage, blockGenes: p.blockGenes, optimum: p.knownOptimumFitness!, attractor: p.attractorFitness!, outcomeOf: p.outcomeOf.bind(p) }
        : undefined;
    },
    get problemEntry(): ProblemEntry {
      return entryOf(problemId)!;
    },
    get problemOptions(): ProblemOptions | undefined {
      return problemOptions;
    },
    /** Asks to switch to another problem: a reset, with the problem's own defaults, held until confirmed. */
    requestProblemSwitch(id: string) {
      const entry = entryOf(id);
      if (!entry || id === problemId) return;
      const options = entry.defaultOptions();
      reset = {
        setup: { problem: entry.create(options), init: entry.defaults.init },
        seed: entry.defaults.seed,
        params: entry.defaults.params,
        changed: [],
        problem: { id, options },
      };
      bump();
    },
    get epoch(): number {
      return epoch;
    },
    get presetName(): string | undefined {
      return presetName;
    },
    /** Names of operator parameters that have been changed and wait for the next generation boundary. */
    get pending(): string[] {
      void version;
      const waiting = run.pendingParameters;
      if (!waiting) return [];
      return changes(draftOf(waiting, run.setup, run.seed), { params: run.snapshot(run.lastCycle).params, setup: run.setup, seed: run.seed }).operator;
    },

    stepMicro: () => act(() => void run.forwardMicro()),
    backMicro: () => act(() => void run.backMicro()),
    stepStage: () => act(() => void run.forwardStage()),
    backStage: () => act(() => void run.backStage()),
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
        presetName = undefined;
        bump();
        return { status: 'applied' };
      }
      change = { params, discarded: result.discarded, from: run.cursor.cycle };
      bump();
      return { status: 'needs-confirmation' };
    },
    /** Asks to load a preset: a reset to its configuration, which also switches the problem when it belongs to another one. */
    requestPreset(preset: Preset) {
      reset = {
        setup: preset.setup,
        seed: preset.seed,
        params: preset.params,
        changed: [],
        preset: preset.name,
        ...(preset.options ? { options: preset.options } : {}),
        ...(preset.problem !== problemId ? { problem: { id: preset.problem, options: preset.options } } : {}),
      };
      bump();
    },
    /** Holds a change that needs a reset until `confirmReset`. */
    requestReset(request: PendingReset) {
      reset = request;
      bump();
    },
    confirmReset() {
      if (!reset) return;
      const { setup, seed, params } = reset;
      presetName = reset.preset;
      if (reset.problem) {
        problemId = reset.problem.id;
        problemOptions = reset.problem.options;
      } else if (reset.options) {
        problemOptions = reset.options;
      }
      reset = undefined;
      act(() => {
        change = undefined;
        run.reset({ setup, params, seed });
        playback.forgetReports();
        epoch++;
      });
    },
    cancelReset() {
      reset = undefined;
      bump();
    },
    confirmChange() {
      if (!change) return;
      const { params } = change;
      change = undefined;
      presetName = undefined;
      act(() => void run.setParameters(params, { confirmDiscard: true }));
    },
    cancelChange() {
      change = undefined;
      epoch++; // the drawer still shows the edit that was not applied
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
        playback.forgetReports();
        epoch++;
      }),
    /** Starts again with a fresh seed. */
    newSeed: () =>
      act(() => {
        change = undefined;
        run.reset({ seed: drawSeed() });
        playback.forgetReports();
        epoch++;
      }),
  };
}

export type Session = ReturnType<typeof createSession>;

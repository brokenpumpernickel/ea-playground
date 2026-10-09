import type { Rng } from './rng';

/**
 * What every algorithm in the app provides to the shared run layer (ADR 0001, ADR 0003).
 *
 * The run layer knows only: a run is a sequence of cycles (a GA generation, an annealing iteration, …); a cycle
 * is a sequence of named stages; a stage holds events; some events belong to numbered micro-steps. Everything
 * else (populations, mating pools, temperatures) stays inside the algorithm and its views.
 */

/** Every event names the stage it belongs to. Events of one stage are contiguous within a cycle. */
export interface RunEvent {
  readonly stage: string;
}

export interface StepResult<State, Event extends RunEvent> {
  readonly state: State;
  /** The cycle's events, in stage order. */
  readonly events: Event[];
  /** Which stop criteria hold after this cycle. Reported, never enforced. */
  readonly stops: readonly string[];
}

/**
 * - `Setup`: what can only change by a reset (problem, representation, population size, initialization, seed).
 * - `Params`: what may change at a cycle boundary (operators and their probabilities, stop criteria, …).
 * - `State`: a plain value from which the next cycle can be computed. Never modified, only replaced.
 */
export interface Algorithm<Setup, Params, State, Event extends RunEvent> {
  /** Creates the initial state. Its events are the setup stage of cycle 0. */
  start(setup: Setup, rng: Rng): { state: State; events: Event[] };

  /**
   * Makes one whole cycle from a state. Must be a pure function of its arguments and the generator's position,
   * so the run layer can regenerate any cycle's events from the snapshot before it.
   */
  step(state: State, setup: Setup, params: Params, rng: Rng): StepResult<State, Event>;

  /** The 1-based micro-step an event belongs to, or null for events that belong to the whole stage. */
  microStepOf(event: Event): number | null;

  /** The names of the setup fields that differ; empty when the two setups are equivalent. */
  setupDifferences(a: Setup, b: Setup): string[];

  /** Advisories (for example, limits being exceeded). They never refuse anything. */
  warnings(setup: Setup, params: Params): string[];
}

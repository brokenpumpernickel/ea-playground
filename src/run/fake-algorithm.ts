import type { Algorithm, RunEvent } from './contract';
import type { Rng } from './rng';

/**
 * A tiny made-up algorithm for testing the run layer without the GA (the run layer must not know the engine).
 * It draws random numbers so that randomness matters, has stages of different shapes (whole-stage events only,
 * several micro-steps, one micro-step) and stops when its value gets large.
 */
export interface FakeSetup {
  readonly start: number;
  readonly label?: string;
}
export interface FakeParams {
  readonly step: number;
}
export interface FakeState {
  readonly value: number;
  readonly total: number;
}
export interface FakeEvent extends RunEvent {
  readonly kind: string;
  /** The micro-step this event belongs to, or null for the whole stage. */
  readonly micro: number | null;
  readonly draw?: number;
  readonly value?: number;
}

export function createFakeAlgorithm() {
  const calls = { start: 0, step: 0 };
  const algorithm: Algorithm<FakeSetup, FakeParams, FakeState, FakeEvent> = {
    start(setup, rng: Rng) {
      calls.start++;
      const events: FakeEvent[] = [1, 2].map((micro) => ({ stage: 'setup', kind: 'init', micro, draw: rng.next() }));
      return { state: { value: setup.start, total: 0 }, events };
    },
    step(state, _setup, params, rng: Rng) {
      calls.step++;
      const draws = [rng.next(), rng.next(), rng.next()];
      const value = state.value + params.step;
      const events: FakeEvent[] = [
        { stage: 'prepare', kind: 'note', micro: null },
        // a step of 0 does no work, so the stage is absent (its draws are still consumed)
        ...(params.step === 0 ? [] : draws.map((draw, k): FakeEvent => ({ stage: 'work', kind: 'unit', micro: k + 1, draw }))),
        { stage: 'finish', kind: 'sum', micro: 1, value },
      ];
      const next = { value, total: state.total + draws.reduce((a, b) => a + b, 0) };
      return { state: next, events, stops: value >= 100 ? ['big'] : [] };
    },
    microStepOf: (event) => event.micro,
    setupDifferences: (a, b) => (['start', 'label'] as const).filter((key) => a[key] !== b[key]),
    warnings: (_setup, params) => (params.step > 50 ? ['The step is very large.'] : []),
  };
  return { algorithm, calls };
}

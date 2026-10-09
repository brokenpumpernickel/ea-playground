import { goldberg, type GaParams, type GaSetup } from '../engine';

/** The Goldberg x² example as it opens: small enough to follow every step on screen. */
export const defaultSetup: GaSetup = {
  problem: goldberg,
  init: { kind: 'random', size: 6 },
};

export const defaultParams: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50, targetFitness: goldberg.knownOptimumFitness, stagnationWindow: 10 },
};

/** A fixed default so a demo opens the same way every time; "New seed" draws a different one. */
export const defaultSeed = 42;

import type { Algorithm } from '../run/contract';
import { runGeneration, startRun, type GenerationConfig, type GenerationEvent, type RunState } from './generation';
import type { Individual, Initialization, SetupEvent } from './initialize';
import type { Problem } from './problem';

/** What can only change by a reset: the problem, and how the initial population is made (including its size). */
export interface GaSetup {
  readonly problem: Problem;
  readonly init: Initialization;
}

/** What may change at a generation boundary: everything about how a generation is made. */
export type GaParams = Omit<GenerationConfig, 'problem'>;

export type GaEvent = SetupEvent | GenerationEvent;

/** Limits the app is designed for. Beyond them it warns rather than refusing. */
export const supportedLimits = { populationSize: 500, generationLimit: 2000 } as const;

const populationSizeOf = (init: Initialization) => (init.kind === 'random' ? init.size : init.chromosomes.length);

/** The genetic algorithm, as the shared run layer sees it (ADR 0003). */
export const gaAlgorithm: Algorithm<GaSetup, GaParams, RunState, GaEvent> = {
  start(setup, rng) {
    const { state, events } = startRun(setup.problem, setup.init, rng);
    return { state, events };
  },

  step(state, setup, params, rng) {
    return runGeneration(state, { ...params, problem: setup.problem }, rng);
  },

  microStepOf(event) {
    switch (event.stage) {
      case 'setup':
        return event.individual.id;
      case 'selection':
        return event.kind === 'spin' ? event.spin : null; // the weight table and probabilities belong to the whole stage
      case 'pairing':
      case 'crossover':
        return event.pair;
      case 'mutation':
      case 'evaluation':
        return event.offspring;
      case 'replacement':
        return 1;
    }
  },

  setupDifferences(a, b) {
    const differences: string[] = [];
    if (a.problem !== b.problem) differences.push('problem');
    if (populationSizeOf(a.init) !== populationSizeOf(b.init)) differences.push('populationSize');
    if (JSON.stringify(a.init) !== JSON.stringify(b.init)) {
      // two random initializations of different size differ only in size; anything else is a different initialization
      const sizeOnly = a.init.kind === 'random' && b.init.kind === 'random';
      if (!sizeOnly) differences.push('initialization');
    }
    return differences;
  },

  warnings(setup, params) {
    const warnings: string[] = [];
    const size = populationSizeOf(setup.init);
    if (size > supportedLimits.populationSize) {
      warnings.push(`Population size ${size} is above the supported limit of ${supportedLimits.populationSize}, so the app may become slow.`);
    }
    if (params.stop.generationLimit > supportedLimits.generationLimit) {
      warnings.push(
        `A generation limit of ${params.stop.generationLimit} is above the supported maximum of ${supportedLimits.generationLimit}, so scrubbing and plots may become slow.`,
      );
    }
    return warnings;
  },
};

/**
 * Rebuilds a population from events alone: the setup events give the initial population, and a generation's
 * replacement event names the next one, whose members are either carried over from `before` or evaluated offspring.
 * It exists so tests (and any view) can check that the events agree with what the engine actually produced.
 */
export function populationFromEvents(before: readonly Individual[], events: readonly GaEvent[]): Individual[] {
  const setup = events.flatMap((e) => (e.stage === 'setup' ? [e.individual] : []));
  if (setup.length > 0) return setup;

  const replacement = events.find((e) => e.stage === 'replacement');
  if (!replacement) throw new Error('These events do not include a replacement, so they do not describe a new population');
  const known = new Map<number, Individual>(before.map((i) => [i.id, i]));
  for (const event of events) if (event.stage === 'evaluation') known.set(event.individual.id, event.individual);
  return replacement.population.map((id) => {
    const individual = known.get(id);
    if (!individual) {
      throw new Error(`Individual ${id} is named by the replacement but is in neither the old population nor the evaluated offspring`);
    }
    return individual;
  });
}

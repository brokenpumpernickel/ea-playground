import type { Chromosome } from './chromosome';
import { crossover, type CrossoverConfig, type CrossoverEvent } from './crossover';
import { evaluated, initialize, type Individual, type Initialization, type SetupEvent } from './initialize';
import { mutate, type MutationConfig, type MutationEvent } from './mutation';
import { matingPoolSize, pair, type PairingEvent } from './pairing';
import type { Problem } from './problem';
import type { Rng } from '../run/rng';
import { rouletteSelect, type SelectionEvent, type SelectionResult } from './selection';
import { tournamentSelect } from './tournament';
import { transformWeights, type StepSpec, type WeightChainEvent } from './weights';

/**
 * Everything needed to continue a run from a generation boundary. A plain value: `runGeneration` never
 * modifies the state it is given and returns a new one, so ticket 12 can keep each one as a snapshot.
 */
export interface RunState {
  readonly generation: number;
  readonly population: readonly Individual[];
  /** The id the next new individual gets. */
  readonly nextId: number;
  /** How many individuals have been scored so far, including the initial population. */
  readonly evaluations: number;
  readonly bestFitnessSoFar: number;
  /** The last generation in which best-so-far strictly improved (0 = the initial population). */
  readonly lastImprovementGeneration: number;
  /**
   * Only for a problem that reports feasibility (its individuals carry a `feasible` flag): the best fitness among
   * feasible individuals so far (null until there is one) and the generation it last improved. The stop criteria use
   * these instead of the overall best, so an infeasible individual never counts as success. Absent otherwise, and
   * then the criteria use `bestFitnessSoFar` exactly as before (ADR 0005).
   */
  readonly feasibility?: { readonly bestSoFar: number | null; readonly lastImprovement: number };
}

export type SelectionConfig =
  | {
      readonly method: 'roulette';
      /** Raw fitness is turned into selection weights by this chain (see weights.ts). */
      readonly chain: readonly StepSpec[];
    }
  | {
      /** Each parent is the best of `size` individuals drawn with replacement. Compares fitness directly, so there is no chain. */
      readonly method: 'tournament';
      readonly size: number;
    };

export interface StopConfig {
  /** Stop reporting from this many generations on. */
  readonly generationLimit: number;
  /** Reached when the best fitness seen so far is at least this. */
  readonly targetFitness?: number;
  /** Reached when best so far has not strictly improved for this many generations. */
  readonly stagnationWindow?: number;
}

export type StopReason = 'generation-limit' | 'target-reached' | 'stagnation';

/**
 * Which stop criteria currently hold. They are reported, never enforced: whoever is playing the run decides
 * whether to stop, and stepping on past a criterion keeps working.
 */
export function stopReasons(state: RunState, stop: StopConfig): StopReason[] {
  if (!Number.isInteger(stop.generationLimit) || stop.generationLimit < 1) {
    throw new Error('The generation limit must be a whole number of at least 1');
  }
  if (stop.stagnationWindow !== undefined && (!Number.isInteger(stop.stagnationWindow) || stop.stagnationWindow < 1)) {
    throw new Error('The stagnation window must be a whole number of at least 1');
  }
  if (stop.targetFitness !== undefined && !Number.isFinite(stop.targetFitness)) {
    throw new Error('The target fitness must be a finite number');
  }
  const reasons: StopReason[] = [];
  if (state.generation >= stop.generationLimit) reasons.push('generation-limit');
  const best = state.feasibility ? state.feasibility.bestSoFar : state.bestFitnessSoFar;
  const lastImprovement = state.feasibility ? state.feasibility.lastImprovement : state.lastImprovementGeneration;
  if (stop.targetFitness !== undefined && best !== null && best >= stop.targetFitness) reasons.push('target-reached');
  if (stop.stagnationWindow !== undefined && state.generation - lastImprovement >= stop.stagnationWindow) {
    reasons.push('stagnation');
  }
  return reasons;
}

/**
 * The replacement stage: how many offspring a generation makes, and who survives into the next population.
 * Generational replacement with elitism is the default; (μ+λ) and similar policies slot in here without
 * changing the stage list.
 */
export interface ReplacementStrategy {
  offspringCount(populationSize: number): number;
  /**
   * `elites` lists the ids carried over from the old population (for the view); the population is the next one, in order.
   * `ranking`, when the policy chose among the offspring, says how every offspring ranked and which were kept.
   */
  replace(
    population: readonly Individual[],
    offspring: readonly Individual[],
  ): { population: Individual[]; elites: readonly number[]; ranking?: readonly RankedOffspring[] };
}

/** One offspring's place in a ranking by fitness (1 = best); ties keep the order the offspring were made in. */
export interface RankedOffspring {
  readonly individualId: number;
  readonly offspring: number;
  readonly rank: number;
  readonly kept: boolean;
}

/**
 * Offspring replace the population, except the `elites` best individuals, which are copied over unchanged and first.
 *
 * With `lambda` (offspring truncation), λ offspring are made and scored, and only the best N − e survive, best first
 * after the elites. Without it, N − e offspring are made and all survive, in the order they were made.
 */
export function generationalReplacement(elites: number, options: { lambda?: number } = {}): ReplacementStrategy {
  const { lambda } = options;
  return {
    offspringCount(populationSize) {
      if (!Number.isInteger(elites) || elites < 0 || elites > populationSize) {
        throw new Error(`Elites must be a whole number from 0 to the population size (${populationSize})`);
      }
      const needed = populationSize - elites;
      if (lambda === undefined) return needed;
      if (!Number.isInteger(lambda) || lambda < needed) {
        throw new Error(`λ must be a whole number of at least N − e = ${needed}, so there are enough offspring to fill the population`);
      }
      return lambda;
    },
    replace(population, offspring) {
      const kept = bestFirst(population).slice(0, elites);
      if (lambda === undefined) return { population: [...kept, ...offspring], elites: kept.map((i) => i.id) };

      const room = population.length - elites;
      const ranked = bestFirst(offspring); // a stable sort: equal fitness keeps the order of generation
      const ranking = ranked.map((individual, k): RankedOffspring => ({
        individualId: individual.id,
        offspring: individual.origin.kind === 'offspring' ? individual.origin.offspring : k + 1,
        rank: k + 1,
        kept: k < room,
      }));
      return { population: [...kept, ...ranked.slice(0, room)], elites: kept.map((i) => i.id), ranking };
    },
  };
}

export interface GenerationConfig {
  readonly problem: Problem;
  readonly selection: SelectionConfig;
  readonly crossover: CrossoverConfig;
  readonly mutation: MutationConfig;
  /** How many of the best individuals are copied unchanged into the next population (used when no `replacement` is given). */
  readonly elites: number;
  /**
   * Offspring truncation: make λ offspring and keep the best N − e (see `generationalReplacement`). Off by default;
   * λ is remembered while it is off. Ignored when a custom `replacement` is given.
   */
  readonly truncation?: { readonly enabled: boolean; readonly lambda: number };
  /** Replaces generational-with-elites. */
  readonly replacement?: ReplacementStrategy;
  readonly stop: StopConfig;
}

export interface EvaluationEvent {
  readonly stage: 'evaluation';
  readonly kind: 'evaluated';
  /** The offspring number this individual was made from. */
  readonly offspring: number;
  readonly individual: Individual;
  /** Only when evaluation repaired the chromosome: the chromosome as mutation left it. The individual holds the repaired one. */
  readonly repairedFrom?: Chromosome;
}

export interface ReplacementEvent {
  readonly stage: 'replacement';
  readonly kind: 'summary';
  /** Ids of the elites carried over, best first. */
  readonly elites: readonly number[];
  /** Ids of the next population, in order. */
  readonly population: readonly number[];
  /** With offspring truncation: every offspring in rank order, and whether it was kept. */
  readonly ranking?: readonly RankedOffspring[];
}

export type GenerationEvent =
  | WeightChainEvent
  | SelectionEvent
  | PairingEvent
  | CrossoverEvent
  | MutationEvent
  | EvaluationEvent
  | ReplacementEvent;

/** Highest fitness first; ties keep their population order (a stable sort), so the lower index wins. */
function bestFirst(population: readonly Individual[]): Individual[] {
  return [...population].sort((a, b) => b.fitness - a.fitness);
}

function nextFeasibility(
  was: { readonly bestSoFar: number | null; readonly lastImprovement: number },
  offspring: readonly Individual[],
  generation: number,
): { readonly bestSoFar: number | null; readonly lastImprovement: number } {
  const best = bestFeasible(offspring);
  const improved = best !== null && (was.bestSoFar === null || best > was.bestSoFar);
  return improved ? { bestSoFar: best, lastImprovement: generation } : was;
}

/** The best fitness among the feasible individuals (an absent flag means feasible), or null when there is none. */
function bestFeasible(individuals: readonly Individual[]): number | null {
  const feasible = individuals.filter((i) => i.feasible !== false);
  return feasible.length === 0 ? null : Math.max(...feasible.map((i) => i.fitness));
}

export function startRun(
  problem: Problem,
  init: Initialization,
  rng: Rng,
): { state: RunState; events: SetupEvent[] } {
  const { population, events } = initialize(problem, init, rng);
  const best = Math.max(...population.map((i) => i.fitness));
  const reportsFeasibility = population.some((i) => i.feasible !== undefined);
  return {
    state: {
      generation: 0,
      population,
      nextId: population.length + 1,
      evaluations: population.length,
      bestFitnessSoFar: best,
      lastImprovementGeneration: 0,
      ...(reportsFeasibility ? { feasibility: { bestSoFar: bestFeasible(population), lastImprovement: 0 } } : {}),
    },
    events,
  };
}

export function runGeneration(
  state: RunState,
  config: GenerationConfig,
  rng: Rng,
): { state: RunState; events: GenerationEvent[]; stops: StopReason[] } {
  stopReasons(state, config.stop); // refuses a nonsense stop configuration before anything is drawn
  const replacement =
    config.replacement ??
    generationalReplacement(config.elites, config.truncation?.enabled ? { lambda: config.truncation.lambda } : {});
  const offspringCount = replacement.offspringCount(state.population.length);
  const events: GenerationEvent[] = [];
  const generation = state.generation + 1;

  // 1. selection: roulette (the weight chain, then spins) or tournaments, filling the mating pool
  const poolSize = matingPoolSize(offspringCount);
  let selected: SelectionResult;
  if (config.selection.method === 'tournament') {
    selected = tournamentSelect(state.population, config.selection.size, poolSize, rng);
    events.push(...selected.events);
  } else {
    const weights = transformWeights(state.population.map((i) => i.fitness), config.selection.chain);
    if (!weights.ok) throw new Error(weights.problem);
    events.push(weights.event);
    selected = rouletteSelect(state.population, weights.weights, poolSize, rng);
    events.push(...selected.events);
  }

  // 2. pairing (no draws), 3. crossover, 4. mutation
  const paired = pair(selected.pool, offspringCount);
  events.push(...paired.events);
  const crossed = crossover(state.population, paired.pairs, config.crossover, rng);
  events.push(...crossed.events);
  const mutated = mutate(crossed.offspring, config.mutation, rng, config.problem.alphabet.length);
  events.push(...mutated.events);

  // 5. evaluation of the offspring: they become individuals with ids, scores and provenance
  let nextId = state.nextId;
  const offspring = mutated.mutated.map((m, k): Individual => {
    const child = crossed.offspring[k]!;
    const event = crossed.events.find((e) => e.pair === child.pair)!;
    const { individual, repairedFrom } = evaluated(config.problem, m.chromosome as Chromosome, {
      id: nextId++,
      origin: {
        kind: 'offspring',
        generation,
        offspring: m.offspring,
        parentAId: event.parentAId,
        parentBId: event.parentBId,
        recombined: event.decision === 'recombined',
        flipped: m.flipped,
      },
    });
    events.push({ stage: 'evaluation', kind: 'evaluated', offspring: m.offspring, individual, ...(repairedFrom ? { repairedFrom } : {}) });
    return individual;
  });

  // 6. replacement
  const { population, elites, ranking } = replacement.replace(state.population, offspring);
  events.push({
    stage: 'replacement',
    kind: 'summary',
    elites,
    population: population.map((i) => i.id),
    ...(ranking ? { ranking } : {}),
  });

  const best = Math.max(...offspring.map((i) => i.fitness), state.bestFitnessSoFar);
  const improved = best > state.bestFitnessSoFar;
  const next: RunState = {
    generation,
    population,
    nextId,
    evaluations: state.evaluations + offspring.length,
    bestFitnessSoFar: improved ? best : state.bestFitnessSoFar,
    lastImprovementGeneration: improved ? generation : state.lastImprovementGeneration,
    ...(state.feasibility ? { feasibility: nextFeasibility(state.feasibility, offspring, generation) } : {}),
  };
  return { state: next, events, stops: stopReasons(next, config.stop) };
}

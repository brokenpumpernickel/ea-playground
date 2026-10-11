import type { GaParams } from './algorithm';
import { binaryAlphabet } from './chromosome';
import { handleBag, handlings, type BagOutcome, type Handling } from './knapsack-handling';
import {
  builtInKnapsack,
  itemName,
  optimalBag,
  validateKnapsackInstanceFields,
  type KnapsackInstance,
  type KnapsackItem,
} from './knapsack-instance';
import type { Problem, ProblemColumn, Scores } from './problem';

/**
 * The knapsack problem: pack items of given weights and values into a bag of limited capacity. One binary gene per item
 * (1 = pack it). How an overweight bag is dealt with is part of the setup (`handling`), because it changes what fitness
 * means; `rho` is the penalty per unit of excess weight and only matters for the penalty method.
 */
export interface KnapsackOptions {
  readonly items: readonly KnapsackItem[];
  readonly capacity: number;
  readonly handling: Handling;
  readonly rho: number;
}

export const knapsackRhoLimits = { min: 0, max: 1000 } as const;

export type KnapsackProblem = Problem & {
  readonly knownOptimumFitness: number;
  readonly options: KnapsackOptions;
  /** How a chromosome was packed and scored, with everything the views explain (what was skipped or dropped, the penalty). */
  outcomeOf(chromosome: readonly number[]): BagOutcome;
};

const showNumber = (x: unknown): string => (typeof x === 'number' && Number.isFinite(x) ? String(x) : 'not a number');

/** What is wrong with the options, in words, each under the field it concerns. */
export function validateKnapsackFields(options: KnapsackOptions): {
  readonly items: string[];
  readonly capacity: string[];
  readonly handling: string[];
  readonly rho: string[];
} {
  const { items, capacity } = validateKnapsackInstanceFields(options);
  const handling = handlings.includes(options.handling) ? [] : [`The constraint handling must be one of ${handlings.join(', ')}.`];
  const ok = typeof options.rho === 'number' && Number.isFinite(options.rho) && options.rho >= knapsackRhoLimits.min && options.rho <= knapsackRhoLimits.max;
  const rho = ok ? [] : [`The penalty ρ must be a number from ${knapsackRhoLimits.min} to ${knapsackRhoLimits.max} (it is ${showNumber(options.rho)}).`];
  return { items, capacity, handling, rho };
}

/** Everything wrong with these options, or an empty list. */
export function validateKnapsack(options: KnapsackOptions): string[] {
  const { items, capacity, handling, rho } = validateKnapsackFields(options);
  return [...items, ...capacity, ...handling, ...rho];
}

/** A number as the tables show it: a minus sign rather than a hyphen, and at most two decimals. */
const fmt = (x: number): string => {
  const text = Number.isInteger(x) ? String(Math.abs(x)) : Math.abs(x).toFixed(2).replace(/\.?0+$/, '');
  return `${x < 0 ? '−' : ''}${text}`;
};

const explanations: Record<Handling, (rho: number) => string> = {
  decoder: () =>
    'First-fit decoder: walk the items A, B, C, … and pack an item if its gene is 1 and it still fits; otherwise skip it and carry on. The chromosome is not changed, and every bag is feasible.',
  penalty: (rho) =>
    `Penalty: the bag is exactly the genes set to 1. Overweight bags are allowed but pay ρ = ${fmt(rho)} per unit of excess weight: fitness = value − penalty.`,
  'repair-lamarckian': () =>
    'Lamarckian repair: while the bag is too heavy, drop the item with the lowest value per weight (ties: the later item). The repaired genes replace the chromosome.',
  'repair-baldwinian': () =>
    'Baldwinian repair: while the bag is too heavy, drop the item with the lowest value per weight (ties: the later item). The chromosome keeps its genes; only the bag and the score use the repaired set.',
};

/** The problem for these options; throws with the first validation message when they are not valid. */
export function knapsackProblem(options: KnapsackOptions): KnapsackProblem {
  const problems = validateKnapsack(options);
  if (problems.length > 0) throw new Error(problems[0]);
  const instance: KnapsackInstance = { items: options.items, capacity: options.capacity };
  const { handling, rho } = options;
  /** The packed set is what `decoded` spells out, so the columns can recompute weight from the scores alone. */
  const weightOf = (scores: Scores) => [...String(scores.decoded)].reduce((total, letter) => total + instance.items[letter.charCodeAt(0) - 65]!.weight, 0);
  const columns: ProblemColumn[] = [
    {
      header: 'Bag weight',
      note: `of ${instance.capacity}`,
      meter: (scores) => ({ value: weightOf(scores), limit: instance.capacity }),
      show: (scores) => {
        const weight = weightOf(scores);
        const over = weight - instance.capacity;
        return `${weight}/${instance.capacity} ${over > 0 ? `✗ +${over}` : '✓'}`;
      },
    },
    { header: 'Value', optional: true, show: (scores) => String(scores.objective) },
    ...(handling === 'penalty' ? [{ header: 'Penalty', show: (scores: Scores) => (scores.objective === scores.fitness ? '0' : `−${fmt(scores.objective - scores.fitness)}`) }] : []),
    { header: 'Fitness', show: (scores) => fmt(scores.fitness) },
  ];
  return {
    options,
    chromosomeLength: instance.items.length,
    alphabet: binaryAlphabet,
    columns,
    knownOptimumFitness: optimalBag(instance).value,
    scoreText(scores) {
      const letters = [...String(scores.decoded)];
      const weight = weightOf(scores);
      const over = weight - instance.capacity;
      const bag = letters.length === 0 ? 'packs nothing' : `packs ${letters.join(', ')}`;
      const penalty = scores.objective - scores.fitness;
      return `${bag}: weight ${weight} of ${instance.capacity}, value ${scores.objective}${over > 0 ? `, over by ${over} → penalty ${fmt(penalty)}` : ''}`;
    },
    evaluationExplanation: explanations[handling](rho),
    explainEvaluation(chromosome) {
      const r = handleBag(instance, handling, rho, chromosome);
      const names = (items: readonly { item: number }[]) => items.map((x) => itemName(x.item)).join(' ');
      if (handling === 'decoder') {
        return {
          summary: r.skipped.length > 0 ? `skipped ${names(r.skipped)}` : 'everything fits',
          details: r.skipped.map((s) => `skipped ${itemName(s.item)}: ${s.weight} > ${s.room} left`),
        };
      }
      if (handling === 'penalty') {
        return { summary: r.excess > 0 ? `over by ${r.excess} (${fmt(rho)} × ${r.excess})` : 'fits: no penalty', details: [] };
      }
      return {
        summary: r.dropped.length > 0 ? `dropped ${names(r.dropped)}` : 'everything fits',
        details: r.dropped.map((d) => `dropped ${itemName(d.item)}: ${instance.items[d.item]!.value}/${instance.items[d.item]!.weight} = ${d.ratio.toFixed(2)} per weight`),
      };
    },
    evaluate: (chromosome) => handleBag(instance, handling, rho, chromosome).scores,
    outcomeOf: (chromosome) => handleBag(instance, handling, rho, chromosome),
  };
}

/**
 * The setup the knapsack opens with, as plain data. The population, parameters and the penalty are placeholders until
 * ticket 13 measures them.
 */
export const knapsackDefaults: {
  readonly options: KnapsackOptions;
  readonly populationSize: number;
  readonly params: GaParams;
} = {
  options: { items: builtInKnapsack.items, capacity: builtInKnapsack.capacity, handling: 'decoder', rho: 4 },
  populationSize: 12,
  params: {
    selection: { method: 'tournament', size: 3 },
    crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
    mutation: { enabled: true, mode: 'per-gene', probability: 0.08 },
    elites: 0,
    stop: { generationLimit: 60, targetFitness: 123, stagnationWindow: 30 },
  },
};


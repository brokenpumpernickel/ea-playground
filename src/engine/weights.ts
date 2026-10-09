/**
 * The weight transformation chain: an ordered list of visible steps that turns raw fitness into the
 * selection weights roulette-wheel selection spins over (see CONTEXT.md, "Weight transformation").
 *
 * Each step is a small descriptor in `weightSteps`; adding a step means adding one entry.
 */

export type StepSpec =
  | { step: 'identity' }
  | { step: 'shift'; epsilon?: number }
  | { step: 'rank' }
  | { step: 'linear-ranking'; pressure?: number }
  | { step: 'power'; exponent?: number };

export type StepName = StepSpec['step'];

/** One column of the selection table: a step, its resolved parameters, and the values it produced per individual. */
export interface WeightChainColumn {
  readonly step: StepName;
  readonly label: string;
  readonly params: Record<string, number>;
  readonly values: readonly number[];
}

export interface WeightChainEvent {
  readonly stage: 'selection';
  readonly kind: 'weight-chain';
  /** Fitness as it entered the chain. */
  readonly raw: readonly number[];
  readonly columns: readonly WeightChainColumn[];
  /** The last column, which is what roulette actually uses. */
  readonly weights: readonly number[];
  /** Present when the default chain was replaced because Identity could not give valid weights; the UI shows it as a banner. */
  readonly autoSwitch?: { readonly from: readonly StepSpec[]; readonly to: readonly StepSpec[]; readonly reason: string };
}

export type WeightChainResult =
  | { ok: true; weights: number[]; event: WeightChainEvent }
  /** `stepIndex` is 0-based, for highlighting the step in the chain editor. */
  | { ok: false; problem: string; stepIndex?: number };

/** A tunable number on a step, described so the UI can label and bound it, and the validator can explain a refusal. */
export interface ParameterSpec {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
  /** When true the value must be strictly greater than `min`. */
  readonly minExclusive?: boolean;
}

/** What the values flowing through the chain currently are. Linear ranking is only meaningful on ranks. */
type ValueKind = 'fitness' | 'ranks' | 'values';

export interface StepDescriptor {
  readonly label: string;
  /** A plain-language sentence for the chain editor. */
  readonly description: string;
  readonly parameters: readonly ParameterSpec[];
  /** The step only makes sense when the values entering it are ranks. */
  readonly needsRanks?: boolean;
  /** The step is undefined for negative values, so they are refused rather than quietly mis-scored. */
  readonly needsNonNegative?: boolean;
  readonly output: (input: ValueKind) => ValueKind;
  apply(values: readonly number[], params: Record<string, number>): number[];
}

export const weightSteps: Record<StepName, StepDescriptor> = {
  identity: {
    label: 'Identity',
    description: 'Use the values as they are. Only valid when no value is negative.',
    parameters: [],
    output: (input) => input,
    apply: (values) => [...values],
  },
  shift: {
    label: 'Shift',
    description: 'Subtract the lowest value and add epsilon, so the worst individual gets weight epsilon and none is negative.',
    parameters: [
      {
        key: 'epsilon',
        label: 'ε',
        description: 'The weight the worst individual ends up with. Larger values flatten the preference for the best.',
        default: 1,
        min: 0,
        minExclusive: true,
      },
    ],
    output: () => 'values',
    apply: (values, { epsilon }) => {
      const lowest = Math.min(...values);
      return values.map((v) => v - lowest + epsilon!);
    },
  },
  rank: {
    label: 'Rank',
    description: 'Replace each value by its rank: 1 for the worst, N for the best. Ties share the average of their ranks.',
    parameters: [],
    output: () => 'ranks',
    apply: (values) => averageRanks(values),
  },
  'linear-ranking': {
    label: 'Linear ranking',
    description: 'Turn ranks into weights that climb in equal steps from 2 − s (worst) to s (best). Needs a Rank step before it.',
    parameters: [
      {
        key: 'pressure',
        label: 's',
        description: 'Selection pressure: 1 gives everyone the same weight, 2 gives the worst individual weight 0.',
        default: 1.5,
        min: 1,
        max: 2,
      },
    ],
    needsRanks: true,
    output: () => 'values',
    // Baker's linear ranking: weight = 2 - s + 2(s - 1)(rank - 1)/(N - 1). Weights add up to N.
    apply: (ranks, { pressure }) =>
      ranks.map((rank) => (ranks.length === 1 ? 1 : 2 - pressure! + (2 * (pressure! - 1) * (rank - 1)) / (ranks.length - 1))),
  },
  power: {
    label: 'Power',
    description: 'Raise each value to an exponent. Above 1 sharpens the preference for the best; below 1 softens it.',
    parameters: [
      {
        key: 'exponent',
        label: 'exponent',
        description: '0 makes every weight 1, 1 changes nothing, 2 squares the values.',
        default: 2,
        min: 0,
      },
    ],
    needsNonNegative: true,
    output: () => 'values',
    apply: (values, { exponent }) => values.map((v) => v ** exponent!),
  },
};

/** 1 = lowest value. Values that tie share the average of the ranks they occupy. */
function averageRanks(values: readonly number[]): number[] {
  return values.map((v) => {
    const below = values.filter((other) => other < v).length;
    const equal = values.filter((other) => other === v).length;
    return below + (equal + 1) / 2;
  });
}

function isInRange(spec: ParameterSpec, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (spec.min !== undefined && (spec.minExclusive ? value <= spec.min : value < spec.min)) return false;
  return spec.max === undefined || value <= spec.max;
}

function describeRange(spec: ParameterSpec): string {
  if (spec.min !== undefined && spec.max !== undefined) return `between ${spec.min} and ${spec.max}`;
  if (spec.min !== undefined) return spec.minExclusive ? `greater than ${spec.min}` : `${spec.min} or more`;
  return `${spec.max} or less`;
}

const refuse = (problem: string, stepIndex?: number): WeightChainResult =>
  stepIndex === undefined ? { ok: false, problem } : { ok: false, problem, stepIndex };

/**
 * Turns raw fitness into selection weights by running the chain, or explains why it cannot.
 *
 * One exception to "never rewrite the user's chain": the untouched default, a bare Identity, is replaced by Shift when
 * the fitness makes Identity unusable (negative or all zero). The switch is recorded in the event and shown as a banner.
 */
export function transformWeights(fitness: readonly number[], chain: readonly StepSpec[]): WeightChainResult {
  const result = runChain(fitness, chain);
  if (result.ok || chain.length !== 1 || chain[0]!.step !== 'identity') return result;
  const reason = identityProblem(fitness);
  if (!reason) return result;
  const to: StepSpec[] = [{ step: 'shift' }];
  const switched = runChain(fitness, to);
  if (!switched.ok) return switched;
  return { ok: true, weights: switched.weights, event: { ...switched.event, autoSwitch: { from: [...chain], to, reason } } };
}

function identityProblem(fitness: readonly number[]): string | null {
  if (fitness.length === 0 || !fitness.every(Number.isFinite)) return null;
  const lowest = Math.min(...fitness);
  if (lowest < 0) {
    return `Fitness is negative (lowest: ${lowest}), so Identity cannot give valid roulette weights. Switched to Shift (fitness − lowest + ε).`;
  }
  if (fitness.every((f) => f === 0)) {
    return 'All fitness values are zero, so Identity would give no individual a chance. Switched to Shift (every individual gets weight ε).';
  }
  return null;
}

function runChain(fitness: readonly number[], chain: readonly StepSpec[]): WeightChainResult {
  if (chain.length === 0) return refuse('The weight chain has no steps. Add at least one (Identity keeps fitness as it is).');
  if (fitness.length === 0) return refuse('There are no fitness values to turn into weights.');
  const badFitness = fitness.findIndex((f) => !Number.isFinite(f));
  if (badFitness >= 0) return refuse(`Fitness in row ${badFitness + 1} is not a finite number, so no weights can be made.`);

  let values: readonly number[] = fitness;
  let kind: ValueKind = 'fitness';
  const columns: WeightChainColumn[] = [];

  for (const [index, spec] of chain.entries()) {
    const descriptor = weightSteps[spec.step];
    const name = `Step ${index + 1} (${descriptor.label})`;
    const { step: _name, ...given } = spec;
    const params: Record<string, number> = {};
    for (const parameter of descriptor.parameters) {
      const value = (given as Record<string, number | undefined>)[parameter.key] ?? parameter.default;
      if (!isInRange(parameter, value)) return refuse(`${name}: ${parameter.key} must be ${describeRange(parameter)}.`, index);
      params[parameter.key] = value;
    }
    if (descriptor.needsRanks && kind !== 'ranks') {
      return refuse(`${name} needs ranks as its input; put a Rank step before it.`, index);
    }
    if (descriptor.needsNonNegative) {
      const negative = values.findIndex((v) => v < 0);
      if (negative >= 0) {
        return refuse(`${name} needs non-negative values, but row ${negative + 1} has ${values[negative]}; put a Shift step before it.`, index);
      }
    }
    values = descriptor.apply(values, params);
    kind = descriptor.output(kind);
    const unusable = values.findIndex((v) => !Number.isFinite(v));
    if (unusable >= 0) return refuse(`${name} gave row ${unusable + 1} a weight that is not a finite number.`, index);
    columns.push({ step: spec.step, label: descriptor.label, params, values });
  }

  const last = chain.length - 1;
  const after = `after step ${chain.length} (${weightSteps[chain[last]!.step].label})`;
  const negative = values.findIndex((v) => v < 0);
  if (negative >= 0) {
    return refuse(`The weights must not be negative, but row ${negative + 1} has ${values[negative]} ${after}; put a Shift step first.`, last);
  }
  if (values.reduce((sum, v) => sum + v, 0) <= 0) {
    return refuse(`All weights are zero ${after}, so no individual could be selected.`, last);
  }

  const weights = [...values];
  return { ok: true, weights, event: { stage: 'selection', kind: 'weight-chain', raw: [...fitness], columns, weights } };
}

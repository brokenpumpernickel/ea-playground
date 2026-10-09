import { describe, expect, test } from 'vitest';
import { goldberg } from './goldberg';
import { initialize, type Individual } from './initialize';
import { createRng } from './rng';
import { rouletteSelect } from './selection';
import { transformWeights, weightSteps, type StepSpec, type WeightChainEvent } from './weights';

/** Runs a chain that is expected to succeed and returns what it produced. */
const run = (fitness: number[], chain: StepSpec[]) => {
  const result = transformWeights(fitness, chain);
  if (!result.ok) throw new Error(`chain unexpectedly failed: ${result.problem}`);
  return result;
};
const weightsOf = (fitness: number[], chain: StepSpec[]) => run(fitness, chain).weights;

describe('Identity', () => {
  test('keeps fitness as the weights and records the column', () => {
    const { weights, event } = run([169, 576, 64, 361], [{ step: 'identity' }]);

    expect(weights).toEqual([169, 576, 64, 361]);
    expect(event).toEqual<WeightChainEvent>({
      stage: 'selection',
      kind: 'weight-chain',
      raw: [169, 576, 64, 361],
      columns: [{ step: 'identity', label: 'Identity', params: {}, values: [169, 576, 64, 361] }],
      weights: [169, 576, 64, 361],
    });
  });
});

describe('Shift', () => {
  test('moves the lowest value to epsilon (default 1)', () => {
    expect(weightsOf([3, -2, 5], [{ step: 'shift' }])).toEqual([6, 1, 8]);
  });

  test('uses the epsilon it is given, and records the resolved parameter', () => {
    const { weights, event } = run([3, -2, 5], [{ step: 'shift', epsilon: 0.5 }]);
    expect(weights).toEqual([5.5, 0.5, 7.5]);
    expect(event.columns[0]).toMatchObject({ step: 'shift', label: 'Shift', params: { epsilon: 0.5 } });
  });

  test('records the default epsilon when none was given', () => {
    expect(run([1, 2], [{ step: 'shift' }]).event.columns[0]?.params).toEqual({ epsilon: 1 });
  });
});

describe('Rank', () => {
  test('gives the worst value rank 1 and the best rank N, in the original order', () => {
    expect(weightsOf([169, 576, 64, 361], [{ step: 'rank' }])).toEqual([2, 4, 1, 3]);
  });

  test('values that tie share the average of the ranks they occupy', () => {
    // sorted: 5 (rank 1), 10 (rank 2), 20 and 20 (ranks 3 and 4, so 3.5 each)
    expect(weightsOf([10, 20, 20, 5], [{ step: 'rank' }])).toEqual([2, 3.5, 3.5, 1]);
  });

  test('all-equal values share the middle rank, and a single value has rank 1', () => {
    expect(weightsOf([7, 7, 7], [{ step: 'rank' }])).toEqual([2, 2, 2]);
    expect(weightsOf([5], [{ step: 'rank' }])).toEqual([1]);
  });
});

describe('Linear ranking', () => {
  const linear = (fitness: number[], pressure?: number) =>
    weightsOf(fitness, [{ step: 'rank' }, pressure === undefined ? { step: 'linear-ranking' } : { step: 'linear-ranking', pressure }]);

  test('with the default pressure 1.5, weights climb in equal steps from 0.5 (worst) to 1.5 (best)', () => {
    // ranks 2, 4, 1, 3 of N = 4: weight = 2 - s + 2(s - 1)(rank - 1)/(N - 1) = 0.5 + (rank - 1)/3
    expect(linear([169, 576, 64, 361])).toEqual([
      expect.closeTo(0.8333333, 6),
      expect.closeTo(1.5, 10),
      expect.closeTo(0.5, 10),
      expect.closeTo(1.1666667, 6),
    ]);
  });

  test('pressure 1 gives everybody the same weight, so selection is uniform', () => {
    expect(linear([169, 576, 64, 361], 1)).toEqual([1, 1, 1, 1]);
  });

  test('pressure 2 gives the worst individual weight 0 and the best weight 2', () => {
    expect(linear([169, 576, 64, 361], 2)).toEqual([
      expect.closeTo(0.6666667, 6),
      expect.closeTo(2, 10),
      0,
      expect.closeTo(1.3333333, 6),
    ]);
  });

  test('tied individuals get the same weight, from their shared average rank', () => {
    const [a, b, c, d] = linear([10, 20, 20, 5], 2);
    expect(b).toBe(c);
    expect(a).toBeCloseTo(0.6666667, 6);
    expect(b).toBeCloseTo(1.6666667, 6);
    expect(d).toBe(0);
  });

  test('the weights always add up to the population size', () => {
    for (const s of [1, 1.25, 1.5, 2]) {
      expect(linear([3, 9, 1, 7, 5, 5], s).reduce((a, b) => a + b, 0)).toBeCloseTo(6, 10);
    }
  });

  test('a single individual gets weight 1', () => {
    expect(linear([42])).toEqual([1]);
  });

  test('records the default pressure', () => {
    const column = run([1, 2, 3], [{ step: 'rank' }, { step: 'linear-ranking' }]).event.columns[1];
    expect(column).toMatchObject({ step: 'linear-ranking', label: 'Linear ranking', params: { pressure: 1.5 } });
  });
});

describe('Power', () => {
  test('raises each value to the exponent (default 2, which sharpens the preference for the best)', () => {
    expect(weightsOf([1, 2, 3], [{ step: 'power' }])).toEqual([1, 4, 9]);
  });

  test('exponent 1 changes nothing, exponent 0 makes every weight 1, and 0.5 takes square roots', () => {
    expect(weightsOf([1, 2, 3], [{ step: 'power', exponent: 1 }])).toEqual([1, 2, 3]);
    expect(weightsOf([0, 2, 3], [{ step: 'power', exponent: 0 }])).toEqual([1, 1, 1]);
    expect(weightsOf([4, 9], [{ step: 'power', exponent: 0.5 }])).toEqual([2, 3]);
  });

  test('records the resolved exponent', () => {
    expect(run([1, 2], [{ step: 'power' }]).event.columns[0]).toMatchObject({ step: 'power', label: 'Power', params: { exponent: 2 } });
  });
});

describe('chains of several steps', () => {
  test('steps run in order, each column recording its own values', () => {
    const { weights, event } = run([-2, 0, 3], [{ step: 'shift' }, { step: 'power' }]);

    expect(event.raw).toEqual([-2, 0, 3]);
    expect(event.columns.map((c) => c.values)).toEqual([[1, 3, 6], [1, 9, 36]]);
    expect(weights).toEqual([1, 9, 36]);
    expect(event.weights).toEqual(weights);
  });

  test('order matters: Power then Shift is not Shift then Power', () => {
    expect(weightsOf([2, 3], [{ step: 'power' }, { step: 'shift' }])).toEqual([1, 6]); // [4, 9] shifted
    expect(weightsOf([2, 3], [{ step: 'shift' }, { step: 'power' }])).toEqual([1, 4]); // [1, 2] squared
  });

  test('Rank then Linear ranking, with Identity steps in between, is accepted', () => {
    const { weights } = run([169, 576, 64, 361], [{ step: 'rank' }, { step: 'identity' }, { step: 'linear-ranking', pressure: 2 }]);
    expect(weights[2]).toBe(0);
  });
});

describe('chain validation', () => {
  const problemOf = (fitness: number[], chain: StepSpec[]) => {
    const result = transformWeights(fitness, chain);
    if (result.ok) throw new Error('expected the chain to be rejected');
    return result;
  };

  test('an empty chain is refused', () => {
    expect(problemOf([1, 2], []).problem).toBe('The weight chain has no steps. Add at least one (Identity keeps fitness as it is).');
  });

  test('having no fitness values is refused', () => {
    expect(problemOf([], [{ step: 'identity' }]).problem).toBe('There are no fitness values to turn into weights.');
  });

  test('a fitness value that is not a finite number is refused, naming its row', () => {
    expect(problemOf([1, Number.NaN, 3], [{ step: 'identity' }]).problem).toBe('Fitness in row 2 is not a finite number, so no weights can be made.');
  });

  test.each([
    [[{ step: 'shift', epsilon: 0 }], 'Step 1 (Shift): epsilon must be greater than 0.'],
    [[{ step: 'shift', epsilon: Number.NaN }], 'Step 1 (Shift): epsilon must be greater than 0.'],
    [[{ step: 'rank' }, { step: 'linear-ranking', pressure: 0.9 }], 'Step 2 (Linear ranking): pressure must be between 1 and 2.'],
    [[{ step: 'rank' }, { step: 'linear-ranking', pressure: 2.1 }], 'Step 2 (Linear ranking): pressure must be between 1 and 2.'],
    [[{ step: 'power', exponent: -1 }], 'Step 1 (Power): exponent must be 0 or more.'],
  ] as [StepSpec[], string][])('parameters out of range are refused: %j', (chain, problem) => {
    expect(problemOf([1, 2, 3], chain).problem).toBe(problem);
  });

  test('Linear ranking needs ranks as its input, so it is refused without a Rank step before it', () => {
    const message = 'Step 1 (Linear ranking) needs ranks as its input; put a Rank step before it.';
    expect(problemOf([1, 2, 3], [{ step: 'linear-ranking' }])).toEqual({ ok: false, problem: message, stepIndex: 0 });
    // a step that changes the values breaks the ranks
    expect(problemOf([1, 2, 3], [{ step: 'rank' }, { step: 'shift' }, { step: 'linear-ranking' }]).problem).toBe(
      'Step 3 (Linear ranking) needs ranks as its input; put a Rank step before it.',
    );
  });

  test('Power refuses negative values rather than squaring them into a better score', () => {
    expect(problemOf([-2, 5], [{ step: 'power' }])).toEqual({
      ok: false,
      problem: 'Step 1 (Power) needs non-negative values, but row 1 has -2; put a Shift step before it.',
      stepIndex: 0,
    });
  });

  test('weights that end up negative are refused, naming the row and the step that left them so', () => {
    expect(problemOf([-2, 5], [{ step: 'identity' }, { step: 'identity' }])).toEqual({
      ok: false,
      problem: 'The weights must not be negative, but row 1 has -2 after step 2 (Identity); put a Shift step first.',
      stepIndex: 1,
    });
  });

  test('weights that are all zero are refused, since nobody could be selected', () => {
    expect(problemOf([0, 0, 0], [{ step: 'identity' }, { step: 'identity' }])).toEqual({
      ok: false,
      problem: 'All weights are zero after step 2 (Identity), so no individual could be selected.',
      stepIndex: 1,
    });
  });
});

describe('automatic switch from Identity to Shift', () => {
  test('negative fitness under the default chain switches to Shift, and records that and why', () => {
    const { weights, event } = run([5, -12, 3], [{ step: 'identity' }]);

    expect(weights).toEqual([18, 1, 16]); // fitness - (-12) + 1
    expect(event.columns.map((c) => c.step)).toEqual(['shift']);
    expect(event.autoSwitch).toEqual({
      from: [{ step: 'identity' }],
      to: [{ step: 'shift' }],
      reason: 'Fitness is negative (lowest: -12), so Identity cannot give valid roulette weights. Switched to Shift (fitness − lowest + ε).',
    });
  });

  test('all-zero fitness also switches, so everyone gets the same small chance instead of none', () => {
    const { weights, event } = run([0, 0, 0], [{ step: 'identity' }]);

    expect(weights).toEqual([1, 1, 1]);
    expect(event.autoSwitch?.reason).toBe(
      'All fitness values are zero, so Identity would give no individual a chance. Switched to Shift (every individual gets weight ε).',
    );
  });

  test('usable fitness under Identity is left alone, with no switch recorded', () => {
    const { event } = run([169, 576, 64, 361], [{ step: 'identity' }]);
    expect(event.autoSwitch).toBeUndefined();
    expect('autoSwitch' in event).toBe(false);
  });

  test('chains the user built are never rewritten: they are refused with a reason instead', () => {
    for (const chain of [
      [{ step: 'identity' }, { step: 'identity' }],
      [{ step: 'power' }],
      [{ step: 'identity' }, { step: 'power' }],
    ] as StepSpec[][]) {
      const result = transformWeights([5, -12, 3], chain);
      expect(result.ok).toBe(false);
    }
  });

  test('a chain that already handles negative fitness is not touched', () => {
    const { event } = run([5, -12, 3], [{ step: 'rank' }]);
    expect(event.autoSwitch).toBeUndefined();
  });
});

describe('step registry', () => {
  test('lists the five steps, each described for the chain editor', () => {
    expect(Object.keys(weightSteps).sort()).toEqual(['identity', 'linear-ranking', 'power', 'rank', 'shift']);
    for (const descriptor of Object.values(weightSteps)) {
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.description.length).toBeGreaterThan(0);
      for (const parameter of descriptor.parameters) {
        expect(parameter.label.length).toBeGreaterThan(0);
        expect(parameter.description.length).toBeGreaterThan(0);
      }
    }
  });

  test('the documented defaults are 1 for epsilon, 1.5 for selection pressure and 2 for the exponent', () => {
    const defaults = (step: keyof typeof weightSteps) => weightSteps[step].parameters.map((p) => [p.key, p.default]);
    expect(defaults('shift')).toEqual([['epsilon', 1]]);
    expect(defaults('linear-ranking')).toEqual([['pressure', 1.5]]);
    expect(defaults('power')).toEqual([['exponent', 2]]);
  });

  test('every step accepts its own defaults in a chain that makes sense', () => {
    for (const chain of [
      [{ step: 'shift' }],
      [{ step: 'rank' }, { step: 'linear-ranking' }],
      [{ step: 'power' }],
    ] as StepSpec[][]) {
      expect(transformWeights([1, 2, 3], chain).ok).toBe(true);
    }
  });
});

describe('overflow', () => {
  test('a step that overflows to infinity is refused, naming the step and row', () => {
    expect(transformWeights([1, 1e200], [{ step: 'power' }])).toEqual({
      ok: false,
      problem: 'Step 1 (Power) gave row 2 a weight that is not a finite number.',
      stepIndex: 0,
    });
  });
});

describe('agreement with roulette selection', () => {
  const population = (chromosomes: string[]): Individual[] =>
    initialize(goldberg, { kind: 'explicit', chromosomes }, createRng(1)).population;

  test('the weights roulette uses are exactly the chain’s weights, and its probabilities follow from them', () => {
    const individuals = population(['01101', '11000', '01000', '10011']);
    const result = transformWeights(individuals.map((i) => i.fitness), [{ step: 'rank' }, { step: 'linear-ranking', pressure: 2 }]);
    if (!result.ok) throw new Error(result.problem);

    const { events } = rouletteSelect(individuals, result.weights, 1, createRng(3));
    const table = events.find((e) => e.kind === 'probabilities');
    if (table?.kind !== 'probabilities') throw new Error('no probabilities event');

    expect(table.entries.map((e) => e.weight)).toEqual(result.event.weights);
    const total = result.weights.reduce((a, b) => a + b, 0);
    table.entries.forEach((entry, k) => expect(entry.probability).toBeCloseTo(result.weights[k]! / total, 12));
  });

  test('negative fitness no longer blocks roulette: the auto-switch hands it valid weights', () => {
    const individuals = population(['01101', '11000', '01000']);
    const fitness = [-30, 12, 5]; // pretend a penalty pushed some fitness below zero
    const result = transformWeights(fitness, [{ step: 'identity' }]);
    if (!result.ok) throw new Error(result.problem);

    expect(result.event.autoSwitch).toBeDefined();
    expect(() => rouletteSelect(individuals, result.weights, 3, createRng(9))).not.toThrow();
    expect(() => rouletteSelect(individuals, fitness, 3, createRng(9))).toThrow('negative');
  });
});

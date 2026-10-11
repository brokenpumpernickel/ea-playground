import { describe, expect, test } from 'vitest';
import { binaryAlphabet } from './chromosome';
import { builtInKnapsack, itemName } from './knapsack-instance';
import { knapsackDefaults, knapsackProblem, knapsackRhoLimits, validateKnapsack, validateKnapsackFields, type KnapsackOptions } from './knapsack';
import { handlings, type Handling } from './knapsack-handling';

const options = (handling: Handling, rho = 4, extra: Partial<KnapsackOptions> = {}): KnapsackOptions => ({ items: builtInKnapsack.items, capacity: builtInKnapsack.capacity, handling, rho, ...extra });
const genes = (letters: string) => Array.from({ length: 12 }, (_, i) => (letters.includes(itemName(i)) ? 1 : 0));
const shown = (p: ReturnType<typeof knapsackProblem>, letters: string) => {
  const scores = p.evaluate(genes(letters));
  return p.columns.map((c) => `${c.header}=${c.show(scores)}`);
};

describe('the problem', () => {
  test.each(handlings)('%s: 12 binary genes, the DP optimum is the known best fitness, no landscape', (handling) => {
    const p = knapsackProblem(options(handling));
    expect(p.chromosomeLength).toBe(12);
    expect(p.alphabet).toEqual(binaryAlphabet);
    expect(p.knownOptimumFitness).toBe(123);
    expect(p.landscape).toBeUndefined();
    expect(p.options).toEqual(options(handling));
  });

  test('evaluate gives the scores of handleBag, including feasibility and, for Lamarckian repair, the repaired chromosome', () => {
    const lamarck = knapsackProblem(options('repair-lamarckian')).evaluate(genes('ABCDEFGHIJKL'));
    expect(lamarck).toMatchObject({ decoded: 'BCDGHJK', objective: 112, fitness: 112, feasible: true, repaired: genes('BCDGHJK') });
    const penalty = knapsackProblem(options('penalty')).evaluate(genes('ABEFG'));
    expect(penalty).toEqual({ decoded: 'ABEFG', objective: 59, fitness: 55, feasible: false });
    const decoder = knapsackProblem(options('decoder')).evaluate(genes('ABCDEFGHIJKL'));
    expect(decoder).toEqual({ decoded: 'ABCDEGH', objective: 88, fitness: 88, feasible: true });
  });

  test('an outcome with everything the views explain is available for any chromosome', () => {
    const outcome = knapsackProblem(options('decoder')).outcomeOf(genes('ABCDEFGHIJKL'));
    expect(outcome.skipped.map((s) => itemName(s.item))).toEqual(['F', 'I', 'J', 'K', 'L']);
  });
});

describe('the columns', () => {
  test('the penalty method has Weight, Value, Penalty and Fitness; the other three have no Penalty column', () => {
    expect(knapsackProblem(options('penalty')).columns.map((c) => c.header)).toEqual(['Bag weight', 'Value', 'Penalty', 'Fitness']);
    for (const h of ['decoder', 'repair-lamarckian', 'repair-baldwinian'] as const) {
      expect(knapsackProblem(options(h)).columns.map((c) => c.header)).toEqual(['Bag weight', 'Value', 'Fitness']);
    }
  });

  test('a bag that fits shows weight of capacity with a ✓, an overweight one ✗ and by how much, and a penalty shows as a loss', () => {
    const p = knapsackProblem(options('penalty'));
    expect(shown(p, 'ABCEF')).toEqual(['Bag weight=48/48 ✓', 'Value=73', 'Penalty=0', 'Fitness=73']);
    expect(shown(p, 'ABEFG')).toEqual(['Bag weight=49/48 ✗ +1', 'Value=59', 'Penalty=−4', 'Fitness=55']);
    expect(shown(p, 'ABCDEFGHIJKL')).toEqual(['Bag weight=97/48 ✗ +49', 'Value=171', 'Penalty=−196', 'Fitness=−25']);
  });

  test('the decoder and repairs always show ✓ and the weight of the bag that was packed', () => {
    expect(shown(knapsackProblem(options('decoder')), 'ABCDEFGHIJKL')).toEqual(['Bag weight=46/48 ✓', 'Value=88', 'Fitness=88']);
    expect(shown(knapsackProblem(options('repair-baldwinian')), 'ABCDEFGHIJKL')).toEqual(['Bag weight=40/48 ✓', 'Value=112', 'Fitness=112']);
  });

  test('the weight column says what it is measured against, and the evaluation view uses the same columns', () => {
    const p = knapsackProblem(options('decoder'));
    expect(p.columns[0]!.note).toBe('of 48');
    expect(p.evaluationColumns ?? p.columns).toBe(p.columns);
  });
});

describe('the sentences', () => {
  test('a score reads as what is packed, its weight against the capacity, its value and, for a penalty, how it ends up as fitness', () => {
    const decoder = knapsackProblem(options('decoder'));
    expect(decoder.scoreText!(decoder.evaluate(genes('BCD')))).toBe('packs B, C, D: weight 18 of 48, value 58');
    expect(decoder.scoreText!(decoder.evaluate(genes('')))).toBe('packs nothing: weight 0 of 48, value 0');
    const penalty = knapsackProblem(options('penalty'));
    expect(penalty.scoreText!(penalty.evaluate(genes('ABEFG')))).toBe('packs A, B, E, F, G: weight 49 of 48, value 59, over by 1 → penalty 4');
    expect(penalty.scoreText!(penalty.evaluate(genes('ABCEF')))).toBe('packs A, B, C, E, F: weight 48 of 48, value 73');
  });

  test('every method explains what the evaluation stage does', () => {
    for (const h of handlings) expect(knapsackProblem(options(h)).evaluationExplanation!.length).toBeGreaterThan(80);
    expect(knapsackProblem(options('decoder')).evaluationExplanation).toContain('First-fit decoder');
    expect(knapsackProblem(options('penalty', 4)).evaluationExplanation).toContain('ρ = 4');
    expect(knapsackProblem(options('repair-lamarckian')).evaluationExplanation).toContain('replace the chromosome');
    expect(knapsackProblem(options('repair-baldwinian')).evaluationExplanation).toContain('keeps its genes');
  });
});

describe('validation says what is wrong in words, under the field it concerns', () => {
  test('good options have none, at the limits too', () => {
    expect(validateKnapsack(options('decoder'))).toEqual([]);
    expect(validateKnapsack(options('penalty', 0))).toEqual([]);
    expect(validateKnapsack(options('penalty', knapsackRhoLimits.max))).toEqual([]);
  });

  test('item and capacity problems come from the instance rules, and ρ and the method have their own', () => {
    const bad = { items: [{ weight: 0, value: 5 }, { weight: 4, value: 5 }], capacity: 0, handling: 'magic' as Handling, rho: -1 };
    const fields = validateKnapsackFields(bad);
    expect(fields.items).toEqual(['Item A: the weight must be a whole number from 1 to 99 (it is 0).']);
    expect(fields.capacity).toEqual(['The capacity must be a whole number of at least 1 (it is 0).']);
    expect(fields.handling).toEqual(['The constraint handling must be one of decoder, penalty, repair-lamarckian, repair-baldwinian.']);
    expect(fields.rho).toEqual([`The penalty ρ must be a number from 0 to ${knapsackRhoLimits.max} (it is -1).`]);
    expect(validateKnapsack(bad)).toHaveLength(4);
  });

  test('building a problem from invalid options throws the first message', () => {
    expect(() => knapsackProblem(options('decoder', 4, { capacity: 500 }))).toThrow('The capacity can be at most the total weight, 97');
  });
});

describe('the defaults', () => {
  test('are valid, use the built-in instance and the first-fit decoder, and aim at the known optimum', () => {
    expect(validateKnapsack(knapsackDefaults.options)).toEqual([]);
    expect(knapsackDefaults.options.handling).toBe('decoder');
    expect(knapsackDefaults.options.items).toEqual(builtInKnapsack.items);
    expect(knapsackDefaults.params.stop.targetFitness).toBe(knapsackProblem(knapsackDefaults.options).knownOptimumFitness);
  });
});

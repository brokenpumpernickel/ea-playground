import { describe, expect, test } from 'vitest';
import { entryOf } from './problems';

describe('the knapsack entry', () => {
  const entry = entryOf('knapsack')!;

  test('its default options are the built-in instance with the first-fit decoder, and a copy each time', () => {
    const a = entry.defaultOptions() as unknown as { items: { weight: number }[]; handling: string; capacity: number };
    expect([a.items.length, a.capacity, a.handling]).toEqual([12, 48, 'decoder']);
    a.items[0]!.weight = 99;
    expect((entry.defaultOptions() as unknown as { items: { weight: number }[] }).items[0]!.weight).toBe(9);
  });

  test('says what it is in the brand area: items, capacity and the optimum', () => {
    expect(entry.subtitle(entry.defaultOptions())).toBe('12 items · capacity 48 · optimum 123');
    expect(entry.subtitle(undefined)).toBe('Pack a bag');
  });

  test('options are validated in words, whatever they are', () => {
    const good = entry.defaultOptions() as unknown as Record<string, unknown>;
    expect(entry.validateOptions(good)).toEqual([]);
    expect(entry.validateOptions('x')).toEqual(['"options" must be an object with "items", "capacity", "handling" and "rho".']);
    expect(entry.validateOptions({})).toEqual(['"options" is missing "items".', '"options" is missing "capacity".', '"options" is missing "handling".', '"options" is missing "rho".']);
    expect(entry.validateOptions({ ...good, extra: 1 })).toEqual(['"options" has an unknown key "extra".']);
    expect(entry.validateOptions({ ...good, items: 'AB' })).toEqual(['"options.items" must be a list of items.']);
    expect(entry.validateOptions({ ...good, items: [{ weight: 1 }, 5, { weight: 'a', value: 2, size: 1 }] })).toEqual([
      '"options.items[0]" is missing "value".',
      '"options.items[1]" must be an object with a "weight" and a "value".',
      '"options.items[2]" has an unknown key "size".',
      '"options.items[2].weight" must be a number.',
    ]);
    expect(entry.validateOptions({ ...good, capacity: '48', handling: 3, rho: 'x' })).toEqual(['"options.capacity" must be a number.', '"options.handling" must be text.', '"options.rho" must be a number.']);
    expect(entry.validateOptions({ ...good, capacity: 500 })[0]).toContain('The capacity can be at most the total weight, 97');
    expect(entry.validateOptions({ ...good, handling: 'greedy' })).toEqual(['The constraint handling must be one of decoder, penalty, repair-lamarckian, repair-baldwinian.']);
    expect(entry.validateOptions({ ...good, rho: -2 })).toEqual(['The penalty ρ must be a number from 0 to 1000 (it is -2).']);
  });

  test('the option messages are grouped by field for the drawer', () => {
    const fields = entry.validateOptionFields({ ...(entry.defaultOptions() as object), capacity: 0, rho: -1 } as never);
    expect(Object.keys(fields).sort()).toEqual(['capacity', 'handling', 'items', 'rho']);
    expect(fields.capacity).toHaveLength(1);
    expect(fields.rho).toHaveLength(1);
  });

  test('the problem it builds is the knapsack for those options', () => {
    const problem = entry.create(entry.defaultOptions());
    expect(problem.chromosomeLength).toBe(12);
    expect(problem.knownOptimumFitness).toBe(123);
  });
});

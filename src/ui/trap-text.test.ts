import { describe, expect, test } from 'vitest';
import { trapDefinition, trapExamples } from './trap-text';

describe('the worked examples of the trap for a block size', () => {
  test('k = 4 lists every kind of block: all ones, then 0 to 3 ones', () => {
    expect(trapExamples(4)).toBe('1111 → 4, 0000 → 3, 1000 → 2, 1100 → 1, 1110 → 0');
  });

  test('k = 2 and k = 3 are short', () => {
    expect(trapExamples(2)).toBe('11 → 2, 00 → 1, 10 → 0');
    expect(trapExamples(3)).toBe('111 → 3, 000 → 2, 100 → 1, 110 → 0');
  });

  test('a large block size shows the first three and the last, with … between', () => {
    expect(trapExamples(8)).toBe('11111111 → 8, 00000000 → 7, 10000000 → 6, 11000000 → 5, …, 11111110 → 0');
    expect(trapExamples(5)).toBe('11111 → 5, 00000 → 4, 10000 → 3, 11000 → 2, 11100 → 1, 11110 → 0');
  });
});

describe('the definition shown in the drawer', () => {
  test('states the rule, its source, the examples and the two scores for the sizes given', () => {
    const text = trapDefinition(4, 5);
    expect(text).toContain('k − 1 − u');
    expect(text).toContain('Deb and Goldberg');
    expect(text).toContain(trapExamples(4));
    expect(text).toContain('Every block pulls toward all zeros although all ones is best');
    expect(text).toContain('The best fitness is 20; all zeros scores 15.');
  });

  test('says only the rule when the sizes are not valid', () => {
    const text = trapDefinition(undefined, undefined);
    expect(text).toContain('k − 1 − u');
    expect(text).not.toContain('The best fitness');
  });
});

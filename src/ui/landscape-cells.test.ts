import { describe, expect, test } from 'vitest';
import { landscapeProblem, type LandscapeOptions } from '../engine';
import { landscapeInfoOf } from './landscape-context';
import { bitsSentence, groupWidth, realPair, realPairText, realSentence, variableGeometry, variableLabels, variableSentence, visibleColumns } from './landscape-cells';

const info = (o: Partial<LandscapeOptions> = {}) => landscapeInfoOf(landscapeProblem({ function: 'single-peak', representation: 'plain', bitsPerVariable: 10, ...o }));

describe('what a view knows about the running landscape', () => {
  test('the representation, the bits per variable, the function and where a chromosome lands', () => {
    const i = info({ function: 'himmelblau', representation: 'gray', bitsPerVariable: 6 });
    expect(i).toMatchObject({ representation: 'gray', bits: 6, name: 'Himmelblau', minimised: true, bounds: { lo: -5, hi: 5 } });
    expect(i.pointOf([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toEqual({ x: 5, y: -5 });
  });

  test('a real-valued landscape has no bits per variable', () => {
    expect(info({ representation: 'real' })).toMatchObject({ representation: 'real', bits: 0, minimised: false });
  });
});

describe('the real pair', () => {
  test('is read from the shown text of the chromosome and printed as (x, y)', () => {
    expect(realPair('−2.698 −1.768')).toEqual({ x: '−2.698', y: '−1.768' });
    expect(realPair('0.000 4.5')).toEqual({ x: '0.000', y: '4.5' });
    expect(realPairText({ x: '−2.698', y: '1.000' })).toBe('(−2.698, 1.000)');
  });

  test('anything that is not two numbers is not a pair', () => {
    expect(realPair('0101')).toBeUndefined();
    expect(realPair('1 2 3')).toBeUndefined();
    expect(realPair('')).toBeUndefined();
    expect(realPair('a b')).toBeUndefined();
  });

  test('is said in words for a screen reader', () => {
    expect(realSentence({ x: '−2.698', y: '−1.768' })).toBe('x = −2.698, y = −1.768');
  });
});

describe('bits grouped by variable', () => {
  test('the cells are narrower for more than ten bits per variable, so that 12 + 12 still fit beside the other columns', () => {
    expect(variableGeometry(4).cell).toBe(17);
    expect(variableGeometry(10).cell).toBe(17);
    expect(variableGeometry(11).cell).toBe(14);
    expect(variableGeometry(12).cell).toBe(14);
    for (const n of [4, 10, 12]) {
      const g = variableGeometry(n);
      expect(2 * groupWidth(n) + g.groupGap).toBeLessThanOrEqual(400);
    }
  });

  test('a group is as wide as its cells and the gaps between them', () => {
    const g = variableGeometry(10);
    expect(groupWidth(10)).toBe(10 * g.cell + 9 * g.gap);
  });

  test('the variable row labels each group with its variable and size', () => {
    expect(variableLabels(info({ bitsPerVariable: 10 }))).toEqual(['x · 10 bits', 'y · 10 bits']);
    expect(variableLabels(info({ bitsPerVariable: 7 }))).toEqual(['x · 7 bits', 'y · 7 bits']);
  });

  test('and says how a variable is read, in the representation’s own words', () => {
    expect(variableSentence(info({ representation: 'plain', bitsPerVariable: 10, function: 'rastrigin' }))).toBe(
      'Variables: the first 10 bits are x and the next 10 are y; each is read as a whole number in plain binary and scaled onto −5.12 to 5.12.',
    );
    expect(variableSentence(info({ representation: 'gray', bitsPerVariable: 8 }))).toBe(
      'Variables: the first 8 bits are x and the next 8 are y; each is read as a whole number from Gray code and scaled onto −5 to 5.',
    );
  });

  test('a chromosome says its two groups and what they decode to', () => {
    const i = info({ bitsPerVariable: 4 });
    expect(bitsSentence('11110000', i)).toBe('x bits 1111, y bits 0000, decodes to x = 5.000, y = −5.000');
    const g = info({ representation: 'gray', bitsPerVariable: 4 });
    expect(bitsSentence('10001000', g)).toBe('x bits 1000, y bits 1000, decodes to x = 5.000, y = 5.000');
  });
});

describe('which columns the population table shows', () => {
  const columnsOf = (o: Partial<LandscapeOptions>) => landscapeProblem({ function: 'single-peak', representation: 'plain', bitsPerVariable: 10, ...o }).columns;
  const shown = (o: Partial<LandscapeOptions>, showSelection: boolean) => visibleColumns(columnsOf(o), landscapeInfoOf(landscapeProblem({ function: 'single-peak', representation: 'plain', bitsPerVariable: 10, ...o })), showSelection).map((c) => c.header);

  test('real-valued: every column the problem has, since the pair is the chromosome and the rest are narrow', () => {
    expect(shown({ representation: 'real' }, false)).toEqual(['Fitness']);
    expect(shown({ representation: 'real', function: 'himmelblau' }, true)).toEqual(['f(x, y)', 'Fitness']);
  });

  test('binary-coded: the decoded x and y stay beside the bits, and fitness', () => {
    expect(shown({ representation: 'plain', bitsPerVariable: 10 }, false)).toEqual(['x', 'y', 'Fitness']);
    expect(shown({ representation: 'gray', bitsPerVariable: 12 }, false)).toEqual(['x', 'y', 'Fitness']);
  });

  test('binary-coded and minimised: f(x, y) shows only while the bits are few enough to leave the room', () => {
    expect(shown({ representation: 'plain', bitsPerVariable: 6, function: 'rastrigin' }, false)).toEqual(['x', 'y', 'f(x, y)', 'Fitness']);
    expect(shown({ representation: 'plain', bitsPerVariable: 8, function: 'rastrigin' }, false)).toEqual(['x', 'y', 'Fitness']);
  });

  test('binary-coded with roulette weights beside them: the decoded numbers make room, fitness stays', () => {
    expect(shown({ representation: 'plain', bitsPerVariable: 10 }, true)).toEqual(['Fitness']);
    expect(shown({ representation: 'gray', bitsPerVariable: 6, function: 'himmelblau' }, true)).toEqual(['Fitness']);
  });
});

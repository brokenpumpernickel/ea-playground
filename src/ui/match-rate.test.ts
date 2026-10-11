import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { metricsOf, startRun, targetStringProblem } from '../engine';
import { createRng } from '../run/rng';
import MatchRateStrip from './MatchRateStrip.svelte';
import { describeMatchRates, matchRates } from './match-rate-model';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const problem = targetStringProblem({ alphabet: letters, target: 'HELLO' });
const ratesFor = (chromosomes: string[], target = 'HELLO') => {
  const state = startRun(problem, { kind: 'explicit', chromosomes }, createRng(1)).state;
  return matchRates(metricsOf(state, 27), target, problem.alphabet);
};
const html = (rates: ReturnType<typeof ratesFor>) => render(MatchRateStrip as never, { props: { rates } as never }).body;

describe('match rate per position', () => {
  test('is, for each position, the share of the population that has the target’s letter there', () => {
    const rates = ratesFor(['HELLO', 'JELLY', 'HELPS', 'ZZZZZ']);
    expect(rates.map((r) => [r.position, r.letter, r.share])).toEqual([
      [1, 'H', 0.5], // HELLO, HELPS
      [2, 'E', 0.75], // HELLO, JELLY, HELPS
      [3, 'L', 0.75],
      [4, 'L', 0.5], // HELLO, JELLY
      [5, 'O', 0.25], // HELLO
    ]);
  });

  test('equals counting the matches directly, for random populations', () => {
    const rng = createRng(5);
    for (let trial = 0; trial < 30; trial++) {
      const size = 1 + Math.floor(rng.next() * 20);
      const state = startRun(problem, { kind: 'random', size }, rng).state;
      const rates = matchRates(metricsOf(state, 27), 'HELLO', problem.alphabet);
      rates.forEach((r, k) => {
        const direct = state.population.filter((i) => i.decoded && (i.decoded as string)[k] === r.letter).length / size;
        expect(r.share).toBeCloseTo(direct, 12);
      });
    }
  });

  test('a space in the target is a letter like any other, and repeated letters are measured at their own positions', () => {
    const two = targetStringProblem({ alphabet: 'AB ', target: 'A B' });
    const state = startRun(two, { kind: 'explicit', chromosomes: ['A B', 'AAB', 'BBB'] }, createRng(1)).state;
    expect(matchRates(metricsOf(state, 3), 'A B', two.alphabet).map((r) => r.share)).toEqual([2 / 3, 1 / 3, 1]);
  });

  test('every position of a fully converged population is 100%, and of a hopeless one 0%', () => {
    expect(ratesFor(['HELLO', 'HELLO']).every((r) => r.share === 1)).toBe(true);
    expect(ratesFor(['ZZZZZ', 'YYYYY']).every((r) => r.share === 0)).toBe(true);
  });
});

describe('the strip', () => {
  test('draws a bar per position with its percentage and the target letter under it, a space as ␣', () => {
    const rates = ratesFor(['A B', 'AAB'].map((s) => s.padEnd(5, 'Z')), 'A B  ');
    const markup = html(rates);
    expect([...markup.matchAll(/data-position="(\d)"/g)].map((m) => m[1])).toEqual(['1', '2', '3', '4', '5']);
    expect([...markup.matchAll(/data-share="([^"]+)"/g)].map((m) => Number(m[1]))).toEqual(rates.map((r) => r.share));
    expect(markup).toContain('<span>␣</span>');
    expect(markup).toContain('<b>100%</b>');
  });

  test('says all of it to screen readers, as sentences', () => {
    const rates = ratesFor(['HELLO', 'JELLY']);
    expect(describeMatchRates(rates)).toBe("Share of individuals with the target's letter at each position: position 1, H, 50 percent; position 2, E, 100 percent; position 3, L, 100 percent; position 4, L, 100 percent; position 5, O, 50 percent.");
    expect(html(rates)).toContain('role="img"');
    expect(html(rates)).toContain('position 1, H, 50 percent');
  });
});

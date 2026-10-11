import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import Bits from './Bits.svelte';
import { targetContextKey } from './target-context';
import TargetRow from './TargetRow.svelte';

const withTarget = (target: string | undefined) => new Map<unknown, unknown>([[targetContextKey, () => target]]);
const bits = (chromosome: string, target: string | undefined, props: Record<string, unknown> = {}) =>
  render(Bits as never, { props: { chromosome, ...props } as never, context: withTarget(target) }).body;
const classes = (markup: string) => [...markup.matchAll(/<b class="([^"]*)"/g)].map((m) => m[1]!.split(' '));

describe('cells compared with a target string', () => {
  test('matching positions are filled with a heavy baseline, the others have a dashed outline', () => {
    const cells = classes(bits('HELPS', 'HELLO'));
    expect(cells.map((c) => c.includes('match'))).toEqual([true, true, true, false, false]);
    expect(cells.map((c) => c.includes('miss'))).toEqual([false, false, false, true, true]);
    expect(cells.map((c) => c.includes('one'))).toEqual([true, true, true, false, false]); // the fill
  });

  test('say how many positions match, in words and as data', () => {
    const markup = bits('HELPS', 'HELLO');
    expect(markup).toContain('data-matches="3"');
    expect(markup).toContain('Chromosome HELPS, 3 of 5 positions match the target');
    expect(bits('HELLO', 'HELLO')).toContain('5 of 5 positions match the target');
    expect(bits('ZZZZZ', 'HELLO')).toContain('0 of 5 positions match the target');
  });

  test('a space is compared like any other letter and drawn as ␣', () => {
    const markup = bits('HI YO', 'HELLO WORLD'.slice(0, 5));
    expect(classes(markup).map((c) => c.includes('match'))).toEqual([true, false, false, false, true]);
    expect(markup).toContain('>␣</b>');
    const spaceMatch = bits('A B', 'A B');
    expect(classes(spaceMatch).every((c) => c.includes('match'))).toBe(true);
  });

  test('inheritance hatching, cut lines and flip marks work together with the match marks', () => {
    const markup = bits('HELPS', 'HELLO', { sources: ['A', 'A', 'B', 'B', 'B'], cuts: [2], flipped: [4] });
    const cells = classes(markup);
    expect(cells[2]).toEqual(expect.arrayContaining(['match', 'hatch']));
    expect(cells[3]).toEqual(expect.arrayContaining(['miss', 'hatch', 'flip']));
    expect(cells[1]).toContain('cutafter');
  });

  test('without a target (Goldberg, or no context at all) nothing is compared', () => {
    for (const markup of [bits('01101', undefined), render(Bits as never, { props: { chromosome: 'HELLO' } as never }).body]) {
      expect(markup).not.toContain('match');
      expect(markup).not.toContain('miss');
      expect(markup).not.toContain('data-matches');
    }
    expect(classes(bits('01101', undefined)).map((c) => c.includes('one'))).toEqual([false, true, true, false, true]);
  });

  test('explicit marks still win over a target', () => {
    const cells = classes(bits('HELLO', 'HELLO', { marks: [false, false, true, false, false] }));
    expect(cells.map((c) => c.includes('one'))).toEqual([false, false, true, false, false]);
    expect(cells.some((c) => c.includes('match'))).toBe(false);
  });
});

describe('the target row', () => {
  test('prints the target once, a space as ␣, and names it for screen readers', () => {
    const markup = render(TargetRow as never, { props: {} as never, context: withTarget('HI YOU') }).body;
    expect(markup).toContain('aria-label="The target is HI YOU"');
    expect([...markup.matchAll(/<span>(.)<\/span>/g)].map((m) => m[1])).toEqual(['H', 'I', '␣', 'Y', 'O', 'U']);
  });

  test('draws nothing without a target', () => {
    expect(render(TargetRow as never, { props: {} as never, context: withTarget(undefined) }).body).not.toContain('target-row');
    expect(render(TargetRow as never, { props: {} as never }).body).not.toContain('target-row');
  });
});

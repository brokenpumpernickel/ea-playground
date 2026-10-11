import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { builtInKnapsack, knapsackDefaults, knapsackProblem, type Handling } from '../engine';
import Bits from './Bits.svelte';
import { bagContextKey, type BagInfo } from './bag-context';
import CapacityBar from './CapacityBar.svelte';
import StackedBag from './StackedBag.svelte';

const problemFor = (handling: Handling) => knapsackProblem({ ...knapsackDefaults.options, handling });
const bagFor = (handling: Handling): BagInfo => ({ items: builtInKnapsack.items, capacity: builtInKnapsack.capacity, outcomeOf: problemFor(handling).outcomeOf });
const genes = (text: string) => [...text].map(Number);
const html = (component: unknown, props: Record<string, unknown>, context?: Map<unknown, unknown>) => render(component as never, { props: props as never, ...(context ? { context } : {}) }).body;
const attr = (markup: string, name: string) => Number(new RegExp(`${name}="([^"]*)"`).exec(markup)![1]);

describe('the small capacity bar', () => {
  test('is filled in proportion to the weight up to the capacity, and the capacity tick is at two thirds of the bar', () => {
    const markup = html(CapacityBar, { value: 24, limit: 48 });
    expect(attr(markup, 'data-fill')).toBeCloseTo((24 / 72) * 100, 6);
    expect(attr(markup, 'data-over')).toBe(0);
    expect(markup).toContain('left:66.66');
  });

  test('a bag exactly at capacity is full and has nothing over', () => {
    const markup = html(CapacityBar, { value: 48, limit: 48 });
    expect([attr(markup, 'data-fill'), attr(markup, 'data-over')].map(Math.round)).toEqual([67, 0]);
  });

  test('a bag over the capacity fills the bar and hatches the excess beyond the tick, up to the end of the bar', () => {
    const markup = html(CapacityBar, { value: 58, limit: 48 });
    expect(attr(markup, 'data-fill')).toBeCloseTo((48 / 72) * 100, 6);
    expect(attr(markup, 'data-over')).toBeCloseTo((10 / 72) * 100, 6);
    expect(attr(html(CapacityBar, { value: 500, limit: 48 }), 'data-over')).toBeCloseTo((24 / 72) * 100, 6);
  });

  test('is hidden from screen readers, because the text beside it says the same', () => {
    expect(html(CapacityBar, { value: 10, limit: 48 })).toContain('aria-hidden="true"');
  });
});

describe('the stacked bag', () => {
  const bag = bagFor('penalty');
  const draw = (letters: string, extra: Record<string, unknown> = {}) => {
    const outcome = problemFor('penalty').outcomeOf(genes([...'ABCDEFGHIJKL'].map((l) => (letters.includes(l) ? '1' : '0')).join('')));
    return html(StackedBag, { bag, outcome, label: 'Offspring 3', ...extra });
  };
  const segments = (markup: string) => [...markup.matchAll(/<i class="seg( ov)?" data-item="(.)"[^>]*style="left:([\d.]+)%;width:([\d.]+)%/g)].map((m) => ({ over: Boolean(m[1]), item: m[2]!, left: Number(m[3]), width: Number(m[4]) }));

  test('has a segment per packed item, in order, each as wide as its weight, and the capacity marked', () => {
    const markup = draw('BCD');
    expect(segments(markup).map((s) => s.item)).toEqual(['B', 'C', 'D']);
    const scale = 72;
    expect(segments(markup).map((s) => Math.round((s.width / 100) * scale))).toEqual([12, 3, 3]);
    expect(segments(markup)[1]!.left).toBeCloseTo((12 / scale) * 100, 6);
    expect(markup).toContain('capacity 48');
    expect(markup).toContain('18 of 48'.replace('18', 'weight 18'));
  });

  test('an overweight bag has the part beyond the capacity hatched, split inside the item that crosses it, and says how much is over', () => {
    const markup = draw('ABEFG'); // 9 + 12 + 10 + 14 = 45 inside, G (4) crosses to 49
    const s = segments(markup);
    expect(s.filter((x) => x.over).map((x) => x.item)).toEqual(['G']);
    expect(s.find((x) => x.over)!.left).toBeCloseTo((48 / 72) * 100, 6);
    expect(s.find((x) => x.over)!.width).toBeCloseTo((1 / 72) * 100, 6);
    expect(markup).toContain('1 over (hatched)');
    expect(attr(markup, 'data-excess')).toBe(1);
  });

  test('says what it is in words: how many items, the weight against the capacity, and what repair started from', () => {
    expect(draw('')).toContain('nothing packed');
    expect(draw('B')).toContain('1 item');
    expect(draw('BCD', { was: 67 })).toContain('repaired from 67');
  });
});

describe('the mark for a gene repair rewrote', () => {
  const context = new Map<unknown, unknown>([[bagContextKey, () => bagFor('repair-lamarckian')]]);
  const bits = (props: Record<string, unknown>) => html(Bits, { chromosome: '011100110110', small: true, ...props }, context);

  test('is a dotted outline class and a description, on exactly the genes named', () => {
    const markup = bits({ dropped: [1, 5, 6] });
    expect([...markup.matchAll(/<b class="([^"]*)"/g)].flatMap((m, k) => (m[1]!.split(' ').includes('cut') ? [k + 1] : []))).toEqual([1, 5, 6]);
    expect(markup).toContain('data-dropped="1,5,6"');
    expect(markup).toContain('genes 1, 5 and 6 dropped by repair, rewritten to 0');
  });

  test('is absent when nothing was dropped', () => {
    const markup = bits({});
    expect(markup).not.toContain('class="bit sm knap cut');
    expect(markup).not.toContain('data-dropped');
  });
});

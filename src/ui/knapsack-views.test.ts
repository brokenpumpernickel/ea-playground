import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { knapsackProblem, builtInKnapsack, knapsackDefaults, type Handling } from '../engine';
import Bits from './Bits.svelte';
import { bagContextKey, type BagInfo } from './bag-context';
import ItemRow from './ItemRow.svelte';

const bagFor = (handling: Handling): BagInfo => {
  const problem = knapsackProblem({ ...knapsackDefaults.options, handling });
  return { items: builtInKnapsack.items, capacity: builtInKnapsack.capacity, outcomeOf: problem.outcomeOf };
};
const withBag = (bag: BagInfo | undefined) => new Map<unknown, unknown>([[bagContextKey, () => bag]]);
const bits = (chromosome: string, bag: BagInfo | undefined, props: Record<string, unknown> = {}) =>
  render(Bits as never, { props: { chromosome, small: true, ...props } as never, context: withBag(bag) }).body;
const cells = (markup: string) => [...markup.matchAll(/<b class="([^"]*)"[^>]*>(.*?)<\/b>/g)].map((m) => ({ classes: m[1]!.split(' '), text: m[2]! }));
const label = (markup: string) => /aria-label="([^"]*)"/.exec(markup)![1]!;
const all = '111111111111';

describe('the item row', () => {
  const markup = render(ItemRow as never, { props: {} as never, context: withBag(bagFor('decoder')) }).body;

  test('prints each item once: its letter, its weight and its value, in the order of the genes', () => {
    expect([...markup.matchAll(/<b>(.)<\/b><u>(\d+)<\/u><s>(\d+)<\/s>/g)].map((m) => [m[1], Number(m[2]), Number(m[3])])).toEqual(
      builtInKnapsack.items.map((item, i) => [String.fromCharCode(65 + i), item.weight, item.value]),
    );
  });

  test('says all of it to a screen reader in one sentence, and hides the cells from it', () => {
    expect(label(markup)).toBe(
      'Items: A weighs 9 and is worth 4; B weighs 12 and is worth 20; C weighs 3 and is worth 21; D weighs 3 and is worth 17; E weighs 10 and is worth 5; F weighs 14 and is worth 23; G weighs 4 and is worth 7; H weighs 5 and is worth 14; I weighs 11 and is worth 8; J weighs 7 and is worth 12; K weighs 6 and is worth 21; L weighs 13 and is worth 19',
    );
    expect(markup).toContain('data-testid="item-row"');
  });

  test('draws nothing without a knapsack', () => {
    expect(render(ItemRow as never, { props: {} as never, context: withBag(undefined) }).body).not.toContain('item-row');
    expect(render(ItemRow as never, { props: {} as never }).body).not.toContain('item-row');
  });
});

describe('cells of a chromosome in a knapsack screen', () => {
  test('are narrower, and a gene that is 1 and packed is filled as ever', () => {
    const c = cells(bits('110000000000', bagFor('decoder')));
    expect(c.every((x) => x.classes.includes('knap'))).toBe(true);
    expect(c.slice(0, 2).every((x) => x.classes.includes('one') && !x.classes.includes('skip') && x.text === '1')).toBe(true);
    expect(c.slice(2).every((x) => !x.classes.includes('one') && !x.classes.includes('skip') && x.text === '0')).toBe(true);
  });

  test('with the decoder, a gene that is 1 but did not fit is a ✕ in a dashed cell, not a filled 1', () => {
    // with everything on the decoder skips F, I, J, K and L (genes 6, 9, 10, 11 and 12)
    const c = cells(bits(all, bagFor('decoder')));
    const skipped = c.flatMap((x, k) => (x.classes.includes('skip') ? [k + 1] : []));
    expect(skipped).toEqual([6, 9, 10, 11, 12]);
    for (const k of skipped) {
      expect(c[k - 1]!.text).toBe('✕');
      expect(c[k - 1]!.classes).not.toContain('one');
    }
    expect(c.filter((x) => x.classes.includes('one'))).toHaveLength(7); // A B C D E G H
  });

  test('Baldwinian repair marks the genes of the dropped items the same way, and Lamarckian does not (it rewrites them instead)', () => {
    const baldwin = cells(bits(all, bagFor('repair-baldwinian'))).flatMap((x, k) => (x.classes.includes('skip') ? [k + 1] : []));
    expect(baldwin).toEqual([1, 5, 6, 9, 12]); // A E F I L, the items repair drops
    const lamarck = cells(bits(all, bagFor('repair-lamarckian'))).flatMap((x, k) => (x.classes.includes('skip') ? [k + 1] : []));
    expect(lamarck).toEqual([1, 5, 6, 9, 12]); // a chromosome that is not yet repaired would be dropped from the bag too
    const repaired = cells(bits('011100110110', bagFor('repair-lamarckian')));
    expect(repaired.some((x) => x.classes.includes('skip'))).toBe(false); // once repaired, every 1 is packed
  });

  test('with the penalty nothing is skipped: every gene that is 1 is in the bag, over capacity or not', () => {
    expect(cells(bits(all, bagFor('penalty'))).some((x) => x.classes.includes('skip'))).toBe(false);
  });

  test('the description names the bag, its weight against the capacity and what is not in it although the gene is 1', () => {
    expect(label(bits(all, bagFor('decoder')))).toBe(
      'Chromosome 111111111111, bag: A, B, C, D, E, G, H, weight 46 of 48, not in the bag although the gene is 1: F, I, J, K, L',
    );
    expect(label(bits('000000000000', bagFor('decoder')))).toBe('Chromosome 000000000000, nothing in the bag, weight 0 of 48');
    expect(label(bits('110000000000', bagFor('penalty')))).toBe('Chromosome 110000000000, bag: A, B, weight 21 of 48');
  });

  test('flip marks, cut lines and hatching still work with it', () => {
    const markup = bits('110000000000', bagFor('decoder'), { flipped: [2], sources: ['A', 'B', ...Array(10).fill('A')], cuts: [1] });
    const c = cells(markup);
    expect(c[1]!.classes).toEqual(expect.arrayContaining(['flip', 'hatch', 'knap']));
    expect(c[0]!.classes).toContain('cutafter');
  });

  test('without a knapsack, or for a chromosome of another length, nothing changes', () => {
    for (const markup of [bits('110000000000', undefined), bits('11000', bagFor('decoder'))]) {
      expect(markup).not.toContain('knap');
      expect(markup).not.toContain('skip');
      expect(label(markup)).not.toContain('bag');
    }
  });
});

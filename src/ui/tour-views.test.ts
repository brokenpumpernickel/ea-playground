import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { tspInstance, tspProblem, type TspOptions } from '../engine';
import Bits from './Bits.svelte';
import { thumbnail, tourInfoOf, tourLabel, type TourInfo } from './tour-cells';
import { tourContextKey } from './tour-context';

const opts = (instance: string, n = 10): TspOptions => ({ instance, n, seed: 1 });
const infoOf = (o: TspOptions) => tourInfoOf(tspProblem(o));
const withTour = (info: TourInfo | undefined) => new Map<unknown, unknown>([[tourContextKey, () => info]]);
const plain = (markup: string) => markup.replace(/<!--.*?-->/g, '');
const bits = (chromosome: string, info: TourInfo | undefined, props: Record<string, unknown> = {}) =>
  plain(render(Bits as never, { props: { chromosome, small: true, ...props } as never, context: withTour(info) }).body);
const label = (markup: string) => /aria-label="([^"]*)"/.exec(markup)![1]!;
const cells = (markup: string) => [...markup.matchAll(/<b class="([^"]*)"[^>]*>(.*?)<\/b>/g)].map((m) => ({ classes: m[1]!.split(' '), text: m[2]! }));

describe('a tour of up to 16 cities in a TSP screen', () => {
  const info = infoOf(opts('ulysses16'));
  const text = '5 11 9 10 6 7 14 12 13 16 1 3 2 8 4 15';

  test('is drawn as one cell per city, in order, the whole tour', () => {
    const markup = bits(text, info);
    expect(cells(markup).map((c) => c.text)).toEqual(text.split(' '));
    expect(cells(markup).every((c) => c.classes.includes('tour'))).toBe(true);
    expect(markup).toContain(`data-bits="${text}"`);
    expect(markup).not.toContain('class="thumb"');
  });

  test('is named by the whole route, its length and its gap', () => {
    expect(label(bits(text, info))).toBe(tourLabel(info, text.split(' ').map((c) => Number(c) - 1)));
    expect(label(bits(text, info))).toMatch(/^Tour of 16 cities, in the order visited: 5, 11, 9, .*, 4, 15, then back to 5\. Length [\d,]+, \d+\.\d% over the optimum 6,859\.$/);
  });

  test('keeps the marks of the operator views: hatched cities from parent B, a cut, a changed city, each said', () => {
    const markup = bits(text, info, { sources: text.split(' ').map((_, k) => (k >= 8 ? 'B' : 'A')), cuts: [4], flipped: [2] });
    const all = cells(markup);
    expect(all.filter((c) => c.classes.includes('hatch'))).toHaveLength(8);
    expect(all[3]!.classes).toContain('cutafter'); // the line is drawn after the fourth city
    expect(all[4]!.classes).not.toContain('cutafter');
    expect(all[1]!.classes).toContain('flip');
    expect(label(markup)).toMatch(/over the optimum 6,859\. Genes 9, 10, 11, 12, 13, 14, 15 and 16 from parent B, cut after gene 4, gene 2 changed by mutation\.$/);
  });

  test('a chromosome that is not a tour of this problem is drawn as before (no tour in the context, another length, not numbers)', () => {
    expect(cells(bits('01101', undefined)).map((c) => c.text)).toEqual(['0', '1', '1', '0', '1']);
    expect(cells(bits('5 11 9', info)).every((c) => !c.classes.includes('tour'))).toBe(true);
    expect(cells(bits('ab', info)).every((c) => !c.classes.includes('tour'))).toBe(true);
  });
});

describe('a tour of more than 16 cities', () => {
  const o = opts('berlin52');
  const info = infoOf(o);
  const tour = [...Array(52).keys()].map((k) => (k * 7) % 52);
  const text = tour.map((c) => c + 1).join(' ');

  test('is a thumbnail of the tour and its first seven and last three cities with the number between', () => {
    const markup = bits(text, info);
    expect(cells(markup)).toEqual([]);
    expect(markup).toContain('class="thumb"');
    expect(markup).toContain(`data-path="${thumbnail(info.places, tour).path}"`);
    expect(/data-part="head">([^<]*)</.exec(markup)![1]).toBe(tour.slice(0, 7).map((c) => c + 1).join(' '));
    expect(/data-part="hidden">([^<]*)</.exec(markup)![1]).toBe('… 42 more …');
    expect(/data-part="tail">([^<]*)</.exec(markup)![1]).toBe(tour.slice(-3).map((c) => c + 1).join(' '));
  });

  test('still has every city in its name, so a screen reader loses nothing the picture shortens', () => {
    const name = label(bits(text, info));
    expect(name).toBe(tourLabel(info, tour));
    expect(name.split(', ').length).toBeGreaterThanOrEqual(52);
    expect(name).toContain('Tour of 52 cities');
  });

  test('the picture and the text are hidden from a screen reader, which has the name', () => {
    const markup = bits(text, info);
    expect(markup).toMatch(/<svg class="thumb"[^>]*aria-hidden="true"/);
    expect(markup).toMatch(/<span class="seq" aria-hidden="true"/);
  });

  test('every optimal tour of an own instance is drawn too', () => {
    const own = opts('circle', 6);
    const ownInfo = infoOf(own);
    const optimal = [...tspInstance(own).optimalTour];
    expect(cells(bits(optimal.map((c) => c + 1).join(' '), ownInfo)).map((c) => c.text)).toEqual(optimal.map((c) => String(c + 1)));
  });
});

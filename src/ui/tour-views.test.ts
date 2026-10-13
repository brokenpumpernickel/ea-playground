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
    expect(label(markup)).toMatch(/over the optimum 6,859\. Positions 9, 10, 11, 12, 13, 14, 15 and 16 from parent B, cut after position 4, position 2 changed by mutation\.$/);
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

describe('a tour as a strip in an operator card', () => {
  const o = opts('ulysses16');
  const info = infoOf(o);
  const text = '5 11 9 10 6 7 14 12 13 16 1 3 2 8 4 15';
  const strip = (props: Record<string, unknown> = {}, chromosome = text, i: TourInfo = info) => bits(chromosome, i, { form: 'strip', ...props });

  test('draws every city of any tour in a cell whose size follows the number of cities', () => {
    expect(cells(strip()).map((c) => c.text)).toEqual(text.split(' '));
    expect(strip()).toMatch(/style="--tc:30px"/);
    const berlin = infoOf(opts('berlin52'));
    const long = [...Array(52).keys()].map((k) => k + 1).join(' ');
    expect(cells(strip({}, long, berlin)).map((c) => c.text)).toHaveLength(52);
    expect(strip({}, long, berlin)).toMatch(/style="--tc:16px"/);
    expect(strip({}, long, berlin)).not.toContain('class="thumb"');
    const small = infoOf(opts('circle', 22 > 15 ? 8 : 8));
    expect(strip({}, '1 2 3 4 5 6 7 8', small)).toMatch(/style="--tc:30px"/);
  });

  test('outlines the slice, dashed when asked, and says it in the name', () => {
    const markup = strip({ slice: { from: 4, to: 7 }, sliceDashed: true });
    const all = cells(markup);
    expect(all.filter((c) => c.classes.includes('slice')).map((c) => c.text)).toEqual(['10', '6', '7', '14']);
    expect(all.filter((c) => c.classes.includes('dashed'))).toHaveLength(4);
    expect(markup).toContain('data-slice="4-7"');
    expect(label(markup)).toContain('Slice: positions 4 to 7.');
    expect(cells(strip({ slice: { from: 4, to: 7 } })).some((c) => c.classes.includes('dashed'))).toBe(false);
  });

  test('marks the cities that followed the mapping and says which in the name', () => {
    const markup = strip({ followed: [2, 9] });
    expect(cells(markup).filter((c) => c.classes.includes('mapped')).map((c) => c.text)).toEqual(['11', '13']);
    expect(markup).toContain('data-followed="2,9"');
    expect(label(markup)).toContain('Positions 2 and 9 followed the mapping.');
  });

  test('names a city’s cycle by the line under it: 1, 2, 3, and 4 for the fourth and every later cycle', () => {
    const cycles = [1, 2, 3, 4, 5, 6, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6];
    const all = cells(strip({ cycles }));
    expect(all.map((c) => c.classes.find((k) => /^cyc\d$/.test(k)))).toEqual(cycles.map((c) => `cyc${Math.min(c, 4)}`));
    expect(strip({ cycles })).toContain(`data-cycles="${cycles.join(',')}"`);
    expect(cells(strip()).some((c) => c.classes.some((k) => /^cyc/.test(k)))).toBe(false);
  });

  test('marks a city mutation changed with the ✱ class and says so in the name', () => {
    const markup = strip({ flipped: [3, 9] });
    expect(cells(markup).filter((c) => c.classes.includes('flip')).map((c) => c.text)).toEqual(['9', '13']);
    expect(label(markup)).toContain('Positions 3 and 9 changed by mutation.');
  });
});

describe('a tour in the brief form of the crowded views', () => {
  const info = infoOf(opts('ulysses16'));
  const text = '5 11 9 10 6 7 14 12 13 16 1 3 2 8 4 15';

  test('is a small thumbnail, the first five and the last two cities and the number between, and keeps the whole route in its name', () => {
    const markup = bits(text, info, { form: 'brief' });
    expect(cells(markup)).toEqual([]);
    expect(markup).toContain('class="thumb small"');
    expect(markup).toContain('width="44"');
    expect(/data-part="head">([^<]*)</.exec(markup)![1]).toBe('5 11 9 10 6');
    expect(/data-part="hidden">([^<]*)</.exec(markup)![1]).toBe('… 9 more …');
    expect(/data-part="tail">([^<]*)</.exec(markup)![1]).toBe('8 4 15'.split(' ').slice(1).join(' '));
    expect(label(markup)).toContain('5, 11, 9, 10, 6, 7, 14, 12, 13, 16, 1, 3, 2, 8, 4, 15, then back to 5');
  });

  test('a tour of up to nine cities is written whole beside its thumbnail', () => {
    const small = infoOf(opts('circle', 8));
    const markup = bits('3 1 2 8 7 6 5 4', small, { form: 'brief' });
    expect(markup).toContain('class="thumb small"');
    expect(markup).not.toContain('data-part="hidden"');
    expect(markup).toMatch(/data-part="head">3 1 2 8 7 6 5 4</);
  });
});

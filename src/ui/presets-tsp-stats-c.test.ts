import { describe, expect, test } from 'vitest';
import { compare, median, pct, seeds, trace, tspPreset } from './presets-tsp-support';

// the statistics of the texts of the no-crossover, no-elitism and no-mutation presets, over seeds 1 to 30 on berlin52
describe('over seeds 1 to 30 on berlin52', () => {
  const ox = seeds().map((seed) => trace(tspPreset('t-tsp-berlin52'), 500, { seed }));

  test('the run with order crossover is ahead of the one without crossover after 200 generations in 25 runs and after 500 in 20', { timeout: 120_000 }, () => {
    const none = seeds().map((seed) => trace(tspPreset('no-crossover'), 500, { seed }));
    expect(compare(none, ox, 200).behind).toBe(25);
    expect(compare(none, ox, 500).behind).toBe(20);
    expect(compare(none, ox, 500).ahead).toBe(10);
  });

  test('without elites the run is behind at generations 200, 300 and 500 in all 30, with a median gap of 70.5 % after 500; with two elites the best of the generation never gets worse', { timeout: 120_000 }, () => {
    const none = seeds().map((seed) => trace(tspPreset('no-elitism'), 500, { seed }));
    for (const g of [200, 300, 500]) expect(compare(none, ox, g), `generation ${g}`).toEqual({ ahead: 0, behind: 30 });
    expect(pct(median(none.map((t) => t.gap(500))))).toBe(70.5);
    const worse = (t: (typeof ox)[number]) => t.best.reduce((n, b, g) => (g > 0 && b < t.best[g - 1]! ? n + 1 : n), 0);
    expect(ox.map(worse).reduce((a, b) => a + b, 0)).toBe(0);
    expect(none.every((t) => worse(t) > 0)).toBe(true);
  });

  test('without mutation the run is behind at generations 200, 300 and 500 in all 30, with a median gap of 168.6 % after 500 (15.0 % with mutation)', { timeout: 120_000 }, () => {
    const none = seeds().map((seed) => trace(tspPreset('no-mutation'), 500, { seed }));
    for (const g of [200, 300, 500]) expect(compare(none, ox, g), `generation ${g}`).toEqual({ ahead: 0, behind: 30 });
    expect(pct(median(none.map((t) => t.gap(500))))).toBe(168.6);
    expect(pct(median(ox.map((t) => t.gap(500))))).toBe(15);
  });
});

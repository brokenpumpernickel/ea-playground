import { describe, expect, test } from 'vitest';
import { tspInstance } from '../engine';
import { compare, median, optionsOf, pct, seeds, trace, tspPreset } from './presets-tsp-support';

// the statistics of the texts of “berlin52: against the nearest neighbour and the optimum” and of the partial-mapped crossover preset, over seeds 1 to 30
describe('over seeds 1 to 30 on berlin52, with the defaults', () => {
  const ox = seeds().map((seed) => trace(tspPreset('t-tsp-berlin52'), 500, { seed }));
  const nn = tspInstance(optionsOf(tspPreset('t-tsp-berlin52'))).nearestNeighbour.length;
  const under = (g: number) => ox.filter((t) => 0 - t.sofar[g]! < nn).length;

  test('the median gap after 500 generations is 15.0 % and none of the runs reaches the optimum', { timeout: 120_000 }, () => {
    expect(pct(median(ox.map((t) => t.gap(500))))).toBe(15);
    expect(ox.every((t) => t.firstOptimum === null)).toBe(true);
  });

  test('none is under the best nearest-neighbour tour after 200 or 300 generations, one of the 30 after 500, at 8,063', { timeout: 120_000 }, () => {
    expect([200, 300, 500].map(under)).toEqual([0, 0, 1]);
    expect(Math.min(...ox.map((t) => 0 - t.sofar[500]!))).toBe(8063);
    expect(pct((8063 - nn) / nn)).toBe(-1.4);
  });

  test('partial-mapped crossover ends ahead of order crossover in 17 runs and behind in 13 after 500 generations (15 and 15 after 200)', { timeout: 120_000 }, () => {
    const pmx = seeds().map((seed) => trace(tspPreset('pmx'), 500, { seed }));
    expect(compare(pmx, ox, 500)).toEqual({ ahead: 17, behind: 13 });
    expect(compare(pmx, ox, 200)).toEqual({ ahead: 15, behind: 15 });
  });
});

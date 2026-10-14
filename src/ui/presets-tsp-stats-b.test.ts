import { describe, expect, test } from 'vitest';
import { compare, seeds, trace, tspPreset } from './presets-tsp-support';

// the statistics of the texts of the cycle-crossover and the swap presets, over seeds 1 to 30 on berlin52
describe('over seeds 1 to 30 on berlin52', () => {
  const ox = seeds().map((seed) => trace(tspPreset('t-tsp-berlin52'), 500, { seed }));

  test('the cycle-crossover run is behind the order-crossover run at generation 200 in all 30 runs, and at 500 in 29', { timeout: 120_000 }, () => {
    const cx = seeds().map((seed) => trace(tspPreset('-cx'), 500, { seed }));
    expect(compare(cx, ox, 200)).toEqual({ ahead: 0, behind: 30 });
    expect(compare(cx, ox, 500)).toEqual({ ahead: 1, behind: 29 });
  });

  test('the swap run is behind the inversion run at generation 200 in 29 runs and at 300 and 500 in all 30', { timeout: 120_000 }, () => {
    const swap = seeds().map((seed) => trace(tspPreset('swap'), 500, { seed }));
    expect(compare(swap, ox, 200)).toEqual({ ahead: 1, behind: 29 });
    expect(compare(swap, ox, 300)).toEqual({ ahead: 0, behind: 30 });
    expect(compare(swap, ox, 500)).toEqual({ ahead: 0, behind: 30 });
  });
});

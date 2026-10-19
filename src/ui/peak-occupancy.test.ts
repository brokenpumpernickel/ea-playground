import { describe, expect, it } from 'vitest';
import { landscapeFunctionInfo, landscapeFunctions } from '../engine';

const landscapeInfo = (id: (typeof landscapeFunctions)[number]) => landscapeFunctionInfo[id];
import { occupancy, occupancySentence, peakRadius } from './peak-occupancy';

const twoPeaks = landscapeInfo('two-peaks').peaks!;
const himmelblau = landscapeInfo('himmelblau').peaks!;

describe('peak occupancy: how many individuals lie near each hill', () => {
  it('counts the individuals within 1.5 of each peak (the radius is a fixed, stated number)', () => {
    expect(peakRadius).toBe(1.5);
    // broad hill at (-2.5, -2.5): (-2.5,-2.5) is 0 away, (-1.5,-3.2) is 1.22 away, (-1,-2.5) is exactly 1.5 away (counted), (0,0) is 3.5 away
    // narrow hill at about (3, 3): (3, 3) is 0 away, (3.5, 4.2) is 1.3 away, (3, 4.6) is 1.6 away (not counted)
    const points = [{ x: -2.5, y: -2.5 }, { x: -1.5, y: -3.2 }, { x: -1, y: -2.5 }, { x: 0, y: 0 }, { x: 3, y: 3 }, { x: 3.5, y: 4.2 }, { x: 3, y: 4.6 }];
    const rows = occupancy(twoPeaks, points);
    expect(rows.map((r) => [r.name, r.count])).toEqual([['broad hill', 3], ['narrow hill', 2]]);
  });

  it('keeps the peaks\' own order and positions, and reports the rest as elsewhere', () => {
    const rows = occupancy(twoPeaks, [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(rows.map((r) => r.count)).toEqual([0, 0]);
    expect(rows[0]).toMatchObject({ name: 'broad hill', x: -2.5, y: -2.5 });
  });

  it('is a recount: every peak of every function with peaks, over random points', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 12 - 6;
    const points = Array.from({ length: 300 }, () => ({ x: rnd(), y: rnd() }));
    for (const id of landscapeFunctions) {
      const peaks = landscapeInfo(id).peaks;
      if (!peaks) continue;
      for (const row of occupancy(peaks, points)) {
        const recount = points.filter((p) => Math.hypot(p.x - row.x, p.y - row.y) <= 1.5).length;
        expect(row.count, `${id} ${row.name}`).toBe(recount);
      }
    }
  });

  it('separates all four of Himmelblau\'s minima (their circles do not overlap, so no individual is counted twice)', () => {
    for (let i = 0; i < himmelblau.length; i++)
      for (let j = i + 1; j < himmelblau.length; j++) expect(Math.hypot(himmelblau[i]!.x - himmelblau[j]!.x, himmelblau[i]!.y - himmelblau[j]!.y)).toBeGreaterThan(2 * peakRadius);
  });

  it('says it in words, with the number elsewhere', () => {
    const rows = occupancy(twoPeaks, [{ x: -2.5, y: -2.5 }, { x: -2, y: -2 }, { x: 3, y: 3 }, { x: 0, y: 0 }]);
    expect(occupancySentence(rows, 4)).toBe('Within 1.5 of a peak: broad hill 2, narrow hill 1; elsewhere 1 of 4.');
  });

  it('names a single peak and numbers Himmelblau\'s places', () => {
    const rows = occupancy(landscapeInfo('single-peak').peaks!, [{ x: 2, y: -1 }]);
    expect(occupancySentence(rows, 1)).toBe('Within 1.5 of a peak: the peak 1; elsewhere 0 of 1.');
    expect(occupancy(himmelblau, []).map((r) => r.name)).toEqual(['place 1', 'place 2', 'place 3', 'place 4']);
  });
});

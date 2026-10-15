import { describe, expect, it } from 'vitest';
import { heatLayout } from './heatmap-draw';
import { heatUnit, plotUnit, subRegion } from './heat-zoom';
import { clampView, panBy, wholeView, zoomAbout } from './map-zoom';
import type { Region } from './landscape-grid';

const whole: Region = { x0: -5, x1: 5, y0: -5, y1: 5 };
const population: Region = { x0: 1, x1: 3, y0: -2, y1: 0 };
const unit = heatUnit;
/** The point of the plane under a point of the unit plot. */
const dataAt = (base: Region, u: readonly [number, number]) => ({ x: base.x0 + (u[0] / unit.width) * (base.x1 - base.x0), y: base.y1 - (u[1] / unit.height) * (base.y1 - base.y0) });
const under = (region: Region, u: readonly [number, number]) => dataAt(region, u);

describe('the part of the heatmap shown', () => {
  it('is the whole region at 1×', () => {
    expect(subRegion(whole, wholeView(unit))).toEqual(whole);
    expect(subRegion(population, wholeView(unit))).toEqual(population);
  });

  it('at 2× about the middle is the middle half of the region, with the axes the right way up', () => {
    const v = zoomAbout(wholeView(unit), unit, 2, [500, 500]);
    const r = subRegion(whole, v);
    expect(r.x0).toBeCloseTo(-2.5, 9);
    expect(r.x1).toBeCloseTo(2.5, 9);
    expect(r.y0).toBeCloseTo(-2.5, 9);
    expect(r.y1).toBeCloseTo(2.5, 9);
    expect(r.x1 - r.x0).toBeCloseTo((whole.x1 - whole.x0) / 2, 9);
  });

  it('keeps the point of the plane under the pointer where it was, for the whole domain and for the population region', () => {
    for (const base of [whole, population]) {
      const pointer: [number, number] = [830, 140];
      const before = dataAt(base, pointer);
      const v = zoomAbout(wholeView(unit), unit, 3.5, pointer);
      const after = under(subRegion(base, v), pointer);
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
      const w = zoomAbout(v, unit, 2, [200, 700]);
      const was = under(subRegion(base, v), [200, 700]);
      const now = under(subRegion(base, w), [200, 700]);
      expect(now.x).toBeCloseTo(was.x, 9);
      expect(now.y).toBeCloseTo(was.y, 9);
    }
  });

  it('dragging the picture right shows what lies to its left, dragging it down shows what lies above; and it never leaves the region', () => {
    const v0 = zoomAbout(wholeView(unit), unit, 4, [500, 500]);
    const r0 = subRegion(whole, v0);
    const right = subRegion(whole, panBy(v0, unit, 100, 0));
    expect(right.x0).toBeLessThan(r0.x0);
    expect(right.x1 - right.x0).toBeCloseTo(r0.x1 - r0.x0, 9);
    const down = subRegion(whole, panBy(v0, unit, 0, 100));
    expect(down.y1).toBeGreaterThan(r0.y1);
    for (const [dx, dy] of [[1e6, 1e6], [-1e6, -1e6], [1e6, -1e6]] as const) {
      const r = subRegion(whole, panBy(v0, unit, dx, dy));
      expect(r.x0).toBeGreaterThanOrEqual(whole.x0 - 1e-9);
      expect(r.x1).toBeLessThanOrEqual(whole.x1 + 1e-9);
      expect(r.y0).toBeGreaterThanOrEqual(whole.y0 - 1e-9);
      expect(r.y1).toBeLessThanOrEqual(whole.y1 + 1e-9);
    }
    expect(clampView(v0, unit)).toEqual(v0);
  });

  it('at 40× the region is a fortieth of the base across', () => {
    let v = wholeView(unit);
    for (let k = 0; k < 20; k++) v = zoomAbout(v, unit, 2, [300, 300]);
    const r = subRegion(whole, v);
    expect(r.x1 - r.x0).toBeCloseTo(10 / 40, 9);
  });
});

describe('a pointer on the canvas, in the unit plot', () => {
  const layout = heatLayout(725, 410);
  const pw = Math.round(layout.R - layout.L);
  const ph = Math.round(layout.B - layout.T);

  it('the corners of the plot are the corners of the unit square, the middle its middle', () => {
    expect(plotUnit(layout, layout.L, layout.T)).toEqual([0, 0]);
    const far = plotUnit(layout, layout.L + pw - 1, layout.T + ph - 1);
    expect(far[0]).toBeCloseTo(1000, 9);
    expect(far[1]).toBeCloseTo(1000, 9);
    const mid = plotUnit(layout, layout.L + (pw - 1) / 2, layout.T + (ph - 1) / 2);
    expect(mid[0]).toBeCloseTo(500, 9);
    expect(mid[1]).toBeCloseTo(500, 9);
  });

  it('a pointer outside the plot (on the axes or the scale) is held at its edge', () => {
    expect(plotUnit(layout, 0, 0)).toEqual([0, 0]);
    const out = plotUnit(layout, 99999, 99999);
    expect(out).toEqual([1000, 1000]);
  });
});

import { describe, expect, it } from 'vitest';
import { defaultView, dragBy, rotate, surfaceMesh, surfaceZoom, surfaceZoomLimits, type SurfaceView } from './surface-projection';

const info = { fitnessAt: (x: number, y: number) => -(x * x + y * y), fitnessRange: { min: -50, max: 0 }, bounds: { lo: -5, hi: 5 } } as const;

describe('the surface camera zoom', () => {
  it('starts at 1× and steps by a factor, held between 1× and 4×', () => {
    expect(surfaceZoomLimits).toEqual({ min: 1, max: 4 });
    const a = surfaceZoom(defaultView, 1.5);
    expect(a.zoom).toBeCloseTo(1.5, 9);
    expect(surfaceZoom(a, 1.5).zoom).toBeCloseTo(2.25, 9);
    expect(surfaceZoom(defaultView, 0.5).zoom).toBe(1);
    expect(surfaceZoom({ ...defaultView, zoom: 3 }, 10).zoom).toBe(4);
    expect(surfaceZoom({ ...defaultView, zoom: 4 }, 1.2).zoom).toBe(4);
  });

  it('is kept by rotating and dragging and reset by the reset action', () => {
    const v: SurfaceView = { ...defaultView, zoom: 2.5 };
    for (const action of ['left', 'right', 'up', 'down'] as const) expect(rotate(v, action).zoom).toBe(2.5);
    expect(dragBy(v, 30, -20).zoom).toBe(2.5);
    expect(rotate(v, 'reset')).toEqual(defaultView);
  });

  it('a view without a zoom is a view at 1×, and rotating it does not invent one', () => {
    expect(rotate(defaultView, 'left')).toEqual({ az: defaultView.az - 0.25, el: defaultView.el });
    expect(dragBy(defaultView, 10, 0).zoom).toBeUndefined();
  });

  it('brings the camera closer: every point lies twice as far from the middle of the picture at 2× (the perspective does not change)', () => {
    const near = surfaceMesh(info, defaultView, 725, 410);
    const far = surfaceMesh(info, { ...defaultView, zoom: 2 }, 725, 410);
    for (const [x, y] of [[0, 0], [3, -2], [-4, 4], [5, 5]] as const) {
      const f = info.fitnessAt(x, y);
      const a = near.project(x, y, f);
      const b = far.project(x, y, f);
      expect(b.sx - 725 / 2).toBeCloseTo(2 * (a.sx - 725 / 2), 6);
      expect(b.depth).toBeCloseTo(a.depth, 9);
    }
  });
});

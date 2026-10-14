import { describe, expect, it } from 'vitest';
import { cityNumberSize, clampView, labelPlacement, maxZoom, minZoom, panBy, resetView, toScreen, visibleCity, wholeView, zoomAbout, zoomBy, zoomNote, type MapView } from './map-zoom';

const size = { width: 740, height: 292 };
const near = (a: readonly [number, number], b: readonly [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 9);
  expect(a[1]).toBeCloseTo(b[1], 9);
};
/** The point of the picture (in the layout's coordinates) that lies under the screen point. */
const under = (v: MapView, at: readonly [number, number]): [number, number] => [(at[0] - size.width / 2) / v.zoom + v.cx, (at[1] - size.height / 2) / v.zoom + v.cy];

describe('the whole view', () => {
  it('shows the layout as it is: 1×, centred, every point on its own place', () => {
    const v = wholeView(size);
    expect(v).toEqual({ zoom: 1, cx: 370, cy: 146 });
    near(toScreen(v, size, [100, 40]), [100, 40]);
    near(toScreen(v, size, [740, 292]), [740, 292]);
  });
});

describe('zoom about a point', () => {
  it('keeps the point under the pointer where it was', () => {
    const v0 = zoomAbout(wholeView(size), size, 2, [600, 80]);
    const before = under(wholeView(size), [600, 80]);
    near(under(v0, [600, 80]), before);
    expect(v0.zoom).toBe(2);
    const v1 = zoomAbout(v0, size, 1.5, [200, 200]);
    near(under(v1, [200, 200]), under(v0, [200, 200]));
    expect(v1.zoom).toBeCloseTo(3, 9);
  });

  it('moves a point under a pointer in the middle of the picture not at all: a zoom there only scales', () => {
    const v = zoomAbout(wholeView(size), size, 4, [370, 146]);
    expect(v).toEqual({ zoom: 4, cx: 370, cy: 146 });
  });

  it('stops at 1× and at 40×', () => {
    expect(zoomAbout(wholeView(size), size, 0.5, [100, 100]).zoom).toBe(minZoom);
    expect(minZoom).toBe(1);
    let v = wholeView(size);
    for (let k = 0; k < 40; k++) v = zoomAbout(v, size, 2, [300, 100]);
    expect(v.zoom).toBe(maxZoom);
    expect(maxZoom).toBe(40);
    // a wheel notch at the limit changes nothing
    expect(zoomAbout(v, size, 1.2, [300, 100])).toEqual(v);
  });

  it('keeps the point still even when the limit cuts the factor short', () => {
    const v = zoomAbout(wholeView(size), size, 30, [650, 40]);
    const w = zoomAbout(v, size, 10, [650, 40]);
    expect(w.zoom).toBe(40);
    near(under(w, [650, 40]), under(v, [650, 40]));
  });

  it('cannot show beyond the picture: zooming out about a corner pulls the picture back to fill the window', () => {
    let v = zoomAbout(wholeView(size), size, 8, [720, 20]);
    v = zoomAbout(v, size, 1 / 2, [720, 20]);
    const half = size.width / (2 * v.zoom);
    expect(v.cx - half).toBeGreaterThanOrEqual(-1e-9);
    expect(v.cx + half).toBeLessThanOrEqual(size.width + 1e-9);
  });

  it('a step about the centre of the window is a zoom about the point in the middle of the screen', () => {
    const w = zoomAbout(wholeView(size), size, 3, [500, 100]);
    const a = zoomBy(w, size, 1.25);
    const b = zoomAbout(w, size, 1.25, [size.width / 2, size.height / 2]);
    expect(a).toEqual(b);
  });
});

describe('pan', () => {
  it('moves the picture with the drag: a point goes where the pointer went', () => {
    const v0 = zoomAbout(wholeView(size), size, 4, [370, 146]);
    const p: [number, number] = [300, 100];
    const was = toScreen(v0, size, p);
    const v1 = panBy(v0, size, 50, -20);
    near(toScreen(v1, size, p), [was[0] + 50, was[1] - 20]);
  });

  it('cannot be dragged out of sight: the window stays inside the layout in all four directions', () => {
    const v0 = zoomAbout(wholeView(size), size, 4, [370, 146]);
    const far = (dx: number, dy: number) => panBy(v0, size, dx, dy);
    for (const [dx, dy] of [[1e6, 0], [-1e6, 0], [0, 1e6], [0, -1e6], [1e6, 1e6], [-1e6, -1e6]] as const) {
      const v = far(dx, dy);
      expect(v.cx - size.width / (2 * v.zoom)).toBeGreaterThanOrEqual(-1e-9);
      expect(v.cx + size.width / (2 * v.zoom)).toBeLessThanOrEqual(size.width + 1e-9);
      expect(v.cy - size.height / (2 * v.zoom)).toBeGreaterThanOrEqual(-1e-9);
      expect(v.cy + size.height / (2 * v.zoom)).toBeLessThanOrEqual(size.height + 1e-9);
    }
    // dragged as far right as it goes, the left edge of the layout is at the left edge of the picture
    expect(toScreen(far(1e6, 0), size, [0, 146])[0]).toBeCloseTo(0, 9);
  });

  it('at 1× there is nothing to pan', () => {
    expect(panBy(wholeView(size), size, 80, 80)).toEqual(wholeView(size));
  });

  it('clamping a view that is already inside leaves it alone, and one outside is pulled in', () => {
    const inside: MapView = { zoom: 2, cx: 300, cy: 140 };
    expect(clampView(inside, size)).toEqual(inside);
    expect(clampView({ zoom: 2, cx: -500, cy: 9999 }, size)).toEqual({ zoom: 2, cx: 185, cy: 292 - 73 });
  });
});

describe('reset', () => {
  it('returns to the whole view from anywhere', () => {
    const v = panBy(zoomAbout(wholeView(size), size, 12, [100, 50]), size, 30, 30);
    expect(v.zoom).toBeGreaterThan(1);
    expect(resetView(size)).toEqual(wholeView(size));
  });
});

describe('what is on screen keeps its size', () => {
  it('a zoomed picture moves the cities apart, not the dots: positions scale, a dot has no size in the view', () => {
    const v = zoomAbout(wholeView(size), size, 5, [370, 146]);
    const a = toScreen(v, size, [370, 146]);
    const b = toScreen(v, size, [372, 146]);
    expect(b[0] - a[0]).toBeCloseTo(10, 9);
  });
});

describe('the city numbers', () => {
  it('keep the sizes of milestone 6 in the whole map: 13, 11 and 9 px by the number of cities, none above 52', () => {
    expect(cityNumberSize(5, 1, true)).toBe(13);
    expect(cityNumberSize(16, 1, true)).toBe(13);
    expect(cityNumberSize(17, 1, true)).toBe(11);
    expect(cityNumberSize(30, 1, true)).toBe(11);
    expect(cityNumberSize(31, 1, true)).toBe(9);
    expect(cityNumberSize(52, 1, true)).toBe(9);
    expect(cityNumberSize(53, 1, true)).toBe(0);
  });

  it('are shown at full size (13 px) once zoomed in far enough, even for 52 cities and for more than 52', () => {
    expect(cityNumberSize(52, 1.5, true)).toBe(9);
    expect(cityNumberSize(52, 2, true)).toBe(13);
    expect(cityNumberSize(52, 40, true)).toBe(13);
    expect(cityNumberSize(60, 2, true)).toBe(13);
    expect(cityNumberSize(60, 1.99, true)).toBe(0);
  });

  it('are not drawn at all when switched off, at every zoom', () => {
    for (const n of [5, 16, 30, 52, 60]) for (const z of [1, 2, 10, 40]) expect(cityNumberSize(n, z, false)).toBe(0);
  });

  it('never leave the picture: a label of any number at any visible city lies inside the picture', () => {
    for (const text of ['1', '9', '10', '52', '100']) {
      for (const fontSize of [9, 11, 13]) {
        for (let x = 6; x <= size.width - 6; x += 7) {
          for (let y = 6; y <= size.height - 6; y += 7) {
            const at = labelPlacement(x, y, text, fontSize, size);
            const w = text.length * fontSize * 0.62;
            const left = at.anchor === 'start' ? at.x : at.x - w;
            expect(left).toBeGreaterThanOrEqual(0);
            expect(left + w).toBeLessThanOrEqual(size.width);
            expect(at.y - fontSize).toBeGreaterThanOrEqual(0);
            expect(at.y).toBeLessThanOrEqual(size.height);
          }
        }
      }
    }
  });
});

describe('which cities are in the picture', () => {
  it('a city is drawn when its whole dot is inside the picture, so no marker is cut or outside', () => {
    expect(visibleCity([100, 100], size, 9)).toBe(true);
    expect(visibleCity([9, 100], size, 9)).toBe(true);
    expect(visibleCity([8.9, 100], size, 9)).toBe(false);
    expect(visibleCity([size.width - 9, size.height - 9], size, 9)).toBe(true);
    expect(visibleCity([size.width - 8, 100], size, 9)).toBe(false);
    expect(visibleCity([100, -5], size, 9)).toBe(false);
    expect(visibleCity([100, size.height + 5], size, 9)).toBe(false);
  });
});

describe('the note in the corner', () => {
  it('says the zoom once zoomed, and nothing at 1×', () => {
    expect(zoomNote(1)).toBe('');
    expect(zoomNote(4)).toBe('zoomed 4×, drag to move');
    expect(zoomNote(2.5)).toBe('zoomed 2.5×, drag to move');
    expect(zoomNote(1.2)).toBe('zoomed 1.2×, drag to move');
    expect(zoomNote(12.04)).toBe('zoomed 12×, drag to move');
  });
});

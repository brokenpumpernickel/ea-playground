import { describe, expect, test } from 'vitest';
import { landscapeProblem, type LandscapeFunction } from '../engine';
import { canvasSize } from './landscape-canvas';
import { landscapeInfoOf } from './landscape-context';
import { rampLuminance } from './landscape-grid';
import { defaultView, dragBy, isHidden, middleOffset, rasterise, rotate, surfaceMesh, viewLimits, type SurfaceView } from './surface-projection';

const infoOf = (fn: LandscapeFunction) => landscapeInfoOf(landscapeProblem({ function: fn, representation: 'real', bitsPerVariable: 10 }));
const W = canvasSize.width;
const H = canvasSize.height;

describe('the camera', () => {
  test('starts where the mock put it and rotates by fixed steps: left and right turn the azimuth, up and down tilt, reset returns', () => {
    expect(defaultView).toEqual({ az: -0.7, el: 0.9 });
    const left = rotate(defaultView, 'left');
    const right = rotate(defaultView, 'right');
    expect(left.az).toBeLessThan(defaultView.az);
    expect(right.az).toBeGreaterThan(defaultView.az);
    expect(left.el).toBe(defaultView.el);
    expect(rotate(defaultView, 'up').el).toBeGreaterThan(defaultView.el);
    expect(rotate(defaultView, 'down').el).toBeLessThan(defaultView.el);
    expect(rotate(rotate(left, 'right'), 'left')).toEqual(left);
    expect(rotate(right, 'reset')).toEqual(defaultView);
  });

  test('the tilt stays between nearly flat and straight down, however many times it is pressed; the azimuth turns freely', () => {
    let v: SurfaceView = defaultView;
    for (let k = 0; k < 50; k++) v = rotate(v, 'up');
    expect(v.el).toBe(viewLimits.maxElevation);
    for (let k = 0; k < 100; k++) v = rotate(v, 'down');
    expect(v.el).toBe(viewLimits.minElevation);
    let turned: SurfaceView = defaultView;
    for (let k = 0; k < 40; k++) turned = rotate(turned, 'right');
    expect(turned.az).toBeGreaterThan(2 * Math.PI);
  });

  test('dragging turns by the distance dragged: to the right turns right, down looks more from above and up more from the side, and it is clamped like the buttons', () => {
    const d = dragBy(defaultView, 50, 0);
    expect(d.az).toBeGreaterThan(defaultView.az);
    expect(d.el).toBe(defaultView.el);
    expect(dragBy(defaultView, 0, 40).el).toBeGreaterThan(defaultView.el); // dragging down raises the camera: the surface is seen more from above
    expect(dragBy(defaultView, 0, -40).el).toBeLessThan(defaultView.el); // dragging up lowers it: more from the side
    expect(dragBy(defaultView, 0, -10_000).el).toBe(viewLimits.minElevation);
    expect(dragBy(defaultView, 0, 10_000).el).toBe(viewLimits.maxElevation);
    expect(dragBy(defaultView, 0, 0)).toEqual(defaultView);
  });
});

describe('where a point lands on the screen', () => {
  test('is the perspective of the mock’s own formula: azimuth turns about the vertical, elevation tilts, and the centre of the landscape sits at the middle of the canvas', () => {
    const info = infoOf('single-peak');
    const mesh = surfaceMesh(info, { az: 0, el: 0 }, W, H);
    const { fmin, fmax } = mesh;
    const mid = (fmin + fmax) / 2;
    const c = mesh.project(0, 0, mid);
    expect(c.sx).toBeCloseTo(W / 2, 9);
    expect(c.sy).toBeCloseTo(H / 2 + middleOffset, 9);
    // az = 0, el = 0: x runs left to right, y goes into the picture (smaller on screen, a little), height goes up
    const right = mesh.project(5, 0, mid);
    const far = mesh.project(0, 5, mid);
    const high = mesh.project(0, 0, fmax);
    expect(right.sx).toBeGreaterThan(c.sx);
    expect(right.sy).toBeCloseTo(c.sy, 9);
    expect(far.sx).toBeCloseTo(c.sx, 9);
    expect(far.depth).toBeGreaterThan(c.depth);
    expect(high.sy).toBeLessThan(c.sy);
    expect(high.sx).toBeCloseTo(c.sx, 9);
    // a quarter turn about the vertical swaps the two ground axes
    const quarter = surfaceMesh(info, { az: Math.PI / 2, el: 0 }, W, H);
    const q = quarter.project(5, 0, mid);
    expect(q.sx).toBeCloseTo(W / 2, 6);
    expect(q.depth).toBeGreaterThan(quarter.project(0, 0, mid).depth);
  });

  test('looking straight down (elevation 90°) the picture is the plan: height does not move a point sideways or up, and x and y are its axes', () => {
    const info = infoOf('single-peak');
    const mesh = surfaceMesh(info, { az: 0, el: Math.PI / 2 }, W, H);
    const lo = mesh.project(1, 1, mesh.fmin);
    const hi = mesh.project(1, 1, mesh.fmax);
    expect(Math.abs(hi.sx - lo.sx)).toBeLessThan(12); // only the perspective of getting nearer moves it
    expect(Math.abs(hi.sy - lo.sy)).toBeLessThan(25);
    expect(mesh.project(3, 1, 0).sx).toBeGreaterThan(lo.sx);
    expect(mesh.project(1, 3, 0).sy).toBeLessThan(lo.sy);
  });

  test('the four corners of the landscape keep their order as the surface turns: going once round the floor they make a ring that never crosses itself', () => {
    const info = infoOf('rastrigin');
    type P = { sx: number; sy: number };
    const side = (p: P, q: P, r: P) => Math.sign((q.sx - p.sx) * (r.sy - p.sy) - (q.sy - p.sy) * (r.sx - p.sx));
    const crosses = (a: P, b: P, c: P, d: P) => side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
    for (let az = -3; az <= 3; az += 0.5) {
      for (const el of [0.2, 0.6, 1.0, 1.4]) {
        const mesh = surfaceMesh(info, { az, el }, W, H);
        const c = [mesh.project(-5.12, -5.12, mesh.fmin), mesh.project(5.12, -5.12, mesh.fmin), mesh.project(5.12, 5.12, mesh.fmin), mesh.project(-5.12, 5.12, mesh.fmin)];
        expect(crosses(c[0]!, c[1]!, c[2]!, c[3]!), `az ${az} el ${el}: opposite sides cross`).toBe(false);
        expect(crosses(c[1]!, c[2]!, c[3]!, c[0]!), `az ${az} el ${el}: opposite sides cross`).toBe(false);
        // going round the ring turns one way throughout
        const turns = c.map((p, k) => side(p, c[(k + 1) % 4]!, c[(k + 2) % 4]!));
        expect(new Set(turns).size, `az ${az} el ${el}`).toBe(1);
      }
    }
  });

  test('the mesh is 44 × 44 cells, drawn from the farthest to the nearest, and every cell’s corner is the engine’s fitness', () => {
    const info = infoOf('two-peaks');
    const mesh = surfaceMesh(info, defaultView, W, H);
    expect(mesh.G).toBe(44);
    expect(mesh.quads).toHaveLength(44 * 44);
    for (let k = 1; k < mesh.quads.length; k++) expect(mesh.quads[k - 1]!.depth).toBeGreaterThanOrEqual(mesh.quads[k]!.depth);
    for (const q of [mesh.quads[0]!, mesh.quads[1000]!, mesh.quads[1935]!]) {
      for (const p of q.pts) expect(p.f).toBe(info.fitnessAt(p.x, p.y));
    }
  });
});

describe('shading and colour', () => {
  test('a cell’s colour is the ramp of its fitness, lit from one side: the lit factor stays between 0.72 and 1.12, the base colour is the ramp itself', () => {
    const info = infoOf('single-peak');
    const mesh = surfaceMesh(info, defaultView, W, H);
    for (const q of mesh.quads) {
      expect(q.shade).toBeGreaterThanOrEqual(0.72 - 1e-9);
      expect(q.shade).toBeLessThanOrEqual(1.12 + 1e-9);
      q.base.forEach((v, c) => expect(q.colour[c]).toBe(Math.min(255, Math.round(v * q.shade))));
    }
  });

  test('the lighting is real: flat ground is lit by the vertical part of the light alone (0.72 + 0.4 × 0.75), a flank facing the light is brighter, one facing away is darker', () => {
    const mesh = surfaceMesh(infoOf('single-peak'), defaultView, W, H);
    const flat = mesh.quads.filter((q) => Math.max(...q.pts.map((p) => p.f)) - Math.min(...q.pts.map((p) => p.f)) < 1e-4); // the far corners of the single hill are as good as level
    expect(flat.length).toBeGreaterThan(0);
    // the light is (−0.4, −0.5, 0.75), which is not quite a unit vector: its vertical part alone gives 0.72 + 0.4 × 0.75 = 1.02 on level ground
    for (const q of flat) expect(q.shade).toBeCloseTo(1.02, 2);
    const shades = mesh.quads.map((q) => q.shade);
    expect(Math.max(...shades)).toBeGreaterThan(1.05);
    expect(Math.min(...shades)).toBeLessThan(0.9);
    // the flank of the hill on the light's side (west and south of the peak at (2, −1), where the ground slopes toward the light) is brighter than the far side
    const at = (x: number, y: number) => mesh.quads.find((q) => q.pts[0].x <= x && q.pts[1].x > x && q.pts[0].y <= y && q.pts[3].y > y)!;
    expect(at(0.6, -1).shade).toBeGreaterThan(at(3.4, -1).shade);
  });

  test('along a ridge (the line through the peak of the single hill) the base colour is monotone in fitness: lighter toward the top', () => {
    const info = infoOf('single-peak');
    const mesh = surfaceMesh(info, defaultView, W, H);
    // the cells of the column x ≈ 2 from y = −5 to the peak at y = −1: fitness only rises
    const column = mesh.quads.filter((q) => q.i === Math.floor(((2 + 5) / 10) * 44)).sort((a, b) => a.j - b.j);
    const rising = column.filter((q) => q.pts[0].y <= -1);
    expect(rising.length).toBeGreaterThan(10);
    for (let k = 1; k < rising.length; k++) {
      expect(rising[k]!.f).toBeGreaterThan(rising[k - 1]!.f);
      expect(rampLuminance(rising[k]!.base)).toBeGreaterThanOrEqual(rampLuminance(rising[k - 1]!.base) - 0.003);
    }
  });
});

describe('what hides what', () => {
  const info = infoOf('two-peaks');

  test('a point behind a ridge is hidden and a point in front of it is not', () => {
    // the camera looks along +y at a low angle; the narrow tall hill is at (3, 3)
    const view: SurfaceView = { az: 0, el: 0.2 };
    const mesh = surfaceMesh(info, view, W, H);
    const ids = rasterise(mesh);
    const behind = { x: 3, y: 4.9, f: info.fitnessAt(3, 4.9) };
    const inFront = { x: 3, y: -3, f: info.fitnessAt(3, -3) };
    const b = mesh.project(behind.x, behind.y, behind.f);
    const f = mesh.project(inFront.x, inFront.y, inFront.f);
    expect(f.sy).toBeLessThan(H); // the point in front is on the canvas
    expect(isHidden(mesh, ids, behind, b.sx, b.sy)).toBe(true);
    expect(isHidden(mesh, ids, inFront, f.sx, f.sy)).toBe(false);
    // the top of the hill itself is seen
    const top = { x: 3, y: 3, f: info.fitnessAt(3, 3) };
    const t = mesh.project(top.x, top.y, top.f);
    expect(isHidden(mesh, ids, top, t.sx, t.sy)).toBe(false);
  });

  test('seen from above nothing is hidden behind that hill', () => {
    const mesh = surfaceMesh(info, { az: 0, el: 1.45 }, W, H);
    const ids = rasterise(mesh);
    const behind = { x: 3, y: 4.9, f: info.fitnessAt(3, 4.9) };
    const b = mesh.project(behind.x, behind.y, behind.f);
    expect(isHidden(mesh, ids, behind, b.sx, b.sy)).toBe(false);
  });

  test('the item buffer holds, at each cell’s centre that nothing nearer covers, that cell’s own code; outside the surface it is empty', () => {
    const mesh = surfaceMesh(infoOf('single-peak'), defaultView, W, H);
    const ids = rasterise(mesh);
    expect(ids.width).toBe(W);
    expect(ids.height).toBe(H);
    expect(ids.data[0]).toBe(0); // a corner of the canvas is empty
    let own = 0;
    for (let k = 0; k < mesh.quads.length; k += 7) {
      const q = mesh.quads[k]!;
      const cx = Math.round(q.pts.reduce((s, p) => s + p.sx, 0) / 4);
      const cy = Math.round(q.pts.reduce((s, p) => s + p.sy, 0) / 4);
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue; // off the canvas
      const code = ids.data[cy * W + cx]!;
      expect(code).toBeGreaterThan(0);
      if (code === k + 1) own++;
    }
    expect(own).toBeGreaterThan(100); // most are not covered by a nearer cell
  });
});

describe('the starting view shows the whole surface', () => {
  test.each(['single-peak', 'two-peaks', 'rastrigin', 'himmelblau'] as const)('%s: all four corners of the floor and the highest point are on the canvas with a margin', (fn) => {
    const info = infoOf(fn);
    const mesh = surfaceMesh(info, defaultView, W, H);
    const { lo, hi } = info.bounds;
    const points = [mesh.project(lo, lo, mesh.fmin), mesh.project(hi, lo, mesh.fmin), mesh.project(hi, hi, mesh.fmin), mesh.project(lo, hi, mesh.fmin), mesh.project(2, 2, mesh.fmax), mesh.project(-2, -2, mesh.fmax)];
    for (const p of points) {
      expect(p.sx).toBeGreaterThanOrEqual(4);
      expect(p.sx).toBeLessThanOrEqual(W - 4);
      expect(p.sy).toBeGreaterThanOrEqual(4);
      expect(p.sy).toBeLessThanOrEqual(H - 4);
    }
  });
});

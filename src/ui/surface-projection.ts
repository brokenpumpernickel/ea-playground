import type { LandscapeInfo } from './landscape-context';
import { ramp } from './landscape-grid';

/**
 * The surface view's mathematics, with no drawing: a camera (azimuth and elevation), the perspective projection of a point
 * (x, y, fitness) onto the canvas, the mesh of 44 × 44 cells sorted from the farthest to the nearest (the painter's
 * algorithm), each cell's colour (the heatmap's ramp by fitness, lit from one side), and an item buffer that says which cell
 * is on top at each pixel, so a marker standing behind a ridge can be told from one in front.
 */

export interface SurfaceView {
  /** Turn about the vertical, in radians. */
  readonly az: number;
  /** Tilt from edge-on (0) to straight down (π/2), in radians. */
  readonly el: number;
  /** How close the camera is: 1 (or none) is the whole surface in the picture, larger fills it with the middle. */
  readonly zoom?: number;
}

/** Where the mock put the camera: turned a little left, looking down at about 50°. */
export const defaultView: SurfaceView = { az: -0.7, el: 0.9 };

export const viewLimits = { minElevation: 0.08, maxElevation: 1.45, azimuthStep: 0.25, elevationStep: 0.125 } as const;

export const surfaceZoomLimits = { min: 1, max: 4 } as const;

/** The view after zooming the camera by a factor, between 1× and 4×. */
export const surfaceZoom = (view: SurfaceView, factor: number): SurfaceView => ({ ...view, zoom: Math.min(surfaceZoomLimits.max, Math.max(surfaceZoomLimits.min, (view.zoom ?? 1) * factor)) });

export type Rotation = 'left' | 'right' | 'up' | 'down' | 'reset';

const clampElevation = (el: number) => Math.min(viewLimits.maxElevation, Math.max(viewLimits.minElevation, el));

/** The view after one press of a rotation button or arrow key. */
export function rotate(view: SurfaceView, action: Rotation): SurfaceView {
  switch (action) {
    case 'left':
      return { ...view, az: view.az - viewLimits.azimuthStep };
    case 'right':
      return { ...view, az: view.az + viewLimits.azimuthStep };
    case 'up':
      return { ...view, el: clampElevation(view.el + viewLimits.elevationStep) };
    case 'down':
      return { ...view, el: clampElevation(view.el - viewLimits.elevationStep) };
    case 'reset':
      return { ...defaultView };
  }
}

/** The view after dragging the pointer by (dx, dy) pixels: right turns right, up tilts the surface up toward the viewer. */
export const dragBy = (view: SurfaceView, dx: number, dy: number): SurfaceView => ({ ...view, az: view.az + dx * 0.01, el: clampElevation(view.el - dy * 0.008) });

export interface Vertex {
  readonly x: number;
  readonly y: number;
  /** The fitness at (x, y). */
  readonly f: number;
  readonly sx: number;
  readonly sy: number;
  /** Larger is farther from the viewer. */
  readonly depth: number;
}

export interface Quad {
  /** The cell's column and row in the mesh. */
  readonly i: number;
  readonly j: number;
  readonly pts: readonly [Vertex, Vertex, Vertex, Vertex];
  readonly depth: number;
  /** The mean fitness of the four corners. */
  readonly f: number;
  /** The ramp's colour for that fitness, and how much the cell is lit (0.72 in shade to 1.12 in full light). */
  readonly base: readonly [number, number, number];
  readonly shade: number;
  /** The colour drawn: the base colour times the shade, cut to 255. */
  readonly colour: readonly [number, number, number];
}

export interface SurfaceMesh {
  readonly G: number;
  readonly width: number;
  readonly height: number;
  readonly fmin: number;
  readonly fmax: number;
  /** The cells from the farthest to the nearest: draw them in this order. */
  readonly quads: readonly Quad[];
  /** Where a point (x, y, fitness) lands: canvas pixel and depth. */
  project(x: number, y: number, f: number): { sx: number; sy: number; depth: number };
  /** The code a cell has in the item buffer: its position in `quads` plus one. */
  codeOf(i: number, j: number): number;
  readonly bounds: { readonly lo: number; readonly hi: number };
}

/**
 * How far the viewer is (in units of the landscape's half-width), how big the picture is and where its middle sits. The mock used a
 * strong perspective at 0.56 of the canvas, which pushed the near corner of the floor off the bottom; this keeps the whole floor
 * and the highest point in view at the starting camera.
 */
const DISTANCE = 10;
const SCALE = 0.36;
export const middleOffset = -20;
const LIGHT = [-0.4, -0.5, 0.75] as const;

export function surfaceMesh(info: Pick<LandscapeInfo, 'fitnessAt' | 'fitnessRange' | 'bounds'>, view: SurfaceView, width: number, height: number, G = 44): SurfaceMesh {
  const { lo, hi } = info.bounds;
  const { min: fmin, max: fmax } = info.fitnessRange;
  const cosA = Math.cos(view.az);
  const sinA = Math.sin(view.az);
  const cosE = Math.cos(view.el);
  const sinE = Math.sin(view.el);
  const scale = Math.min(width, height) * SCALE * (view.zoom ?? 1);
  const half = (hi - lo) / 2;
  const middle = (lo + hi) / 2;
  const project = (x: number, y: number, f: number) => {
    const u = (x - middle) / half;
    const v = (y - middle) / half;
    const w = ((f - fmin) / (fmax - fmin) - 0.5) * 1.1;
    const xr = u * cosA - v * sinA;
    const yr = u * sinA + v * cosA;
    const depth = yr * cosE - w * sinE;
    const k = DISTANCE / (DISTANCE + depth);
    return { sx: width / 2 + xr * scale * k, sy: height / 2 + middleOffset - (w * cosE + yr * sinE) * scale * k, depth };
  };
  const grid: Vertex[][] = [];
  for (let i = 0; i <= G; i++) {
    grid[i] = [];
    for (let j = 0; j <= G; j++) {
      const x = lo + ((hi - lo) * i) / G;
      const y = lo + ((hi - lo) * j) / G;
      const f = info.fitnessAt(x, y);
      grid[i]![j] = { x, y, f, ...project(x, y, f) };
    }
  }
  // the slope of a cell in world units (the height scaled as the projection scales it), for how much light it catches
  const heightUnit = (1.1 * half) / (fmax - fmin);
  const quads: Quad[] = [];
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const a = grid[i]![j]!;
      const b = grid[i + 1]![j]!;
      const c = grid[i + 1]![j + 1]!;
      const d = grid[i]![j + 1]!;
      const ux = b.x - a.x;
      const uy = b.y - a.y;
      const uz = (b.f - a.f) * heightUnit;
      const vx = d.x - a.x;
      const vy = d.y - a.y;
      const vz = (d.f - a.f) * heightUnit;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      const shade = 0.72 + 0.4 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const f = (a.f + b.f + c.f + d.f) / 4;
      const base = ramp((f - fmin) / (fmax - fmin));
      quads.push({
        i,
        j,
        pts: [a, b, c, d],
        depth: (a.depth + b.depth + c.depth + d.depth) / 4,
        f,
        base,
        shade,
        colour: [Math.min(255, Math.round(base[0] * shade)), Math.min(255, Math.round(base[1] * shade)), Math.min(255, Math.round(base[2] * shade))],
      });
    }
  }
  quads.sort((p, q) => q.depth - p.depth);
  const codes = new Map<number, number>();
  quads.forEach((q, n) => codes.set(q.i * G + q.j, n + 1));
  return { G, width, height, fmin, fmax, quads, project, codeOf: (i, j) => codes.get(i * G + j) ?? 0, bounds: info.bounds };
}

export interface ItemBuffer {
  readonly width: number;
  readonly height: number;
  /** For each pixel the code of the nearest cell that covers it, or 0 where there is none. */
  readonly data: Int32Array;
}

/** Fills the cells into a buffer farthest first, so each pixel ends with the code of the cell on top. */
export function rasterise(mesh: SurfaceMesh): ItemBuffer {
  const { width, height } = mesh;
  const data = new Int32Array(width * height);
  const triangle = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, code: number) => {
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) data[y * width + x] = code;
      }
    }
  };
  mesh.quads.forEach((q, n) => {
    const [a, b, c, d] = q.pts;
    triangle(a.sx, a.sy, b.sx, b.sy, c.sx, c.sy, n + 1);
    triangle(a.sx, a.sy, c.sx, c.sy, d.sx, d.sy, n + 1);
  });
  return { width, height, data };
}

/**
 * Whether a point of the surface is hidden: at the pixel where it lands, another cell than the one it stands on (or its
 * neighbours) is on top, so a ridge between the point and the viewer covers it. A pixel no cell covers hides nothing (the
 * apex of a narrow hill is above the mesh, and a point off the canvas is out of view, not behind anything).
 */
export function isHidden(mesh: SurfaceMesh, ids: ItemBuffer, point: { x: number; y: number }, sx: number, sy: number): boolean {
  const { lo, hi } = mesh.bounds;
  const cell = (v: number) => Math.min(mesh.G - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * mesh.G)));
  const i = cell(point.x);
  const j = cell(point.y);
  const px = Math.round(sx);
  const py = Math.round(sy);
  if (px < 0 || py < 0 || px >= ids.width || py >= ids.height) return false;
  const code = ids.data[py * ids.width + px]!;
  if (code === 0) return false;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (i + di < 0 || j + dj < 0 || i + di >= mesh.G || j + dj >= mesh.G) continue;
      if (mesh.codeOf(i + di, j + dj) === code) return false;
    }
  }
  return true;
}

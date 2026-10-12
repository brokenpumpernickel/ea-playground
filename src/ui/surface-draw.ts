import type { LandscapeInfo } from './landscape-context';
import { surfaceMesh, type SurfaceMesh, type SurfaceView } from './surface-projection';

/**
 * Draws the surface of the landscape on a canvas: every cell of the mesh from the farthest to the nearest, filled with the
 * colour of its fitness lit from one side and edged with a faint line, the floor's frame with its axes named, and the optimum
 * marked ✕. Returns the mesh, so a layer drawn over the picture can use the same projection.
 */
export function drawSurface(canvas: HTMLCanvasElement, info: LandscapeInfo, view: SurfaceView): SurfaceMesh {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const mesh = surfaceMesh(info, view, W, H);

  for (const q of mesh.quads) {
    const [a, b, c, d] = q.pts;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
    ctx.fillStyle = `rgb(${q.colour[0]},${q.colour[1]},${q.colour[2]})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // the floor's frame, at the worst fitness, with the axes named
  const { lo, hi } = info.bounds;
  const floor = (x: number, y: number) => mesh.project(x, y, mesh.fmin);
  const corners = [floor(lo, lo), floor(hi, lo), floor(hi, hi), floor(lo, hi)];
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  corners.forEach((p, k) => (k === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  const middle = (p: { sx: number; sy: number }, q: { sx: number; sy: number }) => [(p.sx + q.sx) / 2, (p.sy + q.sy) / 2] as const;
  const xAxis = middle(corners[0]!, corners[1]!);
  const yAxis = middle(corners[0]!, corners[3]!);
  ctx.fillText('x →', xAxis[0], Math.min(H - 4, xAxis[1] + 18));
  ctx.fillText('y →', Math.max(18, yAxis[0] - 18), yAxis[1] + 4);

  // the optimum, marked ✕ at its height on the surface
  for (const o of info.optima) {
    const p = mesh.project(o.x, o.y, info.fitnessAt(o.x, o.y));
    const r = 7;
    ctx.beginPath();
    ctx.moveTo(p.sx - r, p.sy - r);
    ctx.lineTo(p.sx + r, p.sy + r);
    ctx.moveTo(p.sx + r, p.sy - r);
    ctx.lineTo(p.sx - r, p.sy + r);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
  return mesh;
}

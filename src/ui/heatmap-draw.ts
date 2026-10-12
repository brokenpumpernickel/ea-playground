import { formatReal } from '../engine';
import { colourAt, fitnessGrid, isolineLevels, isolines, optimumMarks, placeLabels, ramp, type Region } from './landscape-grid';
import type { LandscapeInfo } from './landscape-context';

/** Where the plot sits inside the canvas, in canvas pixels: the plot's own rectangle, with room around it for the axes and the scale. */
export interface HeatLayout {
  readonly L: number;
  readonly T: number;
  readonly R: number;
  readonly B: number;
}

export const heatLayout = (width: number, height: number): HeatLayout => ({ L: 48, T: 12, R: width - 78, B: height - 38 });

/** The number of pixels across and down the plot (the first pixel is the region's near edge, the last its far edge). */
const plotSize = ({ L, T, R, B }: HeatLayout) => ({ pw: Math.round(R - L), ph: Math.round(B - T) });

/** The canvas pixel of a point of the plane (y grows upward in the plane, downward on the canvas). */
export function pixelOf(layout: HeatLayout, region: Region, x: number, y: number): { px: number; py: number } {
  const { pw, ph } = plotSize(layout);
  return {
    px: layout.L + ((x - region.x0) / (region.x1 - region.x0)) * (pw - 1),
    py: layout.T + ((region.y1 - y) / (region.y1 - region.y0)) * (ph - 1),
  };
}

/** The point of the plane under a canvas pixel of the plot. */
export function pointAt(layout: HeatLayout, region: Region, px: number, py: number): { x: number; y: number } {
  const { pw, ph } = plotSize(layout);
  return {
    x: region.x0 + ((px - layout.L) / (pw - 1)) * (region.x1 - region.x0),
    y: region.y1 - ((py - layout.T) / (ph - 1)) * (region.y1 - region.y0),
  };
}

const decimalsFor = (span: number) => (span < 1 ? 2 : span < 5 ? 1 : 1);
const level = (v: number) => formatReal([v], Math.abs(v) < 2 ? 2 : 0).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m));

/**
 * Draws the heatmap of fitness over the region: every pixel is the fitness at its point coloured by the ramp (worst fitness
 * at the bottom, best at the top), isolines at 20, 40, 60 and 80% of the fitness range with their values, axes with ticks,
 * the optimum marked ✕, and the colour scale with its labelled ends. Returns the plot's layout so a layer drawn over it
 * can use the same mapping.
 */
export function drawHeatmap(canvas: HTMLCanvasElement, info: LandscapeInfo, region: Region): HeatLayout {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const layout = heatLayout(W, H);
  const { L, T, R, B } = layout;
  const pw = Math.round(R - L);
  const ph = Math.round(B - T);
  const { min, max } = info.fitnessRange;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // one pixel at a time: the colour of the fitness at the point it stands for
  const image = ctx.createImageData(pw, ph);
  for (let py = 0; py < ph; py++) {
    const y = region.y1 - ((region.y1 - region.y0) * py) / (ph - 1);
    for (let px = 0; px < pw; px++) {
      const x = region.x0 + ((region.x1 - region.x0) * px) / (pw - 1);
      const [r, g, b] = colourAt(info.fitnessAt(x, y), min, max);
      const k = 4 * (py * pw + px);
      image.data[k] = r;
      image.data[k + 1] = g;
      image.data[k + 2] = b;
      image.data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, L, T);
  // the pixel of a point, as the pixel grid above placed it (the first pixel is x0, the last x1)
  const X = (x: number) => L + ((x - region.x0) / (region.x1 - region.x0)) * (pw - 1);
  const Y = (y: number) => T + ((region.y1 - y) / (region.y1 - region.y0)) * (ph - 1);

  // isolines, the non-colour carrier of the fitness: white lines with their values
  const levels = isolineLevels(info.fitnessRange);
  const lines = isolines(fitnessGrid(info, region, 121, 121), levels);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  lines.forEach((segments) => {
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segments) {
      ctx.moveTo(X(x1), Y(y1));
      ctx.lineTo(X(x2), Y(y2));
    }
    ctx.stroke();
  });
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // each level's value on its own line, clear of the other labels and of the optimum marks
  const inPixels = lines.map((segments) => segments.map(([x1, y1, x2, y2]) => [X(x1), Y(y1), X(x2), Y(y2)] as const));
  const marks = optimumMarks(info, region).map((o) => ({ x: X(o.x), y: Y(o.y) }));
  placeLabels(inPixels, { x: L + pw * 0.5, y: T + ph * 0.25 }, marks, layout).forEach((at, k) => {
    if (!at) return;
    const text = level(levels[k]!);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText(text, at.x, at.y - 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, at.x, at.y - 2);
  });

  // the frame and the axes with their ticks
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(L, T, pw, ph);
  ctx.fillStyle = '#222';
  ctx.font = '13px sans-serif';
  for (let k = 0; k <= 4; k++) {
    const x = region.x0 + ((region.x1 - region.x0) * k) / 4;
    const y = region.y0 + ((region.y1 - region.y0) * k) / 4;
    ctx.textAlign = 'center';
    ctx.fillText(formatReal([x], decimalsFor(region.x1 - region.x0)), X(x), B + 17);
    ctx.textAlign = 'right';
    ctx.fillText(formatReal([y], decimalsFor(region.y1 - region.y0)), L - 6, Y(y) + 4);
  }
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('x', L + pw / 2, B + 32);
  ctx.save();
  ctx.translate(12, T + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('y', 0, 0);
  ctx.restore();

  // the optimum, marked ✕ with a plain label
  for (const o of optimumMarks(info, region)) {
    const x = X(o.x);
    const y = Y(o.y);
    const r = 7;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
  const first = optimumMarks(info, region)[0];
  if (first) {
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    const lx = Math.min(X(first.x) + 10, R - 52);
    const ly = Y(first.y) + 18 > B - 4 ? Y(first.y) - 10 : Y(first.y) + 18;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText(info.optima.length > 1 ? 'optima' : 'optimum', lx, ly);
    ctx.fillStyle = '#fff';
    ctx.fillText(info.optima.length > 1 ? 'optima' : 'optimum', lx, ly);
  }

  // the colour scale: the ramp from the worst fitness (bottom) to the best (top), with its ends and middle labelled
  const sx = R + 18;
  for (let py = 0; py < ph; py++) {
    const [r, g, b] = ramp(1 - py / (ph - 1));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(sx, T + py, 16, 1.5);
  }
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx, T, 16, ph);
  ctx.fillStyle = '#222';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  for (let k = 0; k <= 4; k++) {
    const v = min + ((max - min) * k) / 4;
    ctx.fillText(formatReal([v], Math.abs(max - min) < 5 ? 2 : 0), sx + 22, B - (ph * k) / 4 + 4);
  }
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(info.minimised ? 'fitness = −f' : 'fitness', sx - 4, T - 2);
  return layout;
}

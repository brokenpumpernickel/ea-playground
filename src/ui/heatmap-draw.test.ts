import { describe, expect, test } from 'vitest';
import { heatLayout, pixelOf, pointAt } from './heatmap-draw';
import { canvasSize } from './landscape-canvas';

describe('the heatmap’s layout and pixel mapping', () => {
  const layout = heatLayout(canvasSize.width, canvasSize.height);
  const region = { x0: -5, x1: 5, y0: -5, y1: 5 };

  test('the plot sits inside the canvas with room on the left for the y axis and on the right for the colour scale', () => {
    expect(layout.L).toBeGreaterThanOrEqual(40);
    expect(canvasSize.width - layout.R).toBeGreaterThanOrEqual(70);
    expect(layout.B).toBeLessThan(canvasSize.height - 30);
    expect(layout.T).toBeGreaterThan(0);
  });

  test('the corners of the region are the corners of the plot, y growing upward in the plane and downward on the canvas', () => {
    const lowLeft = pixelOf(layout, region, -5, -5);
    const highRight = pixelOf(layout, region, 5, 5);
    expect(lowLeft.px).toBe(layout.L);
    expect(highRight.px).toBeCloseTo(layout.L + Math.round(layout.R - layout.L) - 1, 9);
    expect(lowLeft.py).toBeGreaterThan(highRight.py);
    expect(highRight.py).toBe(layout.T);
  });

  test('pointAt is the inverse of pixelOf', () => {
    for (const [x, y] of [[-3.3, 4.1], [0, 0], [4.9, -4.9], [1.25, 2.5]] as const) {
      const { px, py } = pixelOf(layout, region, x, y);
      const p = pointAt(layout, region, px, py);
      expect(p.x).toBeCloseTo(x, 9);
      expect(p.y).toBeCloseTo(y, 9);
    }
  });

  test('a zoomed region maps its own corners to the corners of the plot', () => {
    const zoomed = { x0: 1, x1: 3, y0: -2, y1: 0 };
    expect(pixelOf(layout, zoomed, 1, 0)).toEqual({ px: layout.L, py: layout.T });
  });
});

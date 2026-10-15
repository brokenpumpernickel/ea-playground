import type { HeatLayout } from './heatmap-draw';
import type { Region } from './landscape-grid';
import type { MapView } from './map-zoom';

/**
 * Wheel zoom and drag on the heatmap, on top of its two regions (the whole landscape, or "Zoom to population"). The view is a
 * `MapView` over a plot of 1000 × 1000 units whatever its size on screen, so it means the same part of the picture in the small
 * view and in the focus view; `subRegion` turns it into the region of the plane to draw, and `plotUnit` turns a pointer position
 * into a point of the unit plot. The map's zoom arithmetic (about a point, limits, clamping) is reused unchanged.
 */
export const heatUnit = { width: 1000, height: 1000 } as const;

/** The part of `base` the view shows. The plane's y grows upward and the plot's pixels downward, so the top of the window is the larger y. */
export function subRegion(base: Region, view: MapView): Region {
  const halfW = heatUnit.width / (2 * view.zoom);
  const halfH = heatUnit.height / (2 * view.zoom);
  const spanX = base.x1 - base.x0;
  const spanY = base.y1 - base.y0;
  return {
    x0: base.x0 + ((view.cx - halfW) / heatUnit.width) * spanX,
    x1: base.x0 + ((view.cx + halfW) / heatUnit.width) * spanX,
    y1: base.y1 - ((view.cy - halfH) / heatUnit.height) * spanY,
    y0: base.y1 - ((view.cy + halfH) / heatUnit.height) * spanY,
  };
}

/** A canvas pixel as a point of the unit plot, held at the plot's edge when it is on the axes or the scale beside it. */
export function plotUnit(layout: HeatLayout, px: number, py: number): [number, number] {
  const pw = Math.round(layout.R - layout.L);
  const ph = Math.round(layout.B - layout.T);
  const across = Math.min(1, Math.max(0, (px - layout.L) / (pw - 1)));
  const down = Math.min(1, Math.max(0, (py - layout.T) / (ph - 1)));
  return [across * heatUnit.width, down * heatUnit.height];
}

import type { Size } from './route-map-model';

/**
 * The route map's view of its picture: a zoom and the point of the laid-out picture shown at the middle of the window. The
 * picture is zoomed, not the drawing, so dots, lines, rings and numbers keep their size on screen; only the places move apart.
 * Pure arithmetic, no browser: the page asks it where a city lies and where a drag or a wheel notch leaves the view.
 */

export interface MapView {
  /** 1 is the whole picture; larger shows a part of it. */
  readonly zoom: number;
  /** The point of the picture (layout coordinates, as the model places the cities) at the middle of the window. */
  readonly cx: number;
  readonly cy: number;
}

export const minZoom = 1;
export const maxZoom = 40;

export const wholeView = (size: Size): MapView => ({ zoom: minZoom, cx: size.width / 2, cy: size.height / 2 });
export const resetView = wholeView;

/** Where a point of the picture lies in the window. */
export const toScreen = (view: MapView, size: Size, p: readonly [number, number]): [number, number] => [(p[0] - view.cx) * view.zoom + size.width / 2, (p[1] - view.cy) * view.zoom + size.height / 2];

/** The window never shows beyond the picture, so it cannot be dragged out of sight; at 1× there is nothing to move. */
export function clampView(view: MapView, size: Size): MapView {
  const halfW = size.width / (2 * view.zoom);
  const halfH = size.height / (2 * view.zoom);
  const cx = Math.min(Math.max(view.cx, halfW), size.width - halfW);
  const cy = Math.min(Math.max(view.cy, halfH), size.height - halfH);
  return cx === view.cx && cy === view.cy ? view : { zoom: view.zoom, cx, cy };
}

/** Zoom by a factor, the point of the picture under `at` (window coordinates) staying under it; limited to 1× to 40×. */
export function zoomAbout(view: MapView, size: Size, factor: number, at: readonly [number, number]): MapView {
  const zoom = Math.min(maxZoom, Math.max(minZoom, view.zoom * factor));
  if (zoom === view.zoom) return view;
  const px = (at[0] - size.width / 2) / view.zoom + view.cx;
  const py = (at[1] - size.height / 2) / view.zoom + view.cy;
  return clampView({ zoom, cx: px - (at[0] - size.width / 2) / zoom, cy: py - (at[1] - size.height / 2) / zoom }, size);
}

/** A zoom step from the keyboard or a button: about the middle of the window. */
export const zoomBy = (view: MapView, size: Size, factor: number): MapView => zoomAbout(view, size, factor, [size.width / 2, size.height / 2]);

/** A drag of (dx, dy) window pixels: the picture goes with the pointer. */
export const panBy = (view: MapView, size: Size, dx: number, dy: number): MapView => clampView({ zoom: view.zoom, cx: view.cx - dx / view.zoom, cy: view.cy - dy / view.zoom }, size);

/**
 * The size of the city numbers: those of the first version for the whole map (13, 11 and 9 px by the number of cities, none
 * above 52, where they would only smear), and full size once zoomed in to twice or more, where the cities are far enough apart.
 */
export function cityNumberSize(cities: number, zoom: number, show: boolean): number {
  if (!show) return 0;
  if (zoom >= 2) return 13;
  return cities <= 16 ? 13 : cities <= 30 ? 11 : cities <= 52 ? 9 : 0;
}

/** A number sits up and to the right of its city, or down and to the left near an edge of the picture, so it never leaves it. */
export function labelPlacement(x: number, y: number, text: string, fontSize: number, size: Size): { readonly x: number; readonly y: number; readonly anchor: 'start' | 'end' } {
  const w = text.length * fontSize * 0.62 + 2;
  const right = x + 9 + w <= size.width - 4;
  const up = y - 9 - fontSize >= 2;
  return { x: right ? x + 9 : x - 9, y: up ? y - 7 : y + 7 + fontSize, anchor: right ? 'start' : 'end' };
}

/** A city is drawn only when its whole dot is inside the picture, so no marker or number is cut or outside. */
export const visibleCity = (at: readonly [number, number], size: Size, radius: number): boolean => at[0] >= radius && at[0] <= size.width - radius && at[1] >= radius && at[1] <= size.height - radius;

/** The corner note about the zoom; empty for the whole map. */
export function zoomNote(zoom: number): string {
  if (zoom <= minZoom + 1e-9) return '';
  const shown = Math.round(zoom * 10) / 10;
  return `zoomed ${shown}×, drag to move`;
}

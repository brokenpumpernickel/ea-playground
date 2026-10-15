/**
 * Moving an overlay (the fitness graph, the information box) inside the figure it lies on. An overlay has its own place, set
 * by the layout, and an offset from it; the offset is held so that the whole overlay stays inside its host (and, on the route
 * map, below the toolbar). Pure arithmetic: the handle measures the page and asks.
 */
export interface Offset {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** An arrow key moves an overlay this far (design px); with Shift, five times as far. */
export const moveStep = 20;

/**
 * The offset held inside the host: `overlay` is the box the overlay has at no offset, `host` the size it must stay inside,
 * `clear` a band at the top of the host to keep free (the toolbar lying on the route map), between the horizontal positions
 * `from` and `to` when those are given: an overlay that is wholly to one side of the band may lie anywhere. An overlay larger
 * than its room is held at the top left of it.
 */
export function clampOffset(offset: Offset, overlay: Box, host: { readonly width: number; readonly height: number }, clear: { readonly top?: number; readonly from?: number; readonly to?: number } = {}): Offset {
  const minX = -overlay.left;
  const maxX = Math.max(minX, host.width - overlay.width - overlay.left);
  const x = Math.min(maxX, Math.max(minX, offset.x));
  const left = overlay.left + x;
  const underBand = clear.top !== undefined && left < (clear.to ?? Infinity) && left + overlay.width > (clear.from ?? -Infinity);
  const minY = underBand ? clear.top! - overlay.top : -overlay.top;
  const maxY = Math.max(minY, host.height - overlay.height - overlay.top);
  return { x, y: Math.min(maxY, Math.max(minY, offset.y)) };
}

/** The offset after a key on the handle, or nothing when the key is not one the handle uses. */
export function keyOffset(offset: Offset, key: string, shift: boolean): Offset | undefined {
  const step = shift ? moveStep * 5 : moveStep;
  switch (key) {
    case 'ArrowLeft':
      return { x: offset.x - step, y: offset.y };
    case 'ArrowRight':
      return { x: offset.x + step, y: offset.y };
    case 'ArrowUp':
      return { x: offset.x, y: offset.y - step };
    case 'ArrowDown':
      return { x: offset.x, y: offset.y + step };
    case 'Home':
      return { x: 0, y: 0 };
    default:
      return undefined;
  }
}

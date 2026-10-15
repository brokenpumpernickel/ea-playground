import { describe, expect, it } from 'vitest';
import { clampOffset, keyOffset, moveStep } from './overlay-drag';

// an overlay 440 × 196 whose own place (at no offset) is 58 from the left and 380 from the top of a host 892 × 620
const overlay = { left: 58, top: 380, width: 440, height: 196 };
const host = { width: 892, height: 620 };

describe('where an overlay may be moved to', () => {
  it('leaves an offset that keeps it inside the host alone', () => {
    expect(clampOffset({ x: 100, y: -200 }, overlay, host)).toEqual({ x: 100, y: -200 });
    expect(clampOffset({ x: 0, y: 0 }, overlay, host)).toEqual({ x: 0, y: 0 });
  });

  it('holds it inside the host in all four directions, however far it is dragged', () => {
    const far = (x: number, y: number) => clampOffset({ x, y }, overlay, host);
    // to the left edge: its left is then 0
    expect(far(-1e6, 0).x + overlay.left).toBe(0);
    // to the right edge: its right is then the host's width
    expect(far(1e6, 0).x + overlay.left + overlay.width).toBe(host.width);
    expect(far(0, -1e6).y + overlay.top).toBe(0);
    expect(far(0, 1e6).y + overlay.top + overlay.height).toBe(host.height);
    for (const [x, y] of [[1e6, 1e6], [-1e6, -1e6], [1e6, -1e6], [-1e6, 1e6]] as const) {
      const c = far(x, y);
      expect(c.x + overlay.left).toBeGreaterThanOrEqual(0);
      expect(c.x + overlay.left + overlay.width).toBeLessThanOrEqual(host.width);
      expect(c.y + overlay.top).toBeGreaterThanOrEqual(0);
      expect(c.y + overlay.top + overlay.height).toBeLessThanOrEqual(host.height);
    }
  });

  it('keeps a band clear at the top (the toolbar lying on the route map)', () => {
    const c = clampOffset({ x: 0, y: -1e6 }, overlay, host, { top: 64 });
    expect(c.y + overlay.top).toBe(64);
    expect(clampOffset({ x: 0, y: 5 }, overlay, host, { top: 64 }).y).toBe(5);
  });

  it('an overlay larger than its host is held at the host\'s top left, not thrown out of it', () => {
    const c = clampOffset({ x: 30, y: 30 }, { left: 10, top: 10, width: 1000, height: 700 }, host);
    expect(c.x + 10).toBe(0);
    expect(c.y + 10).toBe(0);
  });

  it('is not fooled by an overlay whose size grew since the offset was chosen: the same offset is pulled back in', () => {
    const grown = { ...overlay, height: 300 };
    const c = clampOffset({ x: 0, y: 150 }, grown, host);
    expect(c.y + grown.top + grown.height).toBeLessThanOrEqual(host.height);
  });
});

describe('moving by keys', () => {
  it('an arrow key moves it 20 px, with Shift 100 px, in the direction of the arrow; Home puts it back', () => {
    expect(moveStep).toBe(20);
    expect(keyOffset({ x: 0, y: 0 }, 'ArrowRight', false)).toEqual({ x: 20, y: 0 });
    expect(keyOffset({ x: 0, y: 0 }, 'ArrowLeft', false)).toEqual({ x: -20, y: 0 });
    expect(keyOffset({ x: 0, y: 0 }, 'ArrowDown', false)).toEqual({ x: 0, y: 20 });
    expect(keyOffset({ x: 0, y: 0 }, 'ArrowUp', true)).toEqual({ x: 0, y: -100 });
    expect(keyOffset({ x: 33, y: -44 }, 'Home', false)).toEqual({ x: 0, y: 0 });
    expect(keyOffset({ x: 0, y: 0 }, 'a', false)).toBeUndefined();
    expect(keyOffset({ x: 0, y: 0 }, 'Tab', false)).toBeUndefined();
  });
});

<script lang="ts">
  import { onMount } from 'svelte';
  import { clampOffset, keyOffset, type Offset } from './overlay-drag';

  /**
   * The handle that moves the overlay it sits in (an element of class `rmo`) inside the element it is positioned in: dragged with
   * the pointer, or moved by the arrow keys (20 px, Shift 100 px) while it has the focus, Home or a double-click putting the
   * overlay back. The offset is the parent's to keep and to apply (as a translation); the handle holds it inside the host and,
   * when the overlay grows or shrinks (a stage's longer text), pulls it back in.
   */
  let { label, testid, offset = $bindable({ x: 0, y: 0 }), clear = {} }: { label: string; testid: string; offset?: Offset; clear?: { top?: number; from?: number; to?: number } } = $props();

  let button: HTMLButtonElement | undefined = $state();
  const overlay = () => button!.closest('.rmo') as HTMLElement;
  /** The overlay's box at no offset, the host's size and the page's scale (the screen is drawn at 1920 × 1080 and scaled). */
  const room = () => {
    const el = overlay();
    const host = el.offsetParent as HTMLElement;
    return { box: { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }, host: { width: host.clientWidth, height: host.clientHeight }, scale: host.getBoundingClientRect().width / host.offsetWidth };
  };
  const hold = (wanted: Offset): Offset => {
    const r = room();
    return clampOffset(wanted, r.box, r.host, clear);
  };

  let from: { px: number; py: number; offset: Offset } | undefined;
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    from = { px: event.clientX, py: event.clientY, offset: { ...offset } };
    button!.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!from) return;
    const { scale } = room();
    offset = hold({ x: from.offset.x + (event.clientX - from.px) / scale, y: from.offset.y + (event.clientY - from.py) / scale });
  };
  const end = () => (from = undefined);
  const keydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = keyOffset(offset, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    offset = hold(next);
  };

  onMount(() => {
    const el = overlay();
    const watch = new ResizeObserver(() => {
      const held = hold(offset);
      if (held.x !== offset.x || held.y !== offset.y) offset = held;
    });
    watch.observe(el);
    return () => watch.disconnect();
  });
</script>

<button
  bind:this={button}
  class="tog move"
  type="button"
  aria-label="{label}. Drag it, or use the arrow keys; Home puts it back."
  title="Drag to move; double-click to put back"
  data-testid={testid}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={end}
  onpointercancel={end}
  onkeydown={keydown}
  ondblclick={() => (offset = { x: 0, y: 0 })}><span aria-hidden="true">⠿</span></button>

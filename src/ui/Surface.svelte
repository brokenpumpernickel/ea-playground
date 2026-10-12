<script lang="ts">
  import { drawSurface } from './surface-draw';
  import { defaultView, dragBy, rotate, type Rotation, type SurfaceView } from './surface-projection';
  import type { LandscapeInfo } from './landscape-context';

  /**
   * The surface of the landscape, in perspective, rotated by dragging, by the arrow keys while it is focused and by buttons
   * (left, right, up, down, reset), which sit in the landscape view's toolbar and turn the same bound view. The picture is described by the sentence under the landscape view; there is no animation:
   * every turn is shown at once, so reduced motion changes nothing here.
   */
  let { info, view = $bindable({ ...defaultView }), width = 520, height = 300 }: { info: LandscapeInfo; view?: SurfaceView; width?: number; height?: number } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (!canvas) return;
    void info.id;
    void view.az;
    void view.el;
    drawSurface(canvas, info, view);
  });

  const press = (action: Rotation) => (view = rotate(view, action));
  const keys: Record<string, Rotation> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  const keydown = (event: KeyboardEvent) => {
    const action = keys[event.key];
    if (!action || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    press(action);
  };

  // dragging: the surface follows the pointer
  let from: { x: number; y: number } | undefined;
  const down = (event: PointerEvent) => {
    from = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!from) return;
    view = dragBy(view, event.clientX - from.x, event.clientY - from.y);
    from = { x: event.clientX, y: event.clientY };
  };
  const up = () => (from = undefined);

</script>

<div class="surfwrap">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="surfpick"
    tabindex="0"
    role="group"
    aria-label="Surface of the same landscape. Rotate with the arrow keys or by dragging; the buttons do the same."
    data-testid="surface-focus"
    onkeydown={keydown}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  >
    <canvas
      bind:this={canvas}
      class="heat surf"
      {width}
      {height}
      aria-hidden="true"
      data-testid="surface"
      data-function={info.id}
      data-az={view.az}
      data-el={view.el}
    ></canvas>
  </div>
</div>

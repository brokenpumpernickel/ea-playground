<script lang="ts">
  import { canvasSize } from './landscape-canvas';
  import { drawSurface } from './surface-draw';
  import { layoutMarks, type DrawnMarks, type MarksModel } from './landscape-marks';
  import MarkerLayer from './MarkerLayer.svelte';
  import { defaultView, dragBy, isHidden, rasterise, rotate, surfaceMesh, type Rotation, type SurfaceView } from './surface-projection';
  import type { LandscapeInfo } from './landscape-context';

  /**
   * The surface of the landscape, in perspective, rotated by dragging, by the arrow keys while it is focused and by buttons
   * (left, right, up, down, reset), which sit in the landscape view's toolbar and turn the same bound view. The picture is described by the sentence under the landscape view; there is no animation:
   * every turn is shown at once, so reduced motion changes nothing here.
   */
  let {
    info,
    view = $bindable({ ...defaultView }),
    width = canvasSize.width,
    height = canvasSize.height,
    marks,
    selectedId,
    onselect,
  }: { info: LandscapeInfo; view?: SurfaceView; width?: number; height?: number; marks?: MarksModel | undefined; selectedId?: number | undefined; onselect?: (id: number | undefined) => void } = $props();

  const mesh = $derived(surfaceMesh(info, view, width, height));
  // the population stands on the surface at its fitness (a hair above it), and a mark behind a ridge is drawn as a dashed ring
  const empty: DrawnMarks = { individuals: [], children: [], trails: [] };
  const drawn = $derived.by(() => {
    if (!marks) return empty;
    const ids = rasterise(mesh);
    const lift = (mesh.fmax - mesh.fmin) * 0.012;
    const project = (p: { x: number; y: number }) => {
      const q = mesh.project(p.x, p.y, info.fitnessAt(p.x, p.y) + lift);
      return { px: q.sx, py: q.sy };
    };
    return layoutMarks(marks, {
      project,
      inside: (px, py) => px >= 0 && px <= width && py >= 0 && py <= height,
      hidden: (p) => {
        const q = project(p);
        return isHidden(mesh, ids, p, q.px, q.py);
      },
    });
  });

  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (!canvas) return;
    void info.id;
    drawSurface(canvas, info, mesh);
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

  // dragging: the surface follows the pointer once it has moved a few pixels; a click that does not move (on a marker) is left alone
  let from: { x: number; y: number } | undefined;
  let dragging = false;
  const down = (event: PointerEvent) => {
    from = { x: event.clientX, y: event.clientY };
    dragging = false;
  };
  const move = (event: PointerEvent) => {
    if (!from) return;
    if (!dragging) {
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) < 4) return;
      dragging = true;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }
    view = dragBy(view, event.clientX - from.x, event.clientY - from.y);
    from = { x: event.clientX, y: event.clientY };
  };
  const up = () => {
    from = undefined;
    dragging = false;
  };

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
    {#if marks}<MarkerLayer {drawn} {width} {height} {selectedId} {onselect} testid="surface-marks" />{/if}
  </div>
</div>

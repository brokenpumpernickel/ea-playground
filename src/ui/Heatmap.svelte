<script lang="ts">
  import { drawHeatmap, heatLayout, pixelOf } from './heatmap-draw';
  import { heatUnit, plotUnit } from './heat-zoom';
  import { panBy, wholeView, zoomAbout, zoomBy, type MapView } from './map-zoom';
  import { canvasSize } from './landscape-canvas';
  import { layoutMarks, type DrawnMarks, type MarksModel } from './landscape-marks';
  import MarkerLayer from './MarkerLayer.svelte';
  import { landscapeSentence, type Region } from './landscape-grid';
  import type { LandscapeInfo } from './landscape-context';

  /**
   * The heatmap of fitness over a region, drawn on a canvas from the grid model (see `heatmap-draw.ts`). It is redrawn when the
   * function or the region changes, not when the run steps, so stepping stays light. The picture is described by a sentence
   * (the canvas's name and the text under the view) because colour alone cannot say it; the isolines carry the levels as numbers.
   */
  let {
    info,
    region,
    zoomed = false,
    width = canvasSize.width,
    height = canvasSize.height,
    marks,
    selectedId,
    onselect,
    view,
    onview,
  }: { info: LandscapeInfo; region: Region; zoomed?: boolean; width?: number; height?: number; marks?: MarksModel | undefined; selectedId?: number | undefined; onselect?: (id: number | undefined) => void; view?: MapView | undefined; onview?: (view: MapView) => void } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  const layout = $derived(heatLayout(width, height));
  const sentence = $derived(landscapeSentence(info, region, zoomed));
  // the population over the picture, at the pixels the heatmap gave those points; nothing is drawn outside the plot
  const empty: DrawnMarks = { individuals: [], children: [], trails: [] };
  const drawn = $derived.by(() => {
    if (!marks) return empty;
    const pw = Math.round(layout.R - layout.L);
    const ph = Math.round(layout.B - layout.T);
    return layoutMarks(marks, {
      project: (p) => pixelOf(layout, region, p.x, p.y),
      inside: (px, py) => px >= layout.L - 0.5 && px <= layout.L + pw - 0.5 && py >= layout.T - 0.5 && py <= layout.T + ph - 0.5,
    });
  });

  // the wheel zooms about the pointer, a drag moves the picture, a double-click returns to the region the buttons chose; the view is
  // in units of the plot (see heat-zoom.ts), so it means the same part of the picture at any size
  const current = $derived(view ?? wholeView(heatUnit));
  const unitAt = (clientX: number, clientY: number): [number, number] => {
    const r = canvas!.getBoundingClientRect();
    const k = r.width / canvas!.offsetWidth;
    return plotUnit(layout, (clientX - r.left) / k - canvas!.clientLeft, (clientY - r.top) / k - canvas!.clientTop);
  };
  const wheel = (wrap: HTMLElement) => {
    const on = (event: WheelEvent) => {
      if (!canvas || !onview) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      onview(zoomAbout(current, heatUnit, Math.exp(-event.deltaY * unit * 0.002), unitAt(event.clientX, event.clientY)));
    };
    wrap.addEventListener('wheel', on, { passive: false });
    return () => wrap.removeEventListener('wheel', on);
  };
  let from: { x: number; y: number } | undefined;
  let dragging = false;
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    from = { x: event.clientX, y: event.clientY };
    dragging = false;
  };
  const move = (event: PointerEvent) => {
    if (!from || !canvas || !onview) return;
    if (!dragging) {
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) < 4) return;
      dragging = true;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }
    const a = unitAt(from.x, from.y);
    const b = unitAt(event.clientX, event.clientY);
    from = { x: event.clientX, y: event.clientY };
    onview(panBy(current, heatUnit, b[0] - a[0], b[1] - a[1]));
  };
  const end = () => {
    from = undefined;
    dragging = false;
  };
  const step = 60;
  // before the marks see the key: + − 0 zoom and reset, Shift and the arrows move the picture while it is zoomed (the plain arrows select individuals)
  const keydown = (event: KeyboardEvent) => {
    if (!onview || event.altKey || event.ctrlKey || event.metaKey) return;
    const pans: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    let next: MapView | undefined;
    if (event.key === '+' || event.key === '=') next = zoomBy(current, heatUnit, 1.25);
    else if (event.key === '-' || event.key === '_') next = zoomBy(current, heatUnit, 1 / 1.25);
    else if (event.key === '0') next = wholeView(heatUnit);
    else if (event.shiftKey && pans[event.key] && view) next = panBy(current, heatUnit, ...pans[event.key]!);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    onview(next);
  };

  $effect(() => {
    if (!canvas) return;
    // reading these makes the effect rerun when the function or the region changes
    void info.id;
    void region.x0;
    void region.x1;
    void region.y0;
    void region.y1;
    drawHeatmap(canvas, info, region);
  });
</script>

<div class="heatwrap" class:zoomed={view !== undefined} role="img" aria-label={sentence} {@attach wheel} onpointerdown={down} onpointermove={move} onpointerup={end} onpointercancel={end} ondblclick={() => onview?.(wholeView(heatUnit))} onkeydowncapture={keydown}>
  <canvas
    bind:this={canvas}
    class="heat"
    {width}
    {height}
    aria-hidden="true"
    data-testid="heatmap"
    data-function={info.id}
    data-zoom={current.zoom}
    data-region={`${region.x0},${region.x1},${region.y0},${region.y1}`}
    data-plot={`${layout.L},${layout.T},${layout.R},${layout.B}`}
  ></canvas>
  {#if marks}<MarkerLayer {drawn} {width} {height} {selectedId} {onselect} keyboard keyLabel="Individuals on the heatmap. Left and right arrows select the previous or next individual, Escape clears the selection." testid="heat-marks" />{/if}
</div>

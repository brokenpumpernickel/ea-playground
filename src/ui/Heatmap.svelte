<script lang="ts">
  import { drawHeatmap, heatLayout, pixelOf } from './heatmap-draw';
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
  }: { info: LandscapeInfo; region: Region; zoomed?: boolean; width?: number; height?: number; marks?: MarksModel | undefined; selectedId?: number | undefined; onselect?: (id: number | undefined) => void } = $props();

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

<div class="heatwrap" role="img" aria-label={sentence}>
  <canvas
    bind:this={canvas}
    class="heat"
    {width}
    {height}
    aria-hidden="true"
    data-testid="heatmap"
    data-function={info.id}
    data-region={`${region.x0},${region.x1},${region.y0},${region.y1}`}
    data-plot={`${layout.L},${layout.T},${layout.R},${layout.B}`}
  ></canvas>
  {#if marks}<MarkerLayer {drawn} {width} {height} {selectedId} {onselect} keyboard keyLabel="Individuals on the heatmap. Left and right arrows select the previous or next individual, Escape clears the selection." testid="heat-marks" />{/if}
</div>

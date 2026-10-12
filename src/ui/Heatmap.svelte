<script lang="ts">
  import { drawHeatmap, heatLayout } from './heatmap-draw';
  import { landscapeSentence, type Region } from './landscape-grid';
  import type { LandscapeInfo } from './landscape-context';

  /**
   * The heatmap of fitness over a region, drawn on a canvas from the grid model (see `heatmap-draw.ts`). It is redrawn when the
   * function or the region changes, not when the run steps, so stepping stays light. The picture is described by a sentence
   * (the canvas's name and the text under the view) because colour alone cannot say it; the isolines carry the levels as numbers.
   */
  let { info, region, zoomed = false, width = 520, height = 300 }: { info: LandscapeInfo; region: Region; zoomed?: boolean; width?: number; height?: number } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  const layout = $derived(heatLayout(width, height));
  const sentence = $derived(landscapeSentence(info, region, zoomed));

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
</div>

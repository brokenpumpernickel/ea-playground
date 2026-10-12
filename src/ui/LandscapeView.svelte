<script lang="ts">
  import Heatmap from './Heatmap.svelte';
  import { landscapeSentence, zoomRegion } from './landscape-grid';
  import type { Session } from './session.svelte';

  /**
   * The stage panel's second view for a landscape: the heatmap of fitness (and, in later tickets, the surface and the
   * population on both). "Zoom to population" rescales the heatmap to the box the population occupies plus a margin, with
   * the axes relabelled, so a tight cluster can be read; it is a view setting, off by default.
   */
  let { session, zoom = $bindable(false) }: { session: Session; zoom?: boolean } = $props();

  const info = $derived(session.landscape);
  const points = $derived(session.table.rows.flatMap((r) => (r.values ? [{ x: r.values[0]!, y: r.values[1]! }] : [])));
  const whole = $derived(info ? { x0: info.bounds.lo, x1: info.bounds.hi, y0: info.bounds.lo, y1: info.bounds.hi } : undefined);
  const region = $derived(info && whole ? (zoom ? zoomRegion(points, info.bounds) : whole) : undefined);
  const sentence = $derived(info && region ? landscapeSentence(info, region, zoom) : '');
</script>

{#if info && region}
  <div class="lview" data-testid="landscape-view">
    <div class="lbar">
      <span class="lgrp">
        <button class="tog" class:on={zoom} type="button" aria-pressed={zoom} data-testid="zoom-toggle" onclick={() => (zoom = !zoom)}>Zoom to population</button>
      </span>
      <span class="lgrp key">{zoom ? 'Axes show the box the population occupies, plus a margin.' : `Axes show the whole landscape, ${info.bounds.lo} to ${info.bounds.hi}.`}</span>
    </div>
    <div class="lplots">
      <figure>
        <figcaption>Heatmap <i>fitness{info.minimised ? ' = −f' : ' = f'}, higher is better</i></figcaption>
        <Heatmap {info} {region} zoomed={zoom} />
      </figure>
    </div>
    <p class="lsent" data-testid="landscape-sentence">{sentence}</p>
  </div>
{/if}

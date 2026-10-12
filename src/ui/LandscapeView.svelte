<script lang="ts">
  import Heatmap from './Heatmap.svelte';
  import Surface from './Surface.svelte';
  import { defaultView, rotate, type Rotation, type SurfaceView } from './surface-projection';
  import { landscapeSentence, zoomRegion } from './landscape-grid';
  import type { Session } from './session.svelte';

  /**
   * The stage panel's second view for a landscape: the heatmap of fitness (and, in later tickets, the surface and the
   * population on both). "Zoom to population" rescales the heatmap to the box the population occupies plus a margin, with
   * the axes relabelled, so a tight cluster can be read; it is a view setting, off by default.
   */
  let { session, zoom = $bindable(false), surface = $bindable({ ...defaultView }) }: { session: Session; zoom?: boolean; surface?: SurfaceView } = $props();
  const buttons: { action: Rotation; label: string; text: string }[] = [
    { action: 'left', label: 'Rotate the surface left', text: '◀' },
    { action: 'right', label: 'Rotate the surface right', text: '▶' },
    { action: 'up', label: 'Tilt the surface up', text: '▲' },
    { action: 'down', label: 'Tilt the surface down', text: '▼' },
    { action: 'reset', label: 'Reset the view of the surface', text: 'reset' },
  ];

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
      <span class="lgrp" role="group" aria-label="Rotate the surface">
        <b class="rl">Rotate surface</b>
        {#each buttons as b (b.action)}
          <button class="tog" type="button" aria-label={b.label} data-testid="rotate-{b.action}" onclick={() => (surface = rotate(surface, b.action))}><span aria-hidden="true">{b.text}</span></button>
        {/each}
      </span>
      <span class="lgrp key">{zoom ? 'Axes show the box the population occupies, plus a margin.' : `Axes show the whole landscape, ${info.bounds.lo} to ${info.bounds.hi}.`}</span>
    </div>
    <div class="lplots">
      <figure>
        <figcaption>Heatmap <i>fitness{info.minimised ? ' = −f' : ' = f'}, higher is better</i></figcaption>
        <Heatmap {info} {region} zoomed={zoom} />
      </figure>
      <figure>
        <figcaption>Surface of the same landscape <i>(drag, or use the arrow keys)</i></figcaption>
        <Surface {info} bind:view={surface} />
      </figure>
    </div>
    <p class="lsent" data-testid="landscape-sentence">{sentence}</p>
  </div>
{/if}

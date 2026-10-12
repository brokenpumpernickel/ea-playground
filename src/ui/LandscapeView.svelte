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
  let { session, zoom = $bindable(false), surface = $bindable({ ...defaultView }), trail = $bindable(0) }: { session: Session; zoom?: boolean; surface?: SurfaceView; trail?: 0 | 1 | 3 | 5 } = $props();
  const trails: { value: 0 | 1 | 3 | 5; text: string }[] = [
    { value: 0, text: 'off' },
    { value: 1, text: '1 gen' },
    { value: 3, text: '3 gens' },
    { value: 5, text: '5 gens' },
  ];
  const marks = $derived(session.landscapeMarks(trail));
  const select = (id: number | undefined) => session.selectIndividual(id === session.selectedId ? undefined : id);
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
      <span class="lgrp" role="group" aria-label="Trails: earlier generations as fading dots">
        <b class="rl">Trails</b>
        {#each trails as t (t.value)}
          <button class="tog" class:on={trail === t.value} type="button" aria-pressed={trail === t.value} data-testid="trail-{t.value}" onclick={() => (trail = t.value)}>{t.text}</button>
        {/each}
      </span>
      <span class="lgrp" role="group" aria-label="Rotate the surface">
        <b class="rl">Rotate surface</b>
        {#each buttons as b (b.action)}
          <button class="tog" type="button" aria-label={b.label} data-testid="rotate-{b.action}" onclick={() => (surface = rotate(surface, b.action))}><span aria-hidden="true">{b.text}</span></button>
        {/each}
      </span>
    </div>
    <div class="lplots">
      <figure>
        <figcaption>Heatmap <i>fitness{info.minimised ? ' = −f' : ' = f'}, higher is better</i></figcaption>
        <Heatmap {info} {region} zoomed={zoom} {marks} selectedId={session.selectedId} onselect={select} />
      </figure>
      <figure>
        <figcaption>Surface of the same landscape <i>(drag, or use the arrow keys)</i></figcaption>
        <Surface {info} bind:view={surface} {marks} selectedId={session.selectedId} onselect={select} />
      </figure>
    </div>
    <p class="lkey" aria-hidden="true">● individual · ◆ elite · ★ best · ▢ parent (A, B) · ▲ offspring · ╌ ring = hidden behind a ridge · ◉ selected (click a mark or a table row)</p>
    <p class="lsent"><span data-testid="landscape-sentence">{sentence}</span>{#if marks}{' '}<span data-testid="population-sentence">{marks.sentence}</span>{/if}</p>
    {#if marks}
      <table class="sr-only" aria-label="Positions of the individuals" data-testid="positions-table">
        <thead><tr><th scope="col">Individual</th><th scope="col">x</th><th scope="col">y</th><th scope="col">Fitness</th><th scope="col">Role</th></tr></thead>
        <tbody>
          {#each marks.table as row (row.id)}
            <tr><th scope="row">{row.id}</th><td>{row.x.toFixed(3)}</td><td>{row.y.toFixed(3)}</td><td>{row.fitness.toFixed(3)}</td><td>{row.role}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

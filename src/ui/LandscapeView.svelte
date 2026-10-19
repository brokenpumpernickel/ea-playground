<script lang="ts">
  import { getContext } from 'svelte';
  import { focusContextKey, type FocusView } from './focus-view.svelte';
  import Heatmap from './Heatmap.svelte';
  import { heatUnit, subRegion } from './heat-zoom';
  import MiniFitness from './MiniFitness.svelte';
  import MoveHandle from './MoveHandle.svelte';
  import type { Offset } from './overlay-drag';
  import { canvasSize } from './landscape-canvas';
  import { maxZoom, minZoom, wholeView, zoomBy, type MapView } from './map-zoom';
  import { statsLines } from './spread-model';
  import Surface from './Surface.svelte';
  import { defaultView, rotate, surfaceZoom, surfaceZoomLimits, type Rotation, type SurfaceView } from './surface-projection';
  import { landscapeSentence, zoomRegion } from './landscape-grid';
  import type { Session } from './session.svelte';

  /**
   * The stage panel's second view for a landscape: the heatmap of fitness and the surface, with the population on both. "Zoom to
   * population" rescales the heatmap to the box the population occupies plus a margin, with the axes relabelled, so a tight
   * cluster can be read; the wheel and a drag zoom and move the heatmap within that (or within the whole landscape), the wheel
   * brings the surface's camera closer. These are view settings, off by default. In the focus view the two figures take the
   * whole centre of the screen, with the toolbar, the figures card and the fitness graph laid over its corners.
   */
  let {
    session,
    zoom = $bindable(false),
    surface = $bindable({ ...defaultView }),
    trail = $bindable(0),
    heatView = $bindable(undefined),
    showGraph = $bindable(true),
    showCard = $bindable(true),
    graphPos = $bindable({ x: 0, y: 0 }),
    cardPos = $bindable({ x: 0, y: 0 }),
  }: { session: Session; zoom?: boolean; surface?: SurfaceView; trail?: 0 | 1 | 3 | 5; heatView?: MapView | undefined; showGraph?: boolean; showCard?: boolean; graphPos?: Offset; cardPos?: Offset } = $props();
  const trails: { value: 0 | 1 | 3 | 5; text: string }[] = [
    { value: 0, text: 'off' },
    { value: 1, text: '1 gen' },
    { value: 3, text: '3 gens' },
    { value: 5, text: '5 gens' },
  ];
  const focus = getContext<FocusView | undefined>(focusContextKey);
  const focused = $derived(focus?.active === true);
  /** The size of each of the two canvases: in the focus view they fill the height of the body below the toolbar and half its width each; the graph lies on the heatmap and the information box on the surface. */
  const figure = $derived(focused ? { width: 892, height: 620 } : { width: canvasSize.width, height: canvasSize.height });
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
  /** The region before the wheel: the whole landscape, or the population's box. */
  const base = $derived(info && whole ? (zoom ? zoomRegion(points, info.bounds) : whole) : undefined);
  const region = $derived(base ? (heatView ? subRegion(base, heatView) : base) : undefined);
  const zoomedIn = $derived(zoom || heatView !== undefined);
  const sentence = $derived(info && region ? landscapeSentence(info, region, zoomedIn, zoom ? 'Zoomed to the population' : 'Zoomed in') : '');

  const heatZoomed = $derived(heatView !== undefined);
  const surfaceZoomed = $derived((surface.zoom ?? 1) > surfaceZoomLimits.min + 1e-9);
  const dirty = $derived(zoom || heatZoomed || surfaceZoomed || surface.az !== defaultView.az || surface.el !== defaultView.el);
  const setHeat = (next: MapView) => (heatView = next.zoom <= minZoom + 1e-9 ? undefined : next);
  /** + and − act on both figures: the heatmap's window and the surface's camera. */
  const zoomBoth = (factor: number) => {
    setHeat(zoomBy(heatView ?? wholeView(heatUnit), heatUnit, factor));
    surface = surfaceZoom(surface, factor);
  };
  const resetView = () => {
    zoom = false;
    heatView = undefined;
    surface = { ...defaultView };
  };
  // fitness sharing: the selected individual's niche, a ring of radius σ on the heatmap
  const cursorParams = $derived(session.run.snapshot(session.view.position.cycle).params);
  const sharingSigma = $derived(cursorParams.niching?.method === 'sharing' ? cursorParams.niching.sigma : undefined);
  const selectedPoint = $derived(session.selectedId === undefined ? undefined : session.table.rows.find((r) => r.id === session.selectedId)?.values);
  const ring = $derived(sharingSigma !== undefined && selectedPoint && session.selectedId !== undefined ? { x: selectedPoint[0]!, y: selectedPoint[1]!, sigma: sharingSigma, id: session.selectedId } : undefined);
  const m = $derived(session.metrics);
  const lines = $derived(statsLines(m));
  const goal = $derived(info?.minimised ? 'f is minimised, so fitness = −f and higher is always better' : 'f is maximised, higher is better');
</script>

{#snippet toolbar()}
  <div class="lbar">
    <span class="lgrp">
      <button class="tog" class:on={zoom} type="button" aria-pressed={zoom} data-testid="zoom-toggle" onclick={() => (zoom = !zoom)}>Zoom to population</button>
    </span>
    {#if focused}
      <span class="lgrp">
        <button class="tog" type="button" data-testid="zoom-in" aria-label="Zoom in" disabled={(heatView?.zoom ?? 1) >= maxZoom && (surface.zoom ?? 1) >= surfaceZoomLimits.max} onclick={() => zoomBoth(1.25)}>+</button>
        <button class="tog" type="button" data-testid="zoom-out" aria-label="Zoom out" disabled={!heatZoomed && !surfaceZoomed} onclick={() => zoomBoth(1 / 1.25)}>−</button>
        <button class="tog" type="button" data-testid="reset-view" disabled={!dirty} onclick={resetView}>Reset view</button>
      </span>
    {/if}
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
    {#if focused}
      <span class="lgrp">
        <button class="tog" class:on={showGraph} type="button" aria-pressed={showGraph} data-testid="toggle-graph" onclick={() => (showGraph = !showGraph)}><span aria-hidden="true">{showGraph ? '✓ ' : ''}</span>Graph</button>
        <button class="tog" class:on={showCard} type="button" aria-pressed={showCard} data-testid="toggle-card" onclick={() => (showCard = !showCard)}><span aria-hidden="true">{showCard ? '✓ ' : ''}</span>Info</button>
      </span>
    {/if}
    <span class="lgrp expand">
      <button class="tog" type="button" data-testid="focus-toggle" aria-keyshortcuts="E" onclick={() => focus?.toggle()}>{focused ? 'Back to the panels' : 'Expand'} <kbd aria-hidden="true">E</kbd></button>
    </span>
  </div>
{/snippet}

{#snippet figures()}
  <div class="lplots">
    <figure>
      <figcaption>Heatmap <i>fitness{info!.minimised ? ' = −f' : ' = f'}, higher is better</i></figcaption>
      <div class="lcanvas">
        <Heatmap info={info!} region={region!} zoomed={zoomedIn} width={figure.width} height={figure.height} {marks} selectedId={session.selectedId} onselect={select} view={heatView} onview={setHeat} {ring} />
        {#if focused && showGraph}<div class="rmo rmo-graph lover lover-graph" data-testid="focus-graph" style="transform:translate({graphPos.x}px,{graphPos.y}px)"><MiniFitness model={session.plots} onhide={() => (showGraph = false)} bind:offset={graphPos} /></div>{/if}
      </div>
    </figure>
    <figure>
      <figcaption>Surface of the same landscape <i>(drag, or use the arrow keys; the wheel zooms)</i></figcaption>
      <div class="lcanvas">
        <Surface info={info!} bind:view={surface} width={figure.width} height={figure.height} {marks} selectedId={session.selectedId} onselect={select} />
        {#if focused && showCard}
          <div class="rmo rmo-card lover lover-card" data-testid="focus-card" style="transform:translate({cardPos.x}px,{cardPos.y}px)">
            <div class="lcard-head"><MoveHandle label="Move the information box" testid="move-card" bind:offset={cardPos} /><button class="tog" type="button" aria-label="Hide the information box" data-testid="hide-card" onclick={() => (showCard = false)}><span aria-hidden="true">×</span> hide</button></div>
            <p class="lcard-line">{lines[0]}</p>
            <p class="lcard-line">{lines[1]}</p>
            <p class="lcard-fn"><b>{info!.name}</b> · {goal}</p>
            {@render keyLine()}
          </div>
        {/if}
      </div>
    </figure>
  </div>
{/snippet}

{#snippet keyLine()}
  <p class="lkey" aria-hidden="true" data-testid="landscape-key">● individual · ◆ elite · ★ best · ▢ parent (A, B) · ▲ offspring · ╌ ring = hidden behind a ridge · ◉ selected (click a mark or a table row)</p>
{/snippet}

{#snippet sentences()}
  <p class="lsent"><span data-testid="landscape-sentence">{sentence}</span>{#if marks}{' '}<span data-testid="population-sentence">{marks.sentence}</span>{/if}{#if ring}{' '}<span data-testid="ring-sentence">The dashed ring round individual {ring.id} has the radius of the niche, σ = {ring.sigma}: individuals inside it share their fitness, each counting less the farther from {ring.id} it is.</span>{/if}</p>
{/snippet}

{#snippet positions()}
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
{/snippet}

{#if info && region}
  {#if focused}
    <div class="lview lfocus" data-testid="landscape-view">
      {@render figures()}
      <div class="rmo rmo-bar" data-testid="focus-toolbar">{@render toolbar()}</div>
      <div class="sr-only">{@render sentences()}</div>
      {@render positions()}
    </div>
  {:else}
    <div class="lview" data-testid="landscape-view">
      {@render toolbar()}
      {@render figures()}
      {@render keyLine()}
      {@render sentences()}
      {@render positions()}
    </div>
  {/if}
{/if}

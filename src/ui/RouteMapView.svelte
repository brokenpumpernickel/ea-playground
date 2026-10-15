<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import type { CrossoverEvent, MutationEvent } from '../engine';
  import { focusContextKey, type FocusView } from './focus-view.svelte';
  import MiniFitness from './MiniFitness.svelte';
  import { cityNumberSize, clampView, labelPlacement, maxZoom, minZoom, panBy, toScreen, visibleCity, wholeView, zoomAbout, zoomBy, zoomNote, type MapView } from './map-zoom';
  import { focusMap, freeBoxFor, routeMapModel, type RouteMapInput, type Size } from './route-map-model';
  import type { Session } from './session.svelte';

  /**
   * The stage panel's second view for a TSP run: the cities as numbered dots, the population's edges (thicker where more
   * individuals use them), the best tour of the generation, the selected individual's tour and, on request, the optimal
   * tour; while crossover or mutation is stepped, the child's edges by origin or the edges a mutation took out and put in.
   * Every line is a `<line>` carrying its two cities, its layer and its count, so a test reads what is drawn.
   */
  let { session, showPopulation = $bindable(true), showOptimal = $bindable(false), showNumbers = $bindable(true), showGraph = $bindable(true), zoom = $bindable(undefined) }: { session: Session; showPopulation?: boolean; showOptimal?: boolean; showNumbers?: boolean; showGraph?: boolean; zoom?: MapView | undefined } = $props();

  const focus = getContext<FocusView | undefined>(focusContextKey);
  const focused = $derived(focus?.active === true);
  /** The picture's own size: the panel's, or, in the focus view, what is left of the whole area beside the figures. */
  const size = $derived<Size>(focused ? focusMap.picture : { width: 740, height: 292 });
  // the zoomed part of the picture stays the same part of it when the picture changes size
  let lastSize = untrack(() => size);
  $effect.pre(() => {
    const now = size;
    if (now.width === lastSize.width && now.height === lastSize.height) return;
    const before = lastSize;
    lastSize = now;
    if (zoom) zoom = clampView({ zoom: zoom.zoom, cx: (zoom.cx * now.width) / before.width, cy: (zoom.cy * now.height) / before.height }, now);
  });
  const info = $derived(session.tour);
  const view = $derived(session.view);
  const metrics = $derived(session.metrics);

  const mark = $derived.by((): RouteMapInput['mark'] => {
    if (view.stage === 'crossover') {
      const last = view.events.filter((e): e is CrossoverEvent => e.stage === 'crossover').at(-1);
      if (!last || !view.before) return undefined;
      const arrays = new Map(view.before.population.map((i) => [i.id, i.chromosome]));
      return { kind: 'crossover', event: last, parentA: arrays.get(last.parentAId)!, parentB: arrays.get(last.parentBId)! };
    }
    if (view.stage === 'mutation') {
      const last = view.events.filter((e): e is MutationEvent => e.stage === 'mutation').at(-1);
      return last ? { kind: 'mutation', event: last } : undefined;
    }
    return undefined;
  });

  const model = $derived(
    info
      ? routeMapModel({
          info,
          size,
          ...(focused ? { free: freeBoxFor(info.places) } : {}),
          tours: session.table.rows.map((r) => ({ id: r.id, tour: r.chromosome.split(' ').map((c) => Number(c) - 1), fitness: r.fitness })),
          ...(session.selectedId !== undefined ? { selectedId: session.selectedId } : {}),
          showPopulation,
          showOptimal,
          generation: metrics.generation,
          bestSoFar: metrics.bestSoFar,
          ...(mark ? { mark } : {}),
        })
      : undefined,
  );

  const layers = ['population', 'optimal', 'unchanged', 'child', 'added', 'removed', 'best', 'selected'] as const;
  // the view of the picture: a zoom and a place, kept by the stage panel (undefined is the whole map)
  const current = $derived(zoom ?? wholeView(size));
  const labelSize = $derived(info ? cityNumberSize(info.cities, current.zoom, showNumbers) : 0);
  /** Where each city lies in the window; a zoomed picture moves the places apart and leaves the marks their size. */
  const at = $derived(model ? model.nodes.map((n) => toScreen(current, size, [n.x, n.y])) : []);
  const dotReach = 9;
  const zoomed = $derived(current.zoom > minZoom + 1e-9);
  const zoomText = $derived(zoomed ? `Zoomed ${Math.round(current.zoom * 10) / 10}×: a part of the map is shown.` : '');
  const setView = (next: MapView) => (zoom = next.zoom <= minZoom + 1e-9 ? undefined : next);

  let svgEl: SVGSVGElement | undefined = $state();
  /** A pointer position in the picture's own coordinates (the viewBox), whatever the page's scale. */
  const toPicture = (clientX: number, clientY: number): [number, number] => {
    const p = svgEl!.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const q = p.matrixTransform(svgEl!.getScreenCTM()!.inverse());
    return [q.x, q.y];
  };
  const wheel = (frame: HTMLElement) => {
    const on = (event: WheelEvent) => {
      if (!svgEl) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      setView(zoomAbout(current, size, Math.exp(-event.deltaY * unit * 0.002), toPicture(event.clientX, event.clientY)));
    };
    frame.addEventListener('wheel', on, { passive: false });
    return () => frame.removeEventListener('wheel', on);
  };
  let drag: { x: number; y: number } | undefined;
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY };
    svgEl?.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!drag || !svgEl) return;
    const a = toPicture(drag.x, drag.y);
    const b = toPicture(event.clientX, event.clientY);
    drag = { x: event.clientX, y: event.clientY };
    setView(panBy(current, size, b[0] - a[0], b[1] - a[1]));
  };
  const end = () => (drag = undefined);
  const step = 40;
  const keydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const pans: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    let next: MapView | undefined;
    if (event.key === '+' || event.key === '=') next = zoomBy(current, size, 1.25);
    else if (event.key === '-' || event.key === '_') next = zoomBy(current, size, 1 / 1.25);
    else if (event.key === '0') next = wholeView(size);
    else if (pans[event.key] && zoomed) next = panBy(current, size, ...pans[event.key]!);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setView(next);
  };
  const geo = $derived(info?.instance.rule === 'GEO');
  const mid = (a: number, b: number) => ({ x: (at[a]![0] + at[b]![0]) / 2, y: (at[a]![1] + at[b]![1]) / 2 });
  const sentence = $derived(model ? `${model.sentence}${zoomText ? ` ${zoomText}` : ''}` : '');
  const label = $derived(model ? `${sentence}${model.mark ? ` ${model.mark.sentence}` : ''}` : '');
</script>

{#snippet toolbar()}
  <div class="lbar">
    <span class="lgrp">
      <button class="tog" class:on={showPopulation} type="button" aria-pressed={showPopulation} data-testid="toggle-population" onclick={() => (showPopulation = !showPopulation)}><span aria-hidden="true">{showPopulation ? '✓ ' : ''}</span>Population’s edges</button>
      <button class="tog" class:on={showNumbers} type="button" aria-pressed={showNumbers} data-testid="toggle-numbers" onclick={() => (showNumbers = !showNumbers)}><span aria-hidden="true">{showNumbers ? '✓ ' : ''}</span>City numbers</button>
      <button class="tog" class:on={showOptimal} type="button" aria-pressed={showOptimal} data-testid="toggle-optimal" onclick={() => (showOptimal = !showOptimal)}><span aria-hidden="true">{showOptimal ? '✓ ' : ''}</span>Optimal tour</button>
    </span>
    <span class="lgrp">
      <label for="map-select" class="rl">Selected tour</label>
      <select id="map-select" data-testid="map-select" value={session.selectedId === undefined ? '' : String(session.selectedId)} onchange={(e) => session.selectIndividual(e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}>
        <option value="">none</option>
        {#each session.table.rows as row (row.id)}<option value={String(row.id)}>individual {row.id}{row.elite ? ' (elite)' : ''} · {row.cells[0]}</option>{/each}
      </select>
    </span>
    <span class="lgrp">
      <button class="tog" type="button" data-testid="zoom-in" aria-label="Zoom in" disabled={current.zoom >= maxZoom} onclick={() => setView(zoomBy(current, size, 1.25))}>+</button>
      <button class="tog" type="button" data-testid="zoom-out" aria-label="Zoom out" disabled={!zoomed} onclick={() => setView(zoomBy(current, size, 1 / 1.25))}>−</button>
      <button class="tog" type="button" data-testid="reset-view" disabled={!zoomed} onclick={() => (zoom = undefined)}>Reset view</button>
    </span>
    {#if focused}
      <span class="lgrp">
        <button class="tog" class:on={showGraph} type="button" aria-pressed={showGraph} data-testid="toggle-graph" onclick={() => (showGraph = !showGraph)}><span aria-hidden="true">{showGraph ? '✓ ' : ''}</span>Graph</button>
      </span>
    {/if}
    <span class="lgrp expand">
      <button class="tog" type="button" data-testid="focus-toggle" aria-keyshortcuts="E" onclick={() => focus?.toggle()}>{focused ? 'Back to the panels' : 'Expand'} <kbd aria-hidden="true">E</kbd></button>
    </span>
  </div>
{/snippet}

{#snippet mapFrame()}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div class="rmframe" tabindex="0" role="group" aria-label="Route map. Zoom with the wheel, the plus and minus keys or the buttons; drag or use the arrow keys to move the picture; double-click or 0 resets the view." data-testid="route-map-frame" onkeydown={keydown} {@attach wheel}>
    <svg bind:this={svgEl} class="rmmap" class:zoomed viewBox={`0 0 ${size.width} ${size.height}`} width={size.width} height={size.height} role="img" aria-label={label} data-testid="route-map" data-bestid={model!.bestId} data-zoom={current.zoom} data-cx={current.cx} data-cy={current.cy} onpointerdown={down} onpointermove={move} onpointerup={end} onpointercancel={end} ondblclick={() => (zoom = undefined)}>
      {#each layers as layer (layer)}
        {@const group = model!.edges.filter((e) => e.layer === layer)}
        {#if group.length > 0}
          <g class="re re-{layer}" class:dim={layer === 'population' && model!.dimPopulation} data-layer={layer}>
            {#each group as e (e.key)}
              {@const p = at[e.a]!}
              {@const q = at[e.b]!}
              <line class="origin-{e.origin ?? 'none'}" x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} data-edge={e.key} data-layer={layer} data-count={e.count} data-origin={e.origin} style={e.count !== undefined ? `stroke-width:${e.width}` : undefined} />
              {#if layer === 'removed' && visibleCity([mid(e.a, e.b).x, mid(e.a, e.b).y], size, 12)}<text class="cross" x={mid(e.a, e.b).x} y={mid(e.a, e.b).y} text-anchor="middle" dominant-baseline="central" aria-hidden="true">✕</text>{/if}
            {/each}
          </g>
        {/if}
      {/each}
      <g class="rn">
        {#each model!.nodes as node (node.city)}
          {@const p = at[node.city]!}
          {#if visibleCity(p, size, dotReach)}
            <circle class="city" class:ringed={node.ringed} cx={p[0]} cy={p[1]} r={node.ringed ? 9 : 6} data-city={node.city + 1} data-ringed={node.ringed ? 'true' : undefined} />
            {#if labelSize > 0}
              {@const place = labelPlacement(p[0], p[1], String(node.city + 1), labelSize, size)}
              <text class="cl" x={place.x} y={place.y} text-anchor={place.anchor} style="font-size:{labelSize}px" data-size={labelSize} aria-hidden="true" data-label={node.city + 1}>{node.city + 1}</text>
            {/if}
          {/if}
        {/each}
      </g>
      <text class="axes" x={size.width - 8} y={size.height - 7} text-anchor="end" aria-hidden="true">{geo ? 'longitude → · latitude ↑' : 'x → · y ↑'}{zoomed ? ` · ${zoomNote(current.zoom)}` : ''}</text>
    </svg>
  </div>
{/snippet}

{#snippet figures()}
  <table class="atab st rmstats" aria-label="Lengths of this generation and of the two baselines">
    <caption>Generation {metrics.generation}</caption>
    <tbody>
      <tr><th scope="row">best now</th><td class="num" data-testid="stat-best-now">{model!.stats.bestNow.length}</td><td class="num gap">{model!.stats.bestNow.gap}</td></tr>
      <tr><th scope="row">best so far</th><td class="num" data-testid="stat-best-so-far">{model!.stats.bestSoFar.length}</td><td class="num gap">{model!.stats.bestSoFar.gap}</td></tr>
      <tr><th scope="row">average</th><td class="num" data-testid="stat-average">{model!.stats.average.length}</td><td class="num gap">{model!.stats.average.gap}</td></tr>
      <tr class="sep"><th scope="row">optimum</th><td class="num" data-testid="stat-optimum">{model!.stats.optimum.length}</td><td class="note">{model!.stats.optimum.note}</td></tr>
      <tr><th scope="row">nearest neighbour</th><td class="num" data-testid="stat-nearest">{model!.stats.nearestNeighbour.length}</td><td class="num gap">{model!.stats.nearestNeighbour.gap}</td></tr>
    </tbody>
  </table>
  <p class="lkey rmgap">gap = how much longer than the optimum. Nearest neighbour = the shortest of the nearest-neighbour tours tried from every city as the start (here {model!.stats.nearestNeighbour.note}).</p>
{/snippet}

{#snippet keyLine()}
  <p class="lkey rmkey" data-testid="route-key">
    {#if model!.mark?.kind === 'crossover'}
      <span class="k k-shared">━</span> shared by both parents · <span class="k k-a">━</span> from A only · <span class="k k-b">╍</span> from B only · <span class="k k-new">┈</span> a new edge · <span class="k">◯</span> the kept slice
    {:else if model!.mark?.kind === 'mutation'}
      <span class="k k-rm">✕</span> removed edge (dashed) · <span class="k k-a">━</span> added edge · grey: unchanged · <span class="k">◯</span> the ends of the changed edges
    {:else}
      <span class="k k-best">━</span> best of the generation · <span class="k k-sel">┈</span> selected individual (click an id in the table) · faint lines: the population’s edges, thicker = more individuals use them · <span class="k">╍</span> optimal tour
    {/if}
  </p>
{/snippet}

{#snippet tourTable()}
  <!-- inside a box of its own: a whole 52-city route in one nowrap row must not widen the panel it is hidden in -->
  <div class="sr-only"><table aria-label="Tours on the map" data-testid="route-tours">
    <thead><tr><th scope="col">Tour</th><th scope="col">Individual</th><th scope="col">Route, from city 1</th><th scope="col">Length</th><th scope="col">Gap</th></tr></thead>
    <tbody>
      {#each model!.tours as t (t.role)}
        <tr><th scope="row">{t.role}</th><td>{t.id ?? '—'}</td><td>{t.route.split(' ').join(', ')}</td><td>{t.length}</td><td>{t.gap}%</td></tr>
      {/each}
    </tbody>
  </table></div>
{/snippet}

{#if info && model}
  {#if focused}
    <div class="rmview rmfocus" data-testid="route-map-view">
      {@render mapFrame()}
      <div class="rmo rmo-bar" data-testid="focus-toolbar">{@render toolbar()}</div>
      <div class="rmo rmo-card" data-testid="focus-card">
        {@render figures()}
        {@render keyLine()}
        {#if model.mark}<p class="lsent rmmark" data-testid="route-mark">{model.mark.sentence}</p>{/if}
      </div>
      {#if showGraph}<div class="rmo rmo-graph" data-testid="focus-graph"><MiniFitness model={session.plots} onhide={() => (showGraph = false)} /></div>{/if}
      <p class="sr-only" data-testid="route-sentence">{sentence}</p>
      {@render tourTable()}
    </div>
  {:else}
    <div class="rmview" data-testid="route-map-view">
      {@render toolbar()}
      <div class="rmrow">
        {@render mapFrame()}
        <div class="rmside">{@render figures()}</div>
      </div>
      {@render keyLine()}
      <p class="lsent" data-testid="route-sentence">{sentence}</p>
      {#if model.mark}<p class="lsent rmmark" data-testid="route-mark">{model.mark.sentence}</p>{/if}
      {@render tourTable()}
    </div>
  {/if}
{/if}

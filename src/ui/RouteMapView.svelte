<script lang="ts">
  import type { CrossoverEvent, MutationEvent } from '../engine';
  import { cityNumberSize, labelPlacement, wholeView } from './map-zoom';
  import { routeMapModel, type RouteMapInput } from './route-map-model';
  import type { Session } from './session.svelte';

  /**
   * The stage panel's second view for a TSP run: the cities as numbered dots, the population's edges (thicker where more
   * individuals use them), the best tour of the generation, the selected individual's tour and, on request, the optimal
   * tour; while crossover or mutation is stepped, the child's edges by origin or the edges a mutation took out and put in.
   * Every line is a `<line>` carrying its two cities, its layer and its count, so a test reads what is drawn.
   */
  let { session, showPopulation = $bindable(true), showOptimal = $bindable(false), showNumbers = $bindable(true) }: { session: Session; showPopulation?: boolean; showOptimal?: boolean; showNumbers?: boolean } = $props();

  const size = { width: 740, height: 292 };
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
  const view0 = wholeView(size);
  const labelSize = $derived(info ? cityNumberSize(info.cities, view0.zoom, showNumbers) : 0);
  const geo = $derived(info?.instance.rule === 'GEO');
  const mid = (a: number, b: number) => {
    const p = model!.nodes[a]!;
    const q = model!.nodes[b]!;
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  };
  const label = $derived(model ? `${model.sentence}${model.mark ? ` ${model.mark.sentence}` : ''}` : '');
</script>

{#if info && model}
  <div class="rmview" data-testid="route-map-view">
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
      <span class="lgrp key">gap = how much longer than the optimum</span>
    </div>
    <div class="rmrow">
      <svg class="rmmap" viewBox={`0 0 ${size.width} ${size.height}`} width={size.width} height={size.height} role="img" aria-label={label} data-testid="route-map" data-bestid={model.bestId}>
        {#each layers as layer (layer)}
          {@const group = model.edges.filter((e) => e.layer === layer)}
          {#if group.length > 0}
            <g class="re re-{layer}" class:dim={layer === 'population' && model.dimPopulation} data-layer={layer}>
              {#each group as e (e.key)}
                {@const p = model.nodes[e.a]!}
                {@const q = model.nodes[e.b]!}
                <line class="origin-{e.origin ?? 'none'}" x1={p.x} y1={p.y} x2={q.x} y2={q.y} data-edge={e.key} data-layer={layer} data-count={e.count} data-origin={e.origin} style={e.count !== undefined ? `stroke-width:${e.width}` : undefined} />
                {#if layer === 'removed'}<text class="cross" x={mid(e.a, e.b).x} y={mid(e.a, e.b).y} text-anchor="middle" dominant-baseline="central" aria-hidden="true">✕</text>{/if}
              {/each}
            </g>
          {/if}
        {/each}
        <g class="rn">
          {#each model.nodes as node (node.city)}
            <circle class="city" class:ringed={node.ringed} cx={node.x} cy={node.y} r={node.ringed ? 9 : 6} data-city={node.city + 1} data-ringed={node.ringed ? 'true' : undefined} />
            {#if labelSize > 0}
              {@const at = labelPlacement(node.x, node.y, String(node.city + 1), labelSize, size)}
              <text class="cl" x={at.x} y={at.y} text-anchor={at.anchor} font-size={labelSize} aria-hidden="true" data-label={node.city + 1}>{node.city + 1}</text>
            {/if}
          {/each}
        </g>
        <text class="axes" x={size.width - 8} y={size.height - 7} text-anchor="end" aria-hidden="true">{geo ? 'longitude → · latitude ↑' : 'x → · y ↑'}</text>
      </svg>
      <table class="atab st rmstats" aria-label="Lengths of this generation and of the two baselines">
        <caption>Generation {metrics.generation}</caption>
        <tbody>
          <tr><th scope="row">best now</th><td class="num" data-testid="stat-best-now">{model.stats.bestNow.length}</td><td class="num gap">{model.stats.bestNow.gap}</td></tr>
          <tr><th scope="row">best so far</th><td class="num" data-testid="stat-best-so-far">{model.stats.bestSoFar.length}</td><td class="num gap">{model.stats.bestSoFar.gap}</td></tr>
          <tr><th scope="row">average</th><td class="num" data-testid="stat-average">{model.stats.average.length}</td><td class="num gap">{model.stats.average.gap}</td></tr>
          <tr class="sep"><th scope="row">optimum</th><td class="num" data-testid="stat-optimum">{model.stats.optimum.length}</td><td class="note">{model.stats.optimum.note}</td></tr>
          <tr><th scope="row">nearest neighbour</th><td class="num" data-testid="stat-nearest">{model.stats.nearestNeighbour.length}</td><td class="num gap">{model.stats.nearestNeighbour.gap}</td></tr>
        </tbody>
      </table>
    </div>
    <p class="lkey rmkey" data-testid="route-key">
      {#if model.mark?.kind === 'crossover'}
        <span class="k k-shared">━</span> shared by both parents · <span class="k k-a">━</span> from A only · <span class="k k-b">╍</span> from B only · <span class="k k-new">┈</span> a new edge · <span class="k">◯</span> the kept slice
      {:else if model.mark?.kind === 'mutation'}
        <span class="k k-rm">✕</span> removed edge (dashed) · <span class="k k-a">━</span> added edge · grey: unchanged · <span class="k">◯</span> the ends of the changed edges
      {:else}
        <span class="k k-best">━</span> best of the generation · <span class="k k-sel">┈</span> selected individual (click an id in the table) · faint lines: the population’s edges, thicker = more individuals use them · <span class="k">╍</span> optimal tour
      {/if}
    </p>
    <p class="lsent" data-testid="route-sentence">{model.sentence}</p>
    {#if model.mark}<p class="lsent rmmark" data-testid="route-mark">{model.mark.sentence}</p>{/if}
    <!-- inside a box of its own: a whole 52-city route in one nowrap row must not widen the panel it is hidden in -->
    <div class="sr-only"><table aria-label="Tours on the map" data-testid="route-tours">
      <thead><tr><th scope="col">Tour</th><th scope="col">Individual</th><th scope="col">Route, from city 1</th><th scope="col">Length</th><th scope="col">Gap</th></tr></thead>
      <tbody>
        {#each model.tours as t (t.role)}
          <tr><th scope="row">{t.role}</th><td>{t.id ?? '—'}</td><td>{t.route.split(' ').join(', ')}</td><td>{t.length}</td><td>{t.gap}%</td></tr>
        {/each}
      </tbody>
    </table></div>
  </div>
{/if}

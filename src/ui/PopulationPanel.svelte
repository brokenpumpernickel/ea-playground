<script lang="ts">
  import Bits from './Bits.svelte';
  import BlockRow from './BlockRow.svelte';
  import { blockNotes } from './block-model';
  import CapacityBar from './CapacityBar.svelte';
  import ItemRow from './ItemRow.svelte';
  import { visibleColumns } from './landscape-cells';
  import { num } from './format';
  import { routeDetail, routeOf, tourHeader, wholeTourUpTo } from './tour-cells';
  import VariableRow from './VariableRow.svelte';
  import TargetRow from './TargetRow.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  const table = $derived(session.table);
  const display = $derived(session.display);
  const total = $derived(table.rows.reduce((sum, r) => sum + r.fitness, 0));
  const best = $derived(Math.max(...table.rows.map((r) => r.fitness)));
  const average = $derived(Math.round((total / table.rows.length) * 100) / 100);
  /**
   * The knapsack's table has no room for three columns about selection beside its own: Weight and Prob. appear only
   * while there are selection weights to show (roulette), and the parent count moves into the first column. Other
   * problems always show all three columns.
   */
  const knapsack = $derived(session.bag !== undefined);
  /** The trap's table is as narrow: selection columns only with roulette weights, and the parent count in the first column. */
  const blocks = $derived(session.blocks);
  /** The landscape's table is as narrow: the bits of a binary-coded chromosome are 20 or 24 cells wide. */
  const landscape = $derived(session.landscape);
  /** The TSP's table: tours as cells, the length, the gap and the fitness; selection columns only with roulette weights. */
  const tour = $derived(session.tour);
  const compact = $derived(knapsack || blocks !== undefined || landscape !== undefined || tour !== undefined);
  const selectable = $derived(landscape !== undefined || tour !== undefined);
  /** The route of the selected individual written out under the table: always there for a tour of more than 16 cities (which the cell shortens), otherwise once one is selected. */
  const selected = $derived(tour ? table.rows.find((r) => r.id === session.selectedId) : undefined);
  const detail = $derived(tour !== undefined && (selected !== undefined || tour.cities > wholeTourUpTo));
  const route = $derived(selected ? routeOf(selected.chromosome) : undefined);
  const written = $derived(route ? routeDetail(route.route) : undefined);
  const showSelection = $derived(!compact || table.rows.some((r) => r.weight !== undefined || r.probability !== undefined));
  /** With the selection columns on show beside the knapsack's own, or with more than fourteen items, the bars and the optional columns make way. */
  const tight = $derived((knapsack && (showSelection || display.chromosomeLength > 14)) || (blocks !== undefined && (showSelection || display.chromosomeLength > 20)));
  const kept = $derived(landscape ? new Set(visibleColumns(display.columns, landscape, showSelection)) : undefined);
  const columns = $derived(tour ? [] : display.columns.map((column, c) => ({ column, c })).filter(({ column }) => (kept ? kept.has(column) : !(tight && column.optional))));
  /**
   * The TSP's columns are five at fixed widths, so that nothing moves between micro-steps: while roulette weights are on show,
   * Weight and Prob. stand where Length and Gap stand otherwise (a length is minus the fitness, which stays).
   */
  const tourColumns = $derived.by(() => {
    if (!tour) return [];
    const [length, gap, fitness] = display.columns as [(typeof display.columns)[number], (typeof display.columns)[number], (typeof display.columns)[number]];
    const own = (column: typeof length, c: number) => ({ key: column.header.toLowerCase(), header: column.header, note: column.note, cell: (r: (typeof table.rows)[number]) => r.cells[c]! });
    return showSelection
      ? [
          { key: 'weight', header: 'Weight', note: 'for roulette', cell: (r: (typeof table.rows)[number]) => String(r.weight ?? '—') },
          { key: 'prob', header: 'Prob.', note: 'weight ÷ total', cell: (r: (typeof table.rows)[number]) => (r.probability === undefined ? '—' : r.probability.toFixed(3)) },
          own(fitness, 2),
        ]
      : [own(length, 0), own(gap, 1), own(fitness, 2)];
  });
</script>

<section class="panel" style="left:1136px;top:172px;width:760px;height:542px" aria-labelledby="pop-heading">
  <div class="ph">
    <h2 id="pop-heading">{table.title}</h2>
    <span class="r" data-testid="table-summary">{#if tour}{tourHeader(tour, table.rows.map((r) => r.fitness))}{:else}Σ fitness {num(total)} · avg {num(average)} · best {num(best)}{/if}</span>
  </div>
  <div class="tablewrap" class:withdetail={detail}>
    <table aria-labelledby="pop-heading" class:tight class:tsp={tour !== undefined} class:shortened={tour !== undefined && tour.cities > wholeTourUpTo}>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Chromosome{#if tour}<span class="colnote">{tour.cities} cities, in the order visited</span>{/if}<TargetRow /><ItemRow /><BlockRow /><VariableRow /></th>
          {#each columns as { column } (column.header)}
            <th scope="col" class="num" class:meter={column.meter}>{column.header}{#if column.note}<span class="colnote">{column.note}</span>{/if}</th>
          {/each}
          {#each tourColumns as column (column.key)}
            <th scope="col" class="num">{column.header}{#if column.note}<span class="colnote">{column.note}</span>{/if}</th>
          {/each}
          {#if showSelection && !tour}
            <th scope="col" class="num">Weight</th>
            <th scope="col" class="num">Prob.</th>
            {#if !compact}<th scope="col">Parent</th>{/if}
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each table.rows as row (row.id)}
          <tr class:sel={selectable && row.id === session.selectedId} data-id={row.id}>
            <td data-col="id"><span class="sym" title={row.elite ? 'Elite: carried over unchanged' : undefined}>{row.elite ? '★' : ''}</span>{#if selectable}{#if tour && row.id === session.selectedId}<span class="sym" aria-hidden="true">▸ </span>{/if}<button class="idbtn" type="button" aria-pressed={row.id === session.selectedId} aria-label={`Select individual ${row.id}`} data-testid="select-{row.id}" onclick={() => session.selectIndividual(row.id)}>{row.id}</button>{:else}{row.id}{/if}{#if compact && row.parentCount}<span class="parentmark" title="selected as a parent {row.parentCount} {row.parentCount === 1 ? 'time' : 'times'}" data-col="parent"><span class="sym" aria-hidden="true">◆</span>×{row.parentCount}</span>{/if}</td>
            <td><Bits chromosome={row.chromosome} small blockNotes={blocks ? blockNotes(blocks, row.chromosome) : []} /></td>
            {#each columns as { column, c } (column.header)}
              <td class="num" class:meter={row.meters?.[c]} data-col={column.header.toLowerCase()}>{#if row.meters?.[c]}<CapacityBar value={row.meters[c]!.value} limit={row.meters[c]!.limit} /> {/if}{row.cells[c]}</td>
            {/each}
            {#each tourColumns as column (column.key)}
              <td class="num" data-col={column.key}>{column.cell(row)}</td>
            {/each}
            {#if showSelection && !tour}
              <td class="num" data-col="weight">{row.weight ?? '—'}</td>
              <td class="num" data-col="prob">{row.probability === undefined ? '—' : row.probability.toFixed(3)}</td>
              {#if !compact}<td data-col="parent">{#if row.parentCount}<span class="sym" aria-hidden="true">◆</span>×{row.parentCount}{:else}<span class="muted">—</span>{/if}</td>{/if}
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if detail}
    <div class="seldetail" data-testid="route-detail" data-route={route ? route.route.join(' ') : undefined} aria-live="polite">
      {#if selected && route && written}<b>Individual {selected.id}</b> · canonical route {written.text} <span class="muted">· the chromosome starts at city {route.start}</span>{:else}<span class="muted">Click an individual’s number to write its route out in full here, starting from city 1.</span>{/if}
    </div>
  {/if}
  {#if tour}
    <table class="sr-only" aria-label="Tours of the population" data-testid="tours-table">
      <thead><tr><th scope="col">Individual</th><th scope="col">Route, in the order visited</th><th scope="col">Length</th><th scope="col">Gap</th><th scope="col">Role</th></tr></thead>
      <tbody>
        {#each table.rows as row (row.id)}
          <tr><th scope="row">{row.id}</th><td>{row.chromosome.split(' ').join(', ')}</td><td>{row.cells[0]}</td><td>{row.cells[1]}</td><td>{row.elite ? 'elite' : 'not an elite'}{row.parentCount ? `, chosen as a parent ${row.parentCount} ${row.parentCount === 1 ? 'time' : 'times'}` : ''}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<div id="legend" style="left:1136px;top:722px;width:760px"><span><b>★</b> elite</span><span><b>◆</b> parent</span><span><b>◇</b> offspring</span><span><b>✱</b> mutated {tour ? 'city' : 'gene'}</span>{#if tour}<span><b>▸</b> selected</span>{/if}<span><b>⤼</b> bypass</span><span><b>✕</b> discarded</span></div>

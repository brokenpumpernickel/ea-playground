<script lang="ts">
  import Bits from './Bits.svelte';
  import BlockRow from './BlockRow.svelte';
  import { blockNotes } from './block-model';
  import CapacityBar from './CapacityBar.svelte';
  import ItemRow from './ItemRow.svelte';
  import { visibleColumns } from './landscape-cells';
  import { num } from './format';
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
  const compact = $derived(knapsack || blocks !== undefined || landscape !== undefined);
  const showSelection = $derived(!compact || table.rows.some((r) => r.weight !== undefined || r.probability !== undefined));
  /** With the selection columns on show beside the knapsack's own, or with more than fourteen items, the bars and the optional columns make way. */
  const tight = $derived((knapsack && (showSelection || display.chromosomeLength > 14)) || (blocks !== undefined && (showSelection || display.chromosomeLength > 20)));
  const kept = $derived(landscape ? new Set(visibleColumns(display.columns, landscape, showSelection)) : undefined);
  const columns = $derived(display.columns.map((column, c) => ({ column, c })).filter(({ column }) => (kept ? kept.has(column) : !(tight && column.optional))));
</script>

<section class="panel" style="left:1136px;top:172px;width:760px;height:542px" aria-labelledby="pop-heading">
  <div class="ph">
    <h2 id="pop-heading">{table.title}</h2>
    <span class="r">Σ fitness {num(total)} · avg {num(average)} · best {num(best)}</span>
  </div>
  <div class="tablewrap">
    <table aria-labelledby="pop-heading" class:tight>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Chromosome<TargetRow /><ItemRow /><BlockRow /><VariableRow /></th>
          {#each columns as { column } (column.header)}
            <th scope="col" class="num" class:meter={column.meter}>{column.header}{#if column.note}<span class="colnote">{column.note}</span>{/if}</th>
          {/each}
          {#if showSelection}
            <th scope="col" class="num">Weight</th>
            <th scope="col" class="num">Prob.</th>
            {#if !compact}<th scope="col">Parent</th>{/if}
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each table.rows as row (row.id)}
          <tr class:sel={landscape !== undefined && row.id === session.selectedId} data-id={row.id}>
            <td data-col="id"><span class="sym" title={row.elite ? 'Elite: carried over unchanged' : undefined}>{row.elite ? '★' : ''}</span>{#if landscape}<button class="idbtn" type="button" aria-pressed={row.id === session.selectedId} aria-label={`Select individual ${row.id}`} data-testid="select-{row.id}" onclick={() => session.selectIndividual(row.id)}>{row.id}</button>{:else}{row.id}{/if}{#if compact && row.parentCount}<span class="parentmark" title="selected as a parent {row.parentCount} {row.parentCount === 1 ? 'time' : 'times'}" data-col="parent"><span class="sym" aria-hidden="true">◆</span>×{row.parentCount}</span>{/if}</td>
            <td><Bits chromosome={row.chromosome} small blockNotes={blocks ? blockNotes(blocks, row.chromosome) : []} /></td>
            {#each columns as { column, c } (column.header)}
              <td class="num" class:meter={row.meters?.[c]} data-col={column.header.toLowerCase()}>{#if row.meters?.[c]}<CapacityBar value={row.meters[c]!.value} limit={row.meters[c]!.limit} /> {/if}{row.cells[c]}</td>
            {/each}
            {#if showSelection}
              <td class="num" data-col="weight">{row.weight ?? '—'}</td>
              <td class="num" data-col="prob">{row.probability === undefined ? '—' : row.probability.toFixed(3)}</td>
              {#if !compact}<td data-col="parent">{#if row.parentCount}<span class="sym" aria-hidden="true">◆</span>×{row.parentCount}{:else}<span class="muted">—</span>{/if}</td>{/if}
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<div id="legend" style="left:1136px;top:722px;width:760px"><span><b>★</b> elite</span><span><b>◆</b> parent</span><span><b>◇</b> offspring</span><span><b>✱</b> mutated gene</span><span><b>⤼</b> bypass</span><span><b>✕</b> discarded</span></div>

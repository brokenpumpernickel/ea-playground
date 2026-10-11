<script lang="ts">
  import Bits from './Bits.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  const table = $derived(session.table);
  const display = $derived(session.display);
  const total = $derived(table.rows.reduce((sum, r) => sum + r.fitness, 0));
  const best = $derived(Math.max(...table.rows.map((r) => r.fitness)));
  const average = $derived(Math.round((total / table.rows.length) * 100) / 100);
</script>

<section class="panel" style="left:1136px;top:172px;width:760px;height:542px" aria-labelledby="pop-heading">
  <div class="ph">
    <h2 id="pop-heading">{table.title}</h2>
    <span class="r">Σ fitness {total} · avg {average} · best {best}</span>
  </div>
  <div class="tablewrap">
    <table aria-labelledby="pop-heading">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Chromosome</th>
          {#each display.columns as column (column.header)}
            <th scope="col" class="num">{column.header}{#if column.note}<span class="colnote">{column.note}</span>{/if}</th>
          {/each}
          <th scope="col" class="num">Weight</th>
          <th scope="col" class="num">Prob.</th>
          <th scope="col">Parent</th>
        </tr>
      </thead>
      <tbody>
        {#each table.rows as row (row.id)}
          <tr>
            <td data-col="id"><span class="sym" title={row.elite ? 'Elite: carried over unchanged' : undefined}>{row.elite ? '★' : ''}</span>{row.id}</td>
            <td><Bits chromosome={row.chromosome} small /></td>
            {#each display.columns as column, c (column.header)}
              <td class="num" data-col={column.header.toLowerCase()}>{row.cells[c]}</td>
            {/each}
            <td class="num" data-col="weight">{row.weight ?? '—'}</td>
            <td class="num" data-col="prob">{row.probability === undefined ? '—' : row.probability.toFixed(3)}</td>
            <td data-col="parent">{#if row.parentCount}<span class="sym" aria-hidden="true">◆</span>×{row.parentCount}{:else}<span class="muted">—</span>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<div id="legend" style="left:1136px;top:722px;width:760px"><span><b>★</b> elite</span><span><b>◆</b> parent</span><span><b>◇</b> offspring</span><span><b>✱</b> mutated gene</span><span><b>⤼</b> bypass</span><span><b>✕</b> discarded</span></div>

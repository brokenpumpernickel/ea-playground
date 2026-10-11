<script lang="ts">
  import Bits from './Bits.svelte';
  import ItemRow from './ItemRow.svelte';
  import TargetRow from './TargetRow.svelte';
  import { revealWhenCurrent } from './reveal';
  import type { EvaluationModel } from './outcome-models';

  let { model }: { model: EvaluationModel } = $props();
</script>

<div class="evaluation">
  <p class="expl">{model.explanation}</p>
  <div class="mwrap">
    <table class="mtable etable" aria-label="Evaluation of offspring">
      <thead>
        <tr>
          <th scope="col">Offspring</th>
          <th scope="col">Chromosome<TargetRow /><ItemRow /></th>
          {#each model.columns as column (column.header)}
            <th scope="col" class="num">{column.header}{#if column.note}<span class="colnote">{column.note}</span>{/if}</th>
          {/each}
          <th scope="col">Becomes</th>
        </tr>
      </thead>
      <tbody>
        {#each model.rows as row (row.offspring)}
          <tr use:revealWhenCurrent={row.current} class:hl={row.current} aria-current={row.current ? 'true' : undefined} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'}>
            <td><span class="who">O{row.offspring}</span></td>
            <td><Bits chromosome={row.bits} small flipped={row.flipped} /></td>
            {#if row.revealed}
              {#each model.columns as column, c (column.header)}
                <td class="num" class:strong={c === model.columns.length - 1} data-col={column.header.toLowerCase()}>{row.cells?.[c]}</td>
              {/each}
              <td data-col="id">individual {row.id}</td>
            {:else}
              <td class="muted" colspan={model.columns.length + 1}>not scored yet</td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

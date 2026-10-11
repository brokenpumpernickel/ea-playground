<script lang="ts">
  import type { Problem } from '../engine';
  import Bits from './Bits.svelte';
  import ItemRow from './ItemRow.svelte';
  import { parseChromosomes } from './drawer-model';

  let { text = $bindable(), problem, error }: { text: string; problem: Problem; error?: string } = $props();

  const rows = $derived(parseChromosomes(text, problem));
</script>

<div class="handpop" data-testid="hand-population">
  <textarea
    id="chromosomes"
    rows="5"
    spellcheck="false"
    aria-label="Chromosomes, one per line"
    aria-describedby={error ? 'chromosomes-error' : undefined}
    bind:value={text}
  ></textarea>
  <table aria-label="Hand-edited population">
    <thead><tr><th scope="col">#</th><th scope="col">Chromosome<ItemRow /></th>{#each problem.columns as column (column.header)}<th scope="col" class="num">{column.header}{#if column.note}<span class="colnote">{column.note}</span>{/if}</th>{/each}</tr></thead>
    <tbody>
      {#each rows as row, k (k)}
        <tr class:bad={row.error !== undefined} data-row={k + 1}>
          <td>{k + 1}</td>
          {#if row.error}
            <td colspan={problem.columns.length + 1} class="err">{row.text}</td>
          {:else}
            <td><Bits chromosome={row.text} small /></td>
            {#each problem.columns as column, c (column.header)}
              <td class="num" data-col={column.header.toLowerCase()}>{row.cells?.[c]}</td>
            {/each}
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
  {#if error}<p class="err" role="alert" id="chromosomes-error">{error}</p>{/if}
</div>

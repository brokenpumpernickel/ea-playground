<script lang="ts">
  import type { Problem } from '../engine';
  import Bits from './Bits.svelte';
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
    <thead><tr><th scope="col">#</th><th scope="col">Chromosome</th><th scope="col" class="num">x</th><th scope="col" class="num">Fitness</th></tr></thead>
    <tbody>
      {#each rows as row, k (k)}
        <tr class:bad={row.error !== undefined} data-row={k + 1}>
          <td>{k + 1}</td>
          {#if row.error}
            <td colspan="3" class="err">{row.text}</td>
          {:else}
            <td><Bits chromosome={row.text} small /></td>
            <td class="num" data-col="x">{row.decoded}</td>
            <td class="num" data-col="fitness">{row.fitness}</td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
  {#if error}<p class="err" role="alert" id="chromosomes-error">{error}</p>{/if}
</div>

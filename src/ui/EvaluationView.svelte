<script lang="ts">
  import Bits from './Bits.svelte';
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
          <th scope="col">Chromosome</th>
          <th scope="col" class="num">x</th>
          <th scope="col" class="num">Objective</th>
          <th scope="col" class="num">Fitness</th>
          <th scope="col">Becomes</th>
        </tr>
      </thead>
      <tbody>
        {#each model.rows as row (row.offspring)}
          <tr use:revealWhenCurrent={row.current} class:hl={row.current} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'}>
            <td><span class="who">O{row.offspring}</span></td>
            <td><Bits chromosome={row.bits} small flipped={row.flipped} /></td>
            {#if row.revealed}
              <td class="num" data-col="x">{row.decoded}</td>
              <td class="num" data-col="objective">{row.objective}</td>
              <td class="num strong" data-col="fitness">{row.fitness}</td>
              <td data-col="id">individual {row.id}</td>
            {:else}
              <td class="muted" colspan="4">not scored yet</td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

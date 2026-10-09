<script lang="ts">
  import Bits from './Bits.svelte';
  import { geneList, num } from './format';
  import { revealWhenCurrent } from './reveal';
  import type { MutationModel, MutationRow } from './variation-models';

  let { model }: { model: MutationModel } = $props();

  const genes = $derived(Array.from({ length: model.geneCount }, (_, k) => k + 1));
  const pm = $derived(num(model.threshold));

  const flipLabel = (row: MutationRow): string => {
    if (row.flipped.length === 1) {
      const g = row.flipped[0]! - 1;
      return `✱ gene ${row.flipped[0]}: ${row.before[g]} → ${row.after![g]}`;
    }
    return `✱ ${geneList(row.flipped)} flipped`;
  };
</script>

<div class="mutation">
  <p class="expl">{model.explanation}</p>
  <div class="mwrap">
    <table class="mtable" aria-label="Mutation draws">
      <thead>
        <tr>
          <th scope="col">Offspring</th>
          {#if model.mode === 'per-gene' && model.enabled}
            {#each genes as g (g)}<th scope="col" class="num">gene {g}</th>{/each}
          {:else if model.enabled}
            <th scope="col">Draw u</th>
            <th scope="col">Gene chosen</th>
          {/if}
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {#each model.rows as row (row.offspring)}
          <tr use:revealWhenCurrent={row.current} class:hl={row.current} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'}>
            <td><span class="who">O{row.offspring}</span> <Bits chromosome={row.before} small /></td>
            {#if model.mode === 'per-gene' && model.enabled}
              {#each genes as g (g)}
                {@const draw = row.geneDraws?.find((d) => d.gene === g)}
                <td class="num draw" class:flipcell={draw?.flipped} data-gene={g}>
                  {#if draw}{num(draw.u)}{#if draw.flipped} <span title="flipped: u is below pm">✱</span>{/if}{:else}<span class="muted">…</span>{/if}
                </td>
              {/each}
            {:else if model.enabled}
              <td class="draw">
                {#if row.individualDraw !== undefined}u = {num(row.individualDraw)} {row.chosenGene ? '<' : '≥'} pm {pm}{:else}<span class="muted">…</span>{/if}
              </td>
              <td class="draw" class:flipcell={row.chosenGene}>
                {#if row.chosenGene}gene {row.chosenGene.gene} (r = {num(row.chosenGene.r)}){:else if row.revealed}<span class="muted">—</span>{:else}<span class="muted">…</span>{/if}
              </td>
            {/if}
            <td class="result">
              {#if !row.revealed}
                <span class="muted">not yet drawn</span>
              {:else}
                <Bits chromosome={row.after!} small flipped={row.flipped} />
                {#if row.decision === 'mutated'}<span class="badge flip">{flipLabel(row)}</span>
                {:else if row.decision === 'bypassed'}<span class="badge bypass"><span aria-hidden="true">⤼</span> bypassed: mutation is off</span>
                {:else}<span class="muted">unchanged</span>{/if}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<script lang="ts">
  import Bits from './Bits.svelte';
  import { geneList, num } from './format';
  import { revealWhenCurrent } from './reveal';
  import TargetRow from './TargetRow.svelte';
  import type { MutationModel, MutationRow } from './variation-models';

  let { model }: { model: MutationModel } = $props();

  const genes = $derived(Array.from({ length: model.geneCount }, (_, k) => k + 1));
  const pm = $derived(num(model.threshold));

  const shown = (symbol: string) => (symbol === ' ' ? '␣' : symbol);
  /** With several symbols per gene each change says what the gene became and which draw r chose it. */
  const changed = (c: MutationRow['changes'][number]) => `gene ${c.gene}: ${shown(c.from)} → ${shown(c.to)}`;
  const flipLabel = (row: MutationRow): string => (row.flipped.length === 1 ? `✱ ${changed(row.changes[0]!)}` : `✱ ${geneList(row.flipped)} flipped`);
  /** Letters with a draw under each one, instead of a column per gene. */
  const underEach = $derived(model.multiSymbol && model.mode === 'per-gene' && model.enabled);
</script>

{#snippet outcome(row: MutationRow)}
  {#if row.decision === 'mutated'}
    <span class="badge flip">
      {#if model.multiSymbol}✱ {#each row.changes as c, k (c.gene)}{#if k > 0} · {/if}<span data-replacement={c.gene}>{changed(c)} <small>(r = {num(c.r!)})</small></span>{/each}
      {:else}{flipLabel(row)}{/if}
    </span>
  {:else if row.decision === 'bypassed'}<span class="badge bypass"><span aria-hidden="true">⤼</span> bypassed: mutation is off</span>
  {:else}<span class="muted">unchanged</span>{/if}
{/snippet}

<div class="mutation">
  <p class="expl">{model.explanation}</p>
  {#if underEach}
    <div class="mwrap mcards">
      <div class="crow ctarget"><span class="who"></span><TargetRow /></div>
      {#each model.rows as row (row.offspring)}
        <section use:revealWhenCurrent={row.current} class="card mcard" class:current={row.current} class:pending={!row.revealed} aria-current={row.current ? 'true' : undefined} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'} aria-label={`Offspring ${row.offspring}`}>
          <div class="crow">
            <span class="who">O{row.offspring}</span>
            <Bits chromosome={row.before} small flipped={row.flipped} unders={row.geneDraws?.map((d) => ({ text: num(d.u), flag: d.flipped, value: d.u }))} />
            {#if !row.revealed}<span class="muted">not yet drawn</span>{/if}
          </div>
          {#if row.revealed}
            <div class="crow">
              <span class="who sub">result</span>
              <Bits chromosome={row.after!} small flipped={row.flipped} />
              {@render outcome(row)}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {:else}
  <div class="mwrap">
    <table class="mtable" aria-label="Mutation draws">
      <thead>
        <tr>
          <th scope="col">Offspring<TargetRow /></th>
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
          <tr use:revealWhenCurrent={row.current} class:hl={row.current} aria-current={row.current ? 'true' : undefined} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'}>
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
                {@render outcome(row)}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
</div>

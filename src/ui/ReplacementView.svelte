<script lang="ts">
  import { getContext } from 'svelte';
  import Bits from './Bits.svelte';
  import BlockRow from './BlockRow.svelte';
  import { blockContextKey, type BlockGetter } from './block-context';
  import { blockNotes } from './block-model';
  import { num } from './format';
  import ItemRow from './ItemRow.svelte';
  import VariableRow from './VariableRow.svelte';
  import TargetRow from './TargetRow.svelte';
  import type { ReplacementModel } from './outcome-models';

  let { model }: { model: ReplacementModel } = $props();
  const getBlocks = getContext<BlockGetter | undefined>(blockContextKey);
  const blocks = $derived(getBlocks?.());
  const notes = (bits: string) => (blocks ? blockNotes(blocks, bits) : []);
</script>

<div class="replacement" data-state={model.revealed ? 'revealed' : 'pending'}>
  <p class="expl">{model.explanation}</p>
  <!-- a scrolling region must be reachable from the keyboard -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="rgrid" class:two={!model.showOld} class:duelgrid={model.duels !== undefined} tabindex="0" role="region" aria-label={model.showOld ? 'Replacement flow: old population, offspring, next population' : 'Replacement flow: offspring, next population'}>
    {#if model.showOld}
    <section class="rcol" aria-label="Old population">
      <div class="chead">Old population</div>
      <div class="rtarget"><TargetRow /><ItemRow /><BlockRow /><VariableRow /></div>
      {#each model.old as row (row.id)}
        <div class="rrow" class:dim={row.fate === 'replaced'} data-old={row.id} data-fate={row.fate}>
          <span class="who">#{row.id}</span>
          <Bits chromosome={row.bits} small form="brief" blockNotes={notes(row.bits)} />
          <span class="fit">{num(row.fitness)}</span>
          {#if row.fate === 'elite'}<span class="badge ok" title="elite: carried over unchanged" aria-label="elite, carried over unchanged">★</span>
          {:else if row.fate === 'kept'}<span class="badge ok" title="kept its place in its duel" aria-label="kept its place">✓ kept</span>
          {:else if row.fate === 'replaced'}<span class="badge x" title="replaced" aria-label="replaced">✕</span>{/if}
        </div>
      {/each}
    </section>
    {/if}

    {#if model.duels}
    <section class="rcol duelcol" aria-label="Duels of deterministic crowding" data-testid="duels">
      <h4>Duels <span class="muted">each child against the nearer of its parents; it takes the place only if strictly better</span></h4>
      <table aria-label="Duels, by pair" class="duelt">
        <thead><tr><th scope="col">Child</th><th scope="col">against</th><th scope="col" class="num">distance</th><th scope="col" class="num">fitness</th><th scope="col">result</th></tr></thead>
        {#each model.duels as pair (pair.pair)}
          <tbody data-pair={pair.pair}>
            <tr class="pairhead">
              <th scope="colgroup" colspan="5" data-testid="matching-{pair.pair}">Pair {pair.pair}: parents {pair.parentAId} and {pair.parentBId} · {pair.matching === 'straight' ? 'child 1 ↔ A, child 2 ↔ B' : pair.matching === 'crossed' ? 'child 1 ↔ B, child 2 ↔ A' : 'the one child ↔ the nearer parent'}{#if pair.totals}<small>total distance {num(pair.totals.straight)} straight, {num(pair.totals.crossed)} crossed: the smaller is chosen</small>{/if}</th>
            </tr>
            {#each pair.duels as d (d.childId)}
              <tr data-pair={pair.pair} data-child={d.childId} data-winner={d.winner}>
                <td>O{d.offspring} (#{d.childId})</td>
                <td>#{d.parentId}</td>
                <td class="num">{num(d.distance)}</td>
                <td class="num">{num(d.childFitness)} vs {num(d.parentFitness)}</td>
                <td class="res">{#if d.winner === 'child'}<b>child wins</b> <span aria-hidden="true">✓</span> · #{d.parentId} <span aria-hidden="true">✕</span>{:else}<b>#{d.parentId} stays</b> <span aria-hidden="true">✓</span> · O{d.offspring} <span aria-hidden="true">✕</span>{/if}</td>
              </tr>
            {/each}
          </tbody>
        {/each}
      </table>
    </section>
    {:else}
    <section class="rcol" aria-label="Offspring">
      <div class="chead">Offspring</div>
      {#if model.cutNote}<p class="cutnote">{model.cutNote}</p>{/if}
      <div class="rtarget"><TargetRow /><ItemRow /><BlockRow /><VariableRow /></div>
      {#each model.offspring as row (row.id)}
        <div class="rrow" class:dim={row.fate === 'discarded'} data-offspring={row.offspring} data-fate={row.fate}>
          <span class="who">O{row.offspring}</span>
          <Bits chromosome={row.bits} small form="brief" blockNotes={notes(row.bits)} />
          <span class="fit">{num(row.fitness)}</span>
          {#if row.fate === 'survives'}<span class="badge ok"><span aria-hidden="true">✓</span> survives</span>
          {:else if row.fate === 'discarded'}<span class="badge x"><span aria-hidden="true">✕</span> discarded</span>{/if}
          {#if row.rank}<span class="rank" title={row.note}>rank {row.rank}</span>{/if}
          {#if row.tie}<span class="note">tie on fitness at the cut: the offspring made earlier ranks first</span>{/if}
        </div>
      {/each}
    </section>
    {/if}

    <section class="rcol" aria-label="Next population">
      <div class="chead">Next population</div>
      <div class="rtarget"><TargetRow /><ItemRow /><BlockRow /><VariableRow /></div>
      {#if !model.revealed}
        <p class="muted">Not decided yet. Step to run replacement.</p>
      {/if}
      {#each model.next as row, k (row.id)}
        <div class="rrow" data-next={row.id} data-source={row.source}>
          <span class="who">{k + 1}.</span>
          <Bits chromosome={row.bits} small form="brief" blockNotes={notes(row.bits)} />
          <span class="fit">{num(row.fitness)}</span>
          {#if row.source === 'elite'}<span class="badge ok" title="elite carried over from the old population">★ #{row.id}</span>
          {:else if row.source === 'kept'}<span class="badge" title="the old individual kept its place in its duel">kept #{row.id}</span>
          {:else}<span class="badge" title="offspring {row.offspring}">◇ O{row.offspring}</span>{/if}
        </div>
      {/each}
    </section>
  </div>
  <p class="key"><b>★</b> elite · <b>✕</b> replaced or discarded · <b>✓</b> survives · <b>◇ On</b> = offspring n · number after the chromosome = fitness</p>
</div>

<script lang="ts">
  import Bits from './Bits.svelte';
  import { num } from './format';
  import { revealWhenCurrent } from './reveal';
  import type { MutationModel, MutationRow } from './variation-models';

  /** One offspring's mutation in a TSP run: the draw against pm, the move, the strips before and after, the edges and the length. */
  let { row, model }: { row: MutationRow; model: MutationModel } = $props();
  const notes = $derived(row.tour!);
  const pm = $derived(num(model.threshold));
</script>

<section use:revealWhenCurrent={row.current} class="card mcard tmcard" class:current={row.current} class:pending={!row.revealed} aria-current={row.current ? 'true' : undefined} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'} aria-label={`Offspring ${row.offspring}`}>
  <div class="crow thead2">
    <span class="who">O{row.offspring}</span>
    {#if !row.revealed}
      <span class="muted">not yet drawn</span>
    {:else if row.decision === 'bypassed'}
      <span class="badge bypass"><span aria-hidden="true">⤼</span> BYPASS</span><span class="muted">mutation is off: no draw</span>
    {:else}
      <span class="drawtext" data-testid="individual-draw">draw u = {num(row.individualDraw!)} {row.decision === 'mutated' ? '<' : '≥'} pm {pm} (one draw per individual) → <b>{row.decision}</b></span>
      {#if row.decision === 'mutated'}
        <span class="badge flip" data-testid="tour-move"><span aria-hidden="true">✱</span> {notes.moveText}</span>
        <span class="muted" data-testid="tour-draws">{notes.drawsText}</span>
      {/if}
    {/if}
  </div>
  {#if row.revealed && row.decision === 'mutated'}
    <div class="crow prow" data-testid="strip-before"><span class="who sub">before</span><Bits form="strip" chromosome={row.before} /></div>
    <div class="crow prow" data-testid="strip-after"><span class="who sub">after</span><Bits form="strip" chromosome={row.after!} flipped={row.flipped} /></div>
    <p class="edgeline" data-testid="tour-edges"><span class="rm">{notes.edgesText}</span> · <span data-testid="tour-length">{notes.lengthText}</span></p>
  {:else if row.revealed}
    <p class="edgeline" data-testid="tour-length">unchanged · {notes.lengthText}</p>
  {/if}
</section>

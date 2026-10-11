<script lang="ts">
  import Bits from './Bits.svelte';
  import MatingPool from './MatingPool.svelte';
  import { revealWhenCurrent } from './reveal';
  import type { PairingModel } from './selection-models';

  let { model }: { model: PairingModel } = $props();
</script>

<div class="pairing">
  <MatingPool pool={model.pool} />
  <div class="pgrid">
    {#each model.pairs as pair (pair.pair)}
      <section use:revealWhenCurrent={pair.current} class="card pcard" class:current={pair.current} aria-current={pair.current ? 'true' : undefined} class:pending={!pair.revealed} data-state={pair.revealed ? 'revealed' : 'pending'} aria-label={`Pair ${pair.pair}`}>
        <div class="thead">
          <b>Pair {pair.pair}</b>
          {#if !pair.revealed}<span class="muted">not paired yet</span>{/if}
          {#if pair.revealed && pair.secondChildDropped}<span class="badge flip">second child will be dropped</span>{/if}
        </div>
        {#if pair.revealed}
          <div class="parents">
            {#each [{ slot: pair.slotA, parent: pair.a }, { slot: pair.slotB, parent: pair.b }] as side (side.slot)}
              <div class="parent">
                <span class="muted">slot {side.slot} ← individual {side.parent.id}</span>
                <Bits chromosome={side.parent.bits} small />
                {#if typeof side.parent.x === 'number'}<span class="muted">x = {side.parent.x}</span>{/if}
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
  <ul class="notes">
    {#each model.notes as note (note)}<li>{note}</li>{/each}
  </ul>
</div>

<script lang="ts">
  import Bits from './Bits.svelte';
  import MatingPool from './MatingPool.svelte';
  import { revealWhenCurrent } from './reveal';
  import { num } from './format';
  import type { CrowdingSelectionModel } from './selection-models';

  /**
   * The selection stage of deterministic crowding: no selection pressure at all. Every individual becomes a parent exactly once,
   * in random order; each draw takes one of those still waiting, so the table below fills as the draws are stepped through.
   */
  let { model }: { model: CrowdingSelectionModel } = $props();
</script>

<div class="crowdsel" data-testid="crowding-selection">
  <p class="expl">
    Deterministic crowding has no selection pressure: every one of the {model.size} individuals becomes a parent exactly once, in random order. Each draw r takes position ⌊r × the number still waiting⌋ among those not yet taken{model.extra ? ', and because the population is odd one extra parent is then drawn from everyone to complete the last pair' : ''}. What decides who survives comes later: each child duels the nearer of its parents.
  </p>
  <ol class="draws" aria-label="Draws" data-testid="crowding-draws">
    {#each model.draws as d (d.draw)}
      <li use:revealWhenCurrent={d.current} class="drawcard" class:current={d.current} class:pending={!d.revealed} aria-current={d.current ? 'true' : undefined} data-draw={d.draw} data-state={d.revealed ? 'revealed' : 'pending'}>
        {#if d.revealed}
          <b>{d.extra ? 'Extra parent' : `Draw ${d.draw}`}</b>
          <span>r = {num(d.r!)} of {d.waiting} {d.extra ? 'individuals' : 'waiting'}</span>
          <span>→ individual {d.individualId}</span>
          <Bits chromosome={d.bits!} small form="brief" />
        {:else}
          <b>{d.extra ? 'Extra parent' : `Draw ${d.draw}`}</b> <span class="muted">not drawn</span>
        {/if}
      </li>
    {/each}
  </ol>
  <MatingPool pool={model.pool} />
</div>

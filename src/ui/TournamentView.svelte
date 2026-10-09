<script lang="ts">
  import Bits from './Bits.svelte';
  import MatingPool from './MatingPool.svelte';
  import { revealWhenCurrent } from './reveal';
  import { num } from './format';
  import type { TournamentModel } from './selection-models';

  let { model }: { model: TournamentModel } = $props();
</script>

<div class="tournament">
  <p class="expl">
    Tournament selection compares fitness directly, so the weight chain is not used. Each tournament draws {model.size} contestants with replacement, and the fittest wins a place in the mating pool.
  </p>
  <div class="tgrid">
    {#each model.cards as card (card.tournament)}
      <section use:revealWhenCurrent={card.current} class="card tcard" class:current={card.current} aria-current={card.current ? 'true' : undefined} class:pending={!card.revealed} data-tournament={card.tournament} data-state={card.revealed ? 'revealed' : 'pending'} aria-label={`Tournament ${card.tournament}`}>
        <div class="thead">
          <b>Tournament {card.tournament}</b>
          {#if card.revealed}
            <span class="badge ok">winner: individual {card.winnerId}</span>
            {#if card.tieBreak}<span class="badge flip" title="Different individuals shared the best fitness, so the lower population position won">tie-break</span>{/if}
          {:else}
            <span class="muted">not drawn</span>
          {/if}
        </div>
        {#if card.revealed}
          <ul class="contestants">
            {#each card.contestants as c, k (k)}
              <li data-winner={c.winner ? 'true' : undefined} class:win={c.winner}>
                <Bits chromosome={c.bits} small />
                <span>individual {c.id}</span>
                <span class="muted">fitness {num(c.fitness)}</span>
                {#if c.winner}<span aria-hidden="true">✓</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
  </div>
  <MatingPool pool={model.pool} />
</div>

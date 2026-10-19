<script lang="ts">
  import Bits from './Bits.svelte';
  import MatingPool from './MatingPool.svelte';
  import { revealWhenCurrent } from './reveal';
  import { num } from './format';
  import type { TournamentModel } from './selection-models';

  let { model }: { model: TournamentModel } = $props();
</script>

<div class="tournament">
  {#if model.comparesShared && model.sharing}
    <p class="expl" data-testid="sharing-expl">
      Fitness sharing: each tournament draws {model.size} contestants with replacement and compares their <b>shared weights</b>, the weight divided by the niche count (σ = {num(model.sharing.sigma)}, α = {num(model.sharing.alpha)}), so a crowded individual counts for less. {model.sharing.shifted ? 'Fitness is not positive everywhere, so it was shifted to positive first (fitness − lowest + 1). ' : ''}The highest shared weight wins a place in the mating pool.
    </p>
    <table class="sharetable" aria-label="Fitness, niche count and shared weight of every individual" data-testid="sharing-table">
      <thead>
        <tr><th scope="col">Ind.</th><th scope="col" class="num">Fitness</th>{#if model.sharing.shifted}<th scope="col" class="num">Shifted</th>{/if}<th scope="col" class="num">Niche count</th><th scope="col" class="num">Shared</th></tr>
      </thead>
      <tbody>
        {#each model.sharing.rows as row (row.id)}
          <tr data-row={row.id}><th scope="row">{row.id}</th><td class="num">{num(row.fitness)}</td>{#if model.sharing.shifted}<td class="num">{num(row.weight)}</td>{/if}<td class="num">{num(row.count)}</td><td class="num">{num(row.shared)}</td></tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="expl">
      Tournament selection compares fitness directly, so the weight chain is not used. Each tournament draws {model.size} contestants with replacement, and the fittest wins a place in the mating pool.
    </p>
  {/if}
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
                <Bits chromosome={c.bits} small form="brief" />
                <span>individual {c.id}</span>
                <span class="muted">{#if c.shared !== undefined}shared {num(c.shared)} (fitness {num(c.fitness)}){:else}fitness {num(c.fitness)}{/if}</span>
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

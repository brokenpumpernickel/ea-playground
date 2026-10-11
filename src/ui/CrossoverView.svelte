<script lang="ts">
  import { getContext } from 'svelte';
  import Bits from './Bits.svelte';
  import BlockRow from './BlockRow.svelte';
  import { blockContextKey, type BlockGetter } from './block-context';
  import { blockOriginNotes, blockOrigins, blockSplitSummary } from './block-model';
  import { geneList, num } from './format';
  import { revealWhenCurrent } from './reveal';
  import TargetRow from './TargetRow.svelte';
  import type { CrossoverModel, PairResult } from './variation-models';

  let { model }: { model: CrossoverModel } = $props();
  const getBlocks = getContext<BlockGetter | undefined>(blockContextKey);
  const blocks = $derived(getBlocks?.());
  /** What the cut did to the blocks, for a recombined pair of a trap (a bypass makes copies, so there is nothing to say). */
  const splitsOf = (pair: PairResult) => (blocks && pair.decision === 'recombined' && pair.children[0] ? blockSplitSummary(blockOrigins(blocks, pair.children[0].sources)) : undefined);

  const allB = (bits: string) => [...bits].map(() => 'B' as const);

  const outcome = (pair: PairResult): string => {
    if (pair.decision === 'recombined') {
      const where =
        pair.cuts.length === 1
          ? `cut after gene ${pair.cuts[0]}`
          : pair.cuts.length === 2
            ? `cuts after genes ${pair.cuts[0]} and ${pair.cuts[1]}`
            : pair.swapped.length > 0
              ? `${geneList(pair.swapped)} taken from the other parent`
              : 'no gene taken from the other parent';
      return `u = ${num(pair.draw!.u)} < pc ${num(pair.draw!.threshold)} → ${where}`;
    }
    return pair.reason === 'switched-off' ? 'crossover is off → children are copies' : `u = ${num(pair.draw!.u)} ≥ pc ${num(pair.draw!.threshold)} → children are copies`;
  };
</script>

<div class="crossover">
  <p class="expl">{model.explanation}</p>
  <div class="cgrid">
    {#each model.pairs as pair (pair.pair)}
      <section use:revealWhenCurrent={pair.current} class="card ccard" class:current={pair.current} aria-current={pair.current ? 'true' : undefined} class:pending={!pair.revealed} data-pair={pair.pair} data-state={pair.revealed ? 'revealed' : 'pending'} aria-label={`Pair ${pair.pair}`}>
        <div class="thead">
          <b>Pair {pair.pair}</b>
          {#if !pair.revealed}
            <span class="muted">not processed yet</span>
          {:else}
            {#if pair.decision === 'recombined'}<span class="badge ok"><span aria-hidden="true">✓</span> recombined</span>{:else}<span class="badge bypass"><span aria-hidden="true">⤼</span> BYPASS</span>{/if}
            <span class="muted">{outcome(pair)}</span>
            {#if splitsOf(pair)}{@const split = splitsOf(pair)!}<span class="badge" class:flip={split.split > 0} class:ok={split.split === 0} data-testid="block-split"><span aria-hidden="true">{split.split > 0 ? '◧' : '●'}</span> {split.text}</span>{/if}
          {/if}
        </div>
        {#if pair.revealed}
          <div class="cbody">
            <div class="cside">
              <div class="chead">Parents</div>
              <div class="crow ctarget"><span class="who"></span><TargetRow wide cuts={pair.cuts} /><BlockRow /></div>
              <div class="crow"><span class="who">A · individual {pair.parentA.id}</span><Bits chromosome={pair.parentA.bits} cuts={pair.cuts} /></div>
              <div class="crow"><span class="who">B · individual {pair.parentB.id}</span><Bits chromosome={pair.parentB.bits} cuts={pair.cuts} sources={allB(pair.parentB.bits)} /></div>
            </div>
            <div class="cside">
              <div class="chead">Children</div>
              <div class="crow ctarget"><span class="who"></span><TargetRow wide cuts={pair.cuts} /><BlockRow /></div>
              {#each pair.children as child (child.offspring)}
                <div class="crow" class:dropped={child.discarded} data-child={child.offspring} data-dropped={child.discarded ? 'true' : undefined}>
                  <span class="who">O{child.offspring} · {child.origin}</span>
                  <Bits chromosome={child.bits} cuts={pair.cuts} sources={child.sources} blockNotes={blocks && pair.decision === 'recombined' ? blockOriginNotes(blocks, child.sources) : []} />
                  {#if child.discarded}<span class="badge x"><span aria-hidden="true">✕</span> dropped (odd count)</span>{/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {/each}
  </div>
  <p class="key">plain gene = inherited from parent A · <b>hatched</b> gene = inherited from parent B · <b>dashed line</b> = cut point</p>
</div>

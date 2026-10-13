<script lang="ts">
  import { getContext } from 'svelte';
  import Bits from './Bits.svelte';
  import BlockRow from './BlockRow.svelte';
  import { blockContextKey, type BlockGetter } from './block-context';
  import { blockOriginNotes, blockOrigins, blockSplitSummary } from './block-model';
  import { formatReal } from '../engine';
  import { geneList, num } from './format';
  import { landscapeContextKey, type LandscapeGetter } from './landscape-context';
  import RealCrossoverCard from './RealCrossoverCard.svelte';
  import TourCrossoverCard from './TourCrossoverCard.svelte';
  import { revealWhenCurrent } from './reveal';
  import TargetRow from './TargetRow.svelte';
  import type { CrossoverModel, PairResult } from './variation-models';

  let { model }: { model: CrossoverModel } = $props();
  const getBlocks = getContext<BlockGetter | undefined>(blockContextKey);
  const blocks = $derived(getBlocks?.());
  const getLand = getContext<LandscapeGetter | undefined>(landscapeContextKey);
  const land = $derived(getLand?.());
  const f3 = (v: number) => formatReal([v], 3);
  const pointText = (p: { x: number; y: number }) => `(${f3(p.x)}, ${f3(p.y)})`;
  /** BLX-α and arithmetic crossover blend numbers: their card replaces the parents-and-children rows. */
  const blends = (pair: PairResult) => model.real && pair.decision === 'recombined' && (pair.blend !== undefined || pair.lambda !== undefined);
  /** What the cut did to the blocks, for a recombined pair of a trap (a bypass makes copies, so there is nothing to say). */
  const splitsOf = (pair: PairResult) => (blocks && pair.decision === 'recombined' && pair.children[0] ? blockSplitSummary(blockOrigins(blocks, pair.children[0].sources)) : undefined);

  const allB = (bits: string) => [...bits].map(() => 'B' as const);

  const outcome = (pair: PairResult): string => {
    if (pair.decision === 'recombined') {
      const where =
        pair.tour !== undefined
          ? pair.tour.operator.toUpperCase()
          : pair.blend !== undefined
          ? `BLX-α draws (α = ${num(pair.alpha ?? 0.5)})`
          : pair.lambda !== undefined
            ? `λ = ${num(pair.lambda)}`
            : pair.cuts.length === 1
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
            {#if pair.tour?.cutText}<span class="muted cuts" data-testid="tour-cut">{pair.tour.cutText}</span>{/if}
            {#if splitsOf(pair)}{@const split = splitsOf(pair)!}<span class="badge" class:flip={split.split > 0} class:ok={split.split === 0} data-testid="block-split"><span aria-hidden="true">{split.split > 0 ? '◧' : '●'}</span> {split.text}</span>{/if}
          {/if}
        </div>
        {#if pair.revealed && pair.tour}
          <TourCrossoverCard {pair} />
        {:else if pair.revealed && blends(pair)}
          <RealCrossoverCard {pair} bounds={land!.bounds} />
        {:else if pair.revealed}
          <div class="cbody">
            <div class="cside">
              <div class="chead">Parents</div>
              <div class="crow ctarget"><span class="who"></span><TargetRow wide cuts={pair.cuts} /><BlockRow /></div>
              <div class="crow"><span class="who">A · individual {pair.parentA.id}</span><Bits chromosome={pair.parentA.bits} cuts={pair.cuts} />{#if pair.parentA.point}<span class="dec" data-testid="decoded">→ {pointText(pair.parentA.point)}</span>{/if}</div>
              <div class="crow"><span class="who">B · individual {pair.parentB.id}</span><Bits chromosome={pair.parentB.bits} cuts={pair.cuts} sources={allB(pair.parentB.bits)} />{#if pair.parentB.point}<span class="dec" data-testid="decoded">→ {pointText(pair.parentB.point)}</span>{/if}</div>
            </div>
            <div class="cside">
              <div class="chead">Children</div>
              <div class="crow ctarget"><span class="who"></span><TargetRow wide cuts={pair.cuts} /><BlockRow /></div>
              {#each pair.children as child (child.offspring)}
                <div class="crow" class:dropped={child.discarded} data-child={child.offspring} data-dropped={child.discarded ? 'true' : undefined}>
                  <span class="who">O{child.offspring} · {child.origin}</span>
                  <Bits chromosome={child.bits} cuts={pair.cuts} sources={child.sources} blockNotes={blocks && pair.decision === 'recombined' ? blockOriginNotes(blocks, child.sources) : []} />
                  {#if child.point}<span class="dec" data-testid="decoded">→ {pointText(child.point)}</span>{/if}
                  {#if child.moved}<span class="dec moved" data-testid="moved">{f3(child.moved.fromA)} from A · {f3(child.moved.fromB)} from B</span>{/if}
                  {#if child.discarded}<span class="badge x"><span aria-hidden="true">✕</span> dropped (odd count)</span>{/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {/each}
  </div>
  {#if model.real && (model.operator === 'blx-alpha' || model.operator === 'arithmetic')}
    <p class="key"><b>●</b> parent · <b>▲</b> child · <b>dashed band</b> = the interval BLX-α draws from · <b>solid band</b> = between the parents · <b>▮</b> cut to a bound</p>
  {:else if model.tour}
    <!-- the card carries its own key: what plain, hatched, outlined and underlined mean depends on the operator -->
  {:else}
    <p class="key">plain gene = inherited from parent A · <b>hatched</b> gene = inherited from parent B · <b>dashed line</b> = cut point{#if land && land.representation !== 'real'} · <b>→</b> = the point the bits decode to, and how far each child is from each parent{/if}</p>
  {/if}
</div>

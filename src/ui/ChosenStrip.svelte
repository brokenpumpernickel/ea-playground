<script lang="ts">
  import { describeChosen, type ChosenShare } from './chosen-model';

  /** The knapsack's panel: a bar per item for how many of the population pack it, with its percentage and letter under it. */
  let { shares }: { shares: readonly ChosenShare[] } = $props();

  /** With more than fourteen items the bars are too narrow for "50%", so the figure is printed without its sign, in smaller type. */
  const dense = $derived(shares.length > 14);
</script>

<div class="matchbar chosen" class:dense role="img" aria-label={describeChosen(shares)}>
  {#each shares as share (share.position)}
    <div class="gene" data-item={share.letter} data-share={share.share}>
      <div class="bar" style="height:{Math.round(share.share * 60) + 4}px"></div>
      <b>{Math.round(share.share * 100)}{dense ? '' : '%'}</b>
      <span>{share.letter}</span>
    </div>
  {/each}
</div>

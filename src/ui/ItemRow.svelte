<script lang="ts">
  import { getContext } from 'svelte';
  import { itemName } from '../engine';
  import { bagContextKey, type BagGetter } from './bag-context';

  /**
   * The knapsack's items printed once above the chromosome columns, one column per gene: the item's letter with its
   * weight and value under it, so each cell lines up with the item it stands for. Draws nothing for other problems.
   */
  const getBag = getContext<BagGetter | undefined>(bagContextKey);
  const bag = $derived(getBag?.());
</script>

{#if bag}
  <div class="itemhdr" data-testid="item-row" role="img" aria-label={`Items: ${bag.items.map((item, i) => `${itemName(i)} weighs ${item.weight} and is worth ${item.value}`).join('; ')}`}>
    <span class="lbl" aria-hidden="true"><i>item</i><i>weight</i><i>value</i></span>
    <span class="itemrow" aria-hidden="true">{#each bag.items as item, i (i)}<span><b>{itemName(i)}</b><u>{item.weight}</u><s>{item.value}</s></span>{/each}</span>
  </div>
{/if}

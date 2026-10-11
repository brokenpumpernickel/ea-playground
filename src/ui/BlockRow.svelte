<script lang="ts">
  import { getContext } from 'svelte';
  import { blockContextKey, type BlockGetter } from './block-context';
  import { blockGeometry, drawExtra, groupWidth } from './block-geometry';
  import { blockRowLabels, blockRowSentence } from './block-model';

  /**
   * The trap's blocks printed once above the chromosome columns, as the knapsack's item row is: with tight linkage one
   * label over each group of cells, with loose linkage the number of the owning block over every gene. Draws nothing for
   * the other problems. The labels are hidden from screen readers, which get one sentence. `wide` is for the mutation
   * cards, where every gene's column is a little wider than its cell to make room for the draw printed under it.
   */
  let { wide = false }: { wide?: boolean } = $props();
  const getBlocks = getContext<BlockGetter | undefined>(blockContextKey);
  const info = $derived(getBlocks?.());
  const genes = $derived(info ? info.blockSize * info.blocks : 0);
  const geometry = $derived(blockGeometry(genes));
  const labels = $derived(info ? blockRowLabels(info) : []);
  const extra = $derived(wide ? drawExtra(genes) : 0);
  const style = $derived(`--bw:${geometry.cell}px;--bg:${geometry.gap}px;--bgg:${geometry.blockGap}px`);
</script>

{#if info}
  <div class="blkhdr" data-testid="block-row" role="img" aria-label={blockRowSentence(info)} {style}>
    <span class="lbl" aria-hidden="true"><i>block</i></span>
    {#if info.linkage === 'tight'}
      <span class="blkrow" aria-hidden="true">{#each labels as l, b (b)}<span class="brk" style="width:{groupWidth(info.blockSize, genes, extra)}px">{l.text}</span>{/each}</span>
    {:else}
      <span class="blkrow loose" aria-hidden="true">{#each labels as l, g (g)}<span class="bn b{(Number(l.text) - 1) % 2}" style="width:{geometry.cell + extra}px">{l.text}</span>{/each}</span>
    {/if}
  </div>
{/if}

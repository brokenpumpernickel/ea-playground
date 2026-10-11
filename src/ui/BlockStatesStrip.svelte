<script lang="ts">
  import { describeBlockStates, type BlockStatesModel } from './block-states-model';

  /**
   * The trap's panel beside the diversity plot: a bar for each block that splits the individuals into those with the
   * block at all ones (solid, ✓), in between (empty) and at all zeros, the deceptive attractor (hatched, ▽), with the
   * three figures printed. The figures sit in a column of fixed width and the bars share what is left, so nothing moves
   * when the numbers change. A line under them gives the history of the blocks at all zeros.
   */
  let { model }: { model: BlockStatesModel } = $props();

  /** One to ten blocks must fit the panel: each row is at most 22 px and at least 13 px high. */
  const rowHeight = $derived(Math.max(13, Math.min(22, Math.floor(130 / model.blocks.length))));
</script>

<div class="bstates" role="img" aria-label={describeBlockStates(model)} style="--bsrow:{rowHeight}px" data-testid="block-states">
  {#each model.blocks as c (c.block)}
    <div class="bsrow" data-block={c.block} data-optimum={c.optimum} data-between={c.between} data-attractor={c.attractor}>
      <b>block {c.block}</b>
      <span class="bsbar" aria-hidden="true">{#if c.optimum > 0}<i class="sg opt" style="flex:{c.optimum}"></i>{/if}{#if c.between > 0}<i class="sg mid" style="flex:{c.between}"></i>{/if}{#if c.attractor > 0}<i class="sg att" style="flex:{c.attractor}"></i>{/if}</span>
      <span class="bsnum" aria-hidden="true"><b>✓ {c.optimum}</b> · {c.between} · <b>▽ {c.attractor}</b></span>
    </div>
  {/each}
  <!-- the key needs a line the panel only has for up to five blocks; the marks ✓ and ▽ explain themselves in the figures and the sentence -->
  {#if model.blocks.length <= 5}<div class="bskey" aria-hidden="true"><span><b>✓</b> all ones</span><span>in between</span><span><b>▽</b> all zeros</span></div>{/if}
</div>
<p class="bshist" data-testid="block-history">{model.historyText}</p>

<!-- the same numbers as the bars and the history, for anyone who cannot read a chart -->
<table class="sr-only" aria-label="Blocks at all ones and at all zeros by generation" data-testid="block-states-table">
  <thead><tr><th>Generation</th><th>Blocks at all ones</th><th>Blocks at all zeros</th></tr></thead>
  <tbody>
    {#each model.history as h (h.generation)}<tr><td>{h.generation}</td><td>{h.optimum}</td><td>{h.attractor}</td></tr>{/each}
  </tbody>
</table>

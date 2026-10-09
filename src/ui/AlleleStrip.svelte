<script lang="ts">
  import { num } from './format';

  let { shares }: { shares: readonly number[] } = $props();
</script>

<div class="allele" role="img" aria-label={`Share of individuals with a 1 at each gene: ${shares.map((f, k) => `gene ${k + 1} ${num(Math.round(f * 100) / 100)}`).join(', ')}`}>
  {#each shares as share, k (k)}
    <div class="gene" data-gene={k + 1} data-share={share}>
      <div class="bar" style="height:{Math.round(share * 62) + 4}px"></div>
      <b>{share.toFixed(2)}</b>
      <span>gene {k + 1}</span>
    </div>
  {/each}
</div>

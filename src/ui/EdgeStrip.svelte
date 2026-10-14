<script lang="ts">
  import { agreementLine, bestEdgePairs } from './tour-cells';

  /**
   * The edge-agreement panel of a TSP run, in the place of the allele strip: one bar for each edge of the generation's best
   * tour, in the order of the tour, as tall as the share of the population that has that edge; the counts under the bars.
   */
  let { shares, route, size }: { shares: readonly number[]; route: readonly number[]; size: number } = $props();
  const pairs = $derived(bestEdgePairs(route));
  const edgeName = (k: number) => `${pairs[k]![0]}–${pairs[k]![1]}`;
  const labelled = $derived(shares.length <= 16);
  const count = (share: number) => Math.round(share * size);
</script>

<div class="edgebars" class:labelled role="img" aria-label={`Share of the ${size} individuals that have each edge of the best tour: ${shares.map((s, k) => `edge ${edgeName(k)} ${count(s)}`).join(', ')}`} data-testid="edge-bars">
  {#each shares as share, k (k)}
    <div class="eg" data-edge={`${pairs[k]![0]}-${pairs[k]![1]}`} data-share={share} data-count={count(share)} title={`edge ${edgeName(k)}: ${count(share)} of ${size}`}>
      <div class="bar" style="height:{Math.round(share * 56) + 3}px"></div>
      {#if labelled}<b>{share.toFixed(2)}</b>{/if}
    </div>
  {/each}
</div>
<p class="spkey">each bar: an edge of the best tour (in tour order), and the share of the population that has it (full height = all {size})</p>
<p class="sphist" data-testid="agreement-line">{agreementLine(shares)}</p>

<div class="sr-only">
  <table aria-label="Edge agreement of the best tour" data-testid="edge-table">
    <thead><tr><th scope="col">Edge (cities)</th><th scope="col">Individuals with it</th><th scope="col">Share</th></tr></thead>
    <tbody>
      {#each shares as share, k (k)}
        <tr><th scope="row">{edgeName(k)}</th><td>{count(share)} of {size}</td><td>{share.toFixed(2)}</td></tr>
      {/each}
    </tbody>
  </table>
</div>

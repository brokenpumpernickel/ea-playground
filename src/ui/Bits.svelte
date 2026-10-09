<script lang="ts">
  /** A chromosome drawn as one cell per gene. The whole thing is one image for screen readers, and carries the bit string for tests. */
  let { chromosome, small = false }: { chromosome: string; small?: boolean } = $props();
</script>

<span class="bits" role="img" aria-label={`Chromosome ${chromosome}`} data-bits={chromosome}>{#each [...chromosome] as bit, k (k)}<b class="bit" class:one={bit === '1'} class:sm={small} aria-hidden="true">{bit}</b>{/each}</span>

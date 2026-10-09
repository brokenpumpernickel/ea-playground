<script lang="ts">
  import { geneList } from './format';

  /**
   * A chromosome drawn as one cell per gene. The whole thing is one image for screen readers, and carries its bit string
   * (and any marks) as data attributes so tests can read exactly what is drawn.
   *
   * - `sources`: which parent each gene came from; genes from B are hatched.
   * - `cuts`: a dashed line after that many genes.
   * - `flipped`: 1-based genes marked as flipped by mutation.
   */
  let {
    chromosome,
    small = false,
    sources,
    cuts = [],
    flipped = [],
  }: { chromosome: string; small?: boolean; sources?: readonly ('A' | 'B')[]; cuts?: readonly number[]; flipped?: readonly number[] } = $props();

  const fromB = $derived(sources ? [...sources].flatMap((s, k) => (s === 'B' ? [k + 1] : [])) : []);
  const label = $derived(
    [
      `Chromosome ${chromosome}`,
      fromB.length > 0 ? `${geneList(fromB)} from parent B` : '',
      cuts.length > 0 ? `cut after ${geneList(cuts)}` : '',
      flipped.length > 0 ? `${geneList(flipped)} flipped` : '',
    ]
      .filter(Boolean)
      .join(', '),
  );
</script>

<span
  class="bits"
  role="img"
  aria-label={label}
  data-bits={chromosome}
  data-sources={sources ? sources.join('') : undefined}
  data-cuts={cuts.length > 0 ? cuts.join(',') : undefined}
  data-flipped={flipped.length > 0 ? flipped.join(',') : undefined}>{#each [...chromosome] as bit, k (k)}<b class="bit" class:one={bit === '1'} class:sm={small} class:hatch={sources?.[k] === 'B'} class:flip={flipped.includes(k + 1)} class:cutafter={cuts.includes(k + 1)} aria-hidden="true">{bit}</b>{/each}</span>

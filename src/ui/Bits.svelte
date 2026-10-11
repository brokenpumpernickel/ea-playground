<script lang="ts">
  import { getContext } from 'svelte';
  import { geneList } from './format';
  import { targetContextKey, type TargetGetter } from './target-context';

  /**
   * A chromosome drawn as one cell per gene. The whole thing is one image for screen readers, and carries its bit string
   * (and any marks) as data attributes so tests can read exactly what is drawn.
   *
   * - `sources`: which parent each gene came from; genes from B are hatched.
   * - `cuts`: a dashed line after that many genes.
   * - `flipped`: 1-based genes marked as flipped by mutation.
   * - `marks`: which genes are drawn filled and bold. By default that is every `1` (the binary problems); other problems
   *   say which genes, for example the ones that match a target.
   * - With a target string in the screen's context, each gene is compared with it: matching genes are filled with a
   *   heavy baseline, the others have a dashed outline (shape, not colour), and the description says how many match.
   * - `unders`: a short text under each gene (the mutation view's draws), with the genes it flags marked.
   * A space is drawn as `␣` so it is visible.
   */
  let {
    chromosome,
    small = false,
    sources,
    cuts = [],
    flipped = [],
    marks,
    unders,
  }: {
    chromosome: string;
    small?: boolean;
    sources?: readonly ('A' | 'B')[];
    cuts?: readonly number[];
    flipped?: readonly number[];
    marks?: readonly boolean[];
    unders?: readonly { readonly text: string; readonly flag: boolean; readonly value?: number }[];
  } = $props();

  const letters = $derived(!/^[01]*$/.test(chromosome));
  const getTarget = getContext<TargetGetter | undefined>(targetContextKey);
  const target = $derived(getTarget?.());
  /** Which genes match the target, when there is one (and no explicit marks were given). */
  const matched = $derived(!marks && target ? [...chromosome].map((c, k) => c === target[k]) : undefined);
  const matchCount = $derived(matched ? matched.filter(Boolean).length : undefined);

  const fromB = $derived(sources ? [...sources].flatMap((s, k) => (s === 'B' ? [k + 1] : [])) : []);
  /** A screen reader should say each letter, so letters are spelled out one by one and a space is named. */
  const spelled = $derived(letters ? [...chromosome].map((c) => (c === ' ' ? 'space' : c)).join(', ') : chromosome);
  const matchedAt = $derived(matched ? matched.flatMap((m, k) => (m ? [k + 1] : [])) : []);
  const positions = (list: readonly number[]) => `${list.length === 1 ? 'position' : 'positions'} ${list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`}`;
  const label = $derived(
    [
      // the letters end with a full stop so that the next fact is not read as one more letter
      `Chromosome ${spelled}${letters ? '.' : ''}`,
      matchCount !== undefined ? `${matchCount} of ${chromosome.length} positions match the target${matchedAt.length > 0 && matchedAt.length < chromosome.length ? ` (${positions(matchedAt)})` : ''}` : '',
      fromB.length > 0 ? `${geneList(fromB)} from parent B` : '',
      cuts.length > 0 ? `cut after ${geneList(cuts)}` : '',
      flipped.length > 0 ? `${geneList(flipped)} flipped` : '',
    ]
      .filter(Boolean)
      .join(', ')
      .replace('., ', '. '),
  );
</script>

{#snippet cell(bit: string, k: number)}<b class="bit" class:one={marks ? marks[k] : matched ? matched[k] : bit === '1'} class:match={matched?.[k] === true} class:miss={matched?.[k] === false} class:letter={letters} class:sm={small} class:hatch={sources?.[k] === 'B'} class:flip={flipped.includes(k + 1)} class:cutafter={cuts.includes(k + 1)} aria-hidden="true">{bit === ' ' ? '␣' : bit}</b>{/snippet}

<span
  class="bits"
  class:withunders={unders}
  role="img"
  aria-label={label}
  data-bits={chromosome}
  data-matches={matchCount}
  data-sources={sources ? sources.join('') : undefined}
  data-cuts={cuts.length > 0 ? cuts.join(',') : undefined}
  data-flipped={flipped.length > 0 ? flipped.join(',') : undefined}>{#each [...chromosome] as bit, k (k)}{#if unders}<span class="gcell">{@render cell(bit, k)}<span class="under" class:flag={unders[k]?.flag} data-gene={k + 1} data-u={unders[k]?.value} aria-hidden="true">{unders[k]?.text ?? ''}</span></span>{:else}{@render cell(bit, k)}{/if}{/each}</span>

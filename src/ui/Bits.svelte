<script lang="ts">
  import { getContext } from 'svelte';
  import { itemName } from '../engine';
  import { bagContextKey, type BagGetter } from './bag-context';
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
   * - With a knapsack in the screen's context, the cells are narrower, and a gene that is 1 but whose item is not in the
   *   bag (the first-fit decoder skipped it, or Baldwinian repair dropped it) is drawn as a ✕ in a dashed plain cell, with
   *   the description saying which items are packed, which are not, and the weight against the capacity.
   * - `dropped`: 1-based genes that Lamarckian repair rewrote to 0, marked with ✂ and a dotted outline.
   * - `unders`: a short text under each gene (the mutation view's draws), with the genes it flags marked.
   * A space is drawn as `␣` so it is visible.
   */
  let {
    chromosome,
    small = false,
    sources,
    cuts = [],
    flipped = [],
    dropped = [],
    marks,
    unders,
  }: {
    chromosome: string;
    small?: boolean;
    sources?: readonly ('A' | 'B')[];
    cuts?: readonly number[];
    flipped?: readonly number[];
    /** 1-based genes that repair rewrote from 1 to 0 (Lamarckian repair): marked with ✂ and a dotted outline. */
    dropped?: readonly number[];
    marks?: readonly boolean[];
    unders?: readonly { readonly text: string; readonly flag: boolean; readonly value?: number }[];
  } = $props();

  const letters = $derived(!/^[01]*$/.test(chromosome));
  const getTarget = getContext<TargetGetter | undefined>(targetContextKey);
  const target = $derived(getTarget?.());
  /** Which genes match the target, when there is one (and no explicit marks were given). */
  const matched = $derived(!marks && target ? [...chromosome].map((c, k) => c === target[k]) : undefined);
  const matchCount = $derived(matched ? matched.filter(Boolean).length : undefined);

  const getBag = getContext<BagGetter | undefined>(bagContextKey);
  const bag = $derived(getBag?.());
  const knap = $derived(bag !== undefined && /^[01]+$/.test(chromosome) && chromosome.length === bag.items.length);
  const outcome = $derived(knap ? bag!.outcomeOf([...chromosome].map(Number)) : undefined);
  /** Which genes are 1 although the item is not in the bag. */
  const skippedAt = $derived(outcome ? [...chromosome].flatMap((c, k) => (c === '1' && !outcome.packed[k] ? [k] : [])) : []);
  const packedLetters = $derived(outcome ? outcome.packed.flatMap((p, k) => (p ? [itemName(k)] : [])) : []);

  const fromB = $derived(sources ? [...sources].flatMap((s, k) => (s === 'B' ? [k + 1] : [])) : []);
  /** A screen reader should say each letter, so letters are spelled out one by one and a space is named. */
  const spelled = $derived(letters ? [...chromosome].map((c) => (c === ' ' ? 'space' : c)).join(', ') : chromosome);
  const matchedAt = $derived(matched ? matched.flatMap((m, k) => (m ? [k + 1] : [])) : []);
  const positions = (list: readonly number[]) => `${list.length === 1 ? 'position' : 'positions'} ${list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`}`;
  const label = $derived(
    [
      // the letters end with a full stop so that the next fact is not read as one more letter
      `Chromosome ${spelled}${letters ? '.' : ''}`,
      outcome ? `${packedLetters.length > 0 ? `bag: ${packedLetters.join(', ')}` : 'nothing in the bag'}, weight ${outcome.weight} of ${bag!.capacity}` : '',
      skippedAt.length > 0 ? `not in the bag although the gene is 1: ${skippedAt.map(itemName).join(', ')}` : '',
      matchCount !== undefined ? `${matchCount} of ${chromosome.length} positions match the target${matchedAt.length > 0 && matchedAt.length < chromosome.length ? ` (${positions(matchedAt)})` : ''}` : '',
      fromB.length > 0 ? `${geneList(fromB)} from parent B` : '',
      cuts.length > 0 ? `cut after ${geneList(cuts)}` : '',
      flipped.length > 0 ? `${geneList(flipped)} flipped` : '',
      dropped.length > 0 ? `${geneList(dropped)} dropped by repair, rewritten to 0` : '',
    ]
      .filter(Boolean)
      .join(', ')
      .replace('., ', '. '),
  );
</script>

{#snippet cell(bit: string, k: number)}<b class="bit" class:knap={knap} class:skip={skippedAt.includes(k)} class:one={marks ? marks[k] : matched ? matched[k] : bit === '1' && !skippedAt.includes(k)} class:match={matched?.[k] === true} class:miss={matched?.[k] === false} class:letter={letters} class:sm={small} class:hatch={sources?.[k] === 'B'} class:flip={flipped.includes(k + 1)} class:cut={dropped.includes(k + 1)} class:cutafter={cuts.includes(k + 1)} aria-hidden="true">{skippedAt.includes(k) ? '✕' : bit === ' ' ? '␣' : bit}</b>{/snippet}

<span
  class="bits"
  class:withunders={unders}
  role="img"
  aria-label={label}
  data-bits={chromosome}
  data-matches={matchCount}
  data-sources={sources ? sources.join('') : undefined}
  data-cuts={cuts.length > 0 ? cuts.join(',') : undefined}
  data-flipped={flipped.length > 0 ? flipped.join(',') : undefined}
  data-dropped={dropped.length > 0 ? dropped.join(',') : undefined}>{#each [...chromosome] as bit, k (k)}{#if unders}<span class="gcell">{@render cell(bit, k)}<span class="under" class:flag={unders[k]?.flag} data-gene={k + 1} data-u={unders[k]?.value} aria-hidden="true">{unders[k]?.text ?? ''}</span></span>{:else}{@render cell(bit, k)}{/if}{/each}</span>

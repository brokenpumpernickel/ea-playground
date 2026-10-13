<script lang="ts">
  import { getContext } from 'svelte';
  import { itemName } from '../engine';
  import { bagContextKey, type BagGetter } from './bag-context';
  import { blockContextKey, type BlockGetter } from './block-context';
  import { blockGeometry, drawExtra } from './block-geometry';
  import { blockSentence, type BlockNote } from './block-model';
  import { printAllDrawsUpTo } from './draw-text';
  import { geneList } from './format';
  import { bitsSentence, realPair, realSentence, variableGeometry } from './landscape-cells';
  import { landscapeContextKey, type LandscapeGetter } from './landscape-context';
  import { thumbnail, tourLabel, tourParts } from './tour-cells';
  import { tourContextKey, type TourGetter } from './tour-context';
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
   * - With a trap in the screen's context, the cells are laid out by block: tight linkage groups each block's genes (a
   *   bracket over the group, `blockNotes` printed under it); loose linkage keeps the genes in order and prints the
   *   notes as a line under the chromosome. The description gains a sentence about the blocks.
   * - With a real-valued landscape in the screen's context, the chromosome (the shown text of two numbers) is drawn as the
   *   pair (x, y), each number in a column of fixed width; a gene a mutation changed or one from parent B is marked on its number.
   * - With a binary-coded landscape in the context, the bits are drawn as two groups, the x bits and the y bits, and the
   *   description says what they decode to.
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
    clamped = [],
    marks,
    unders,
    blockNotes = [],
    wideColumns = false,
  }: {
    chromosome: string;
    small?: boolean;
    sources?: readonly ('A' | 'B')[];
    cuts?: readonly number[];
    flipped?: readonly number[];
    /** 1-based genes that repair rewrote from 1 to 0 (Lamarckian repair): marked with ✂ and a dotted outline. */
    dropped?: readonly number[];
    /** Real-valued landscape: 1-based genes cut to a bound by crossover or mutation, marked with ▮. */
    clamped?: readonly number[];
    marks?: readonly boolean[];
    unders?: readonly { readonly text: string; readonly flag: boolean; readonly value?: number }[];
    /** A note under each block of a trap chromosome (its mark and score, or what crossover did to it). */
    blockNotes?: readonly BlockNote[];
    /** The mutation card's top row: every gene's column is a little wider than its cell, whether or not the draws are printed yet. */
    wideColumns?: boolean;
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
  /** With more than fourteen items the cells are narrower still, so that twenty fit beside the table's other columns. */
  const dense = $derived(knap && chromosome.length > 14);
  const outcome = $derived(knap ? bag!.outcomeOf([...chromosome].map(Number)) : undefined);
  /** Which genes are 1 although the item is not in the bag. */
  const skippedAt = $derived(outcome ? [...chromosome].flatMap((c, k) => (c === '1' && !outcome.packed[k] ? [k] : [])) : []);
  const packedLetters = $derived(outcome ? outcome.packed.flatMap((p, k) => (p ? [itemName(k)] : [])) : []);

  const getBlocks = getContext<BlockGetter | undefined>(blockContextKey);
  const blocks = $derived(getBlocks?.());
  /** Whether this is a chromosome of the running trap (a binary string of the right length). */
  const blocked = $derived(blocks !== undefined && /^[01]+$/.test(chromosome) && chromosome.length === blocks.blockSize * blocks.blocks);
  const geometry = $derived(blocked ? blockGeometry(chromosome.length) : undefined);
  const blockStyle = $derived(geometry ? `--bw:${geometry.cell}px;--bh:${geometry.height}px;--bf:${geometry.font}px;--bg:${geometry.gap}px;--bgg:${geometry.blockGap}px;--bk:${blocks!.blockSize}${unders || wideColumns ? `;--bcw:${geometry.cell + drawExtra(chromosome.length)}px` : ''}` : undefined);
  const tightBlocks = $derived(blocked && blocks!.linkage === 'tight');
  const noteOf = (b: number) => blockNotes.find((n) => n.block === b + 1);

  const getTour = getContext<TourGetter | undefined>(tourContextKey);
  const tourInfo = $derived(getTour?.());
  /** The city numbers of this chromosome when it is a tour of the running TSP (the table of a permutation problem draws it so). */
  const tourCities = $derived.by(() => {
    if (!tourInfo || !/^\d+( \d+)*$/.test(chromosome)) return undefined;
    const cities = chromosome.split(' ').map(Number);
    return cities.length === tourInfo.cities ? cities : undefined;
  });
  const parts = $derived(tourCities ? tourParts(tourCities) : undefined);
  /** What a screen reader hears: the tour, then the marks the operator views put on it, as one more sentence. */
  const tourName = $derived.by(() => {
    if (!tourCities) return undefined;
    const marked = [fromB.length > 0 ? `${geneList(fromB)} from parent B` : '', cuts.length > 0 ? `cut after ${geneList(cuts)}` : '', flipped.length > 0 ? `${geneList(flipped)} changed by mutation` : ''].filter(Boolean).join(', ');
    return `${tourLabel(tourInfo!, tourCities.map((c) => c - 1))}${marked ? ` ${marked.charAt(0).toUpperCase()}${marked.slice(1)}.` : ''}`;
  });
  const picture = $derived(tourCities && parts && !parts.whole ? thumbnail(tourInfo!.places, tourCities.map((c) => c - 1)) : undefined);

  const getLand = getContext<LandscapeGetter | undefined>(landscapeContextKey);
  const land = $derived(getLand?.());
  /** The two numbers of a real-valued landscape chromosome, when this is one. */
  const pair = $derived(land?.representation === 'real' ? realPair(chromosome) : undefined);
  /** Whether this is a binary-coded landscape chromosome (a bit string of the right length): drawn as two groups of bits. */
  const varied = $derived(land !== undefined && land.representation !== 'real' && /^[01]+$/.test(chromosome) && chromosome.length === 2 * land.bits);
  const varGeometry = $derived(varied ? variableGeometry(land!.bits) : undefined);
  const varStyle = $derived(varGeometry ? `--vw:${varGeometry.cell}px;--vh:${varGeometry.height}px;--vf:${varGeometry.font}px;--vg:${varGeometry.gap}px;--vgg:${varGeometry.groupGap}px` : undefined);
  const numberClass = (gene: number) => `xv${flipped.includes(gene) ? ' flip' : ''}${sources?.[gene - 1] === 'B' ? ' hatch' : ''}${clamped.includes(gene) ? ' clamp' : ''}${cuts.includes(gene) ? ' cut' : ''}`;

  const fromB = $derived(sources ? [...sources].flatMap((s, k) => (s === 'B' ? [k + 1] : [])) : []);
  /** A screen reader should say each letter, so letters are spelled out one by one and a space is named. */
  const spelled = $derived(letters ? [...chromosome].map((c) => (c === ' ' ? 'space' : c)).join(', ') : chromosome);
  const matchedAt = $derived(matched ? matched.flatMap((m, k) => (m ? [k + 1] : [])) : []);
  const positions = (list: readonly number[]) => `${list.length === 1 ? 'position' : 'positions'} ${list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`}`;
  const label = $derived(
    [
      // the letters end with a full stop so that the next fact is not read as one more letter
      pair ? `Chromosome ${realSentence(pair)}` : varied ? `Chromosome ${bitsSentence(chromosome, land!)}` : `Chromosome ${spelled}${letters ? '.' : ''}`,
      blocked ? blockSentence(blocks!, chromosome) : '',
      outcome ? `${packedLetters.length > 0 ? `bag: ${packedLetters.join(', ')}` : 'nothing in the bag'}, weight ${outcome.weight} of ${bag!.capacity}` : '',
      skippedAt.length > 0 ? `not in the bag although the gene is 1: ${skippedAt.map(itemName).join(', ')}` : '',
      matchCount !== undefined ? `${matchCount} of ${chromosome.length} positions match the target${matchedAt.length > 0 && matchedAt.length < chromosome.length ? ` (${positions(matchedAt)})` : ''}` : '',
      fromB.length > 0 ? `${geneList(fromB)} from parent B` : '',
      cuts.length > 0 ? `cut after ${geneList(cuts)}` : '',
      flipped.length > 0 ? `${geneList(flipped)} flipped` : '',
      dropped.length > 0 ? `${geneList(dropped)} dropped by repair, rewritten to 0` : '',
      clamped.length > 0 ? `${geneList(clamped)} clamped to the bound` : '',
    ]
      .filter(Boolean)
      .join(', ')
      .replace('., ', '. '),
  );
</script>

{#snippet cell(bit: string, k: number)}<b class="bit" class:knap={knap} class:dense={dense} class:skip={skippedAt.includes(k)} class:one={marks ? marks[k] : matched ? matched[k] : bit === '1' && !skippedAt.includes(k)} class:match={matched?.[k] === true} class:miss={matched?.[k] === false} class:letter={letters} class:blocked={blocked} class:var={varied} class:sm={small} class:hatch={sources?.[k] === 'B'} class:flip={flipped.includes(k + 1)} class:cut={dropped.includes(k + 1)} class:cutafter={cuts.includes(k + 1)} aria-hidden="true">{skippedAt.includes(k) ? '✕' : bit === ' ' ? '␣' : bit}</b>{/snippet}

{#snippet gene(bit: string, k: number)}{#if unders || (wideColumns && blocked)}<span class="gcell">{@render cell(bit, k)}<span class="under" class:flag={unders?.[k]?.flag} data-gene={k + 1} data-u={unders?.[k]?.value} aria-hidden="true">{unders?.[k]?.text ?? ''}</span></span>{:else}{@render cell(bit, k)}{/if}{/snippet}

{#if tourCities}
  <span
    class="bits tourbits"
    class:trunc={!parts?.whole}
    role="img"
    aria-label={tourName}
    data-bits={chromosome}
    data-sources={sources ? sources.join('') : undefined}
    data-cuts={cuts.length > 0 ? cuts.join(',') : undefined}
    data-flipped={flipped.length > 0 ? flipped.join(',') : undefined}
    >{#if parts?.whole}{#each tourCities as city, k}<b class="bit sm tour" class:hatch={sources?.[k] === 'B'} class:flip={flipped.includes(k + 1)} class:cutafter={cuts.includes(k + 1)} aria-hidden="true">{city}</b>{/each}{:else if parts}<svg class="thumb" viewBox={`0 0 ${picture!.width} ${picture!.height}`} width={picture!.width} height={picture!.height} aria-hidden="true" data-path={picture!.path}><path d={picture!.path} /></svg><span class="seq" aria-hidden="true" data-testid="tour-shortened"><span data-part="head">{parts.head.join(' ')}</span> <span class="muted" data-part="hidden">… {parts.hidden} more …</span> <span data-part="tail">{parts.tail.join(' ')}</span></span>{/if}</span>
{:else}<span
  class="bits"
  class:withunders={unders}
  class:crowded={varied && unders !== undefined && chromosome.length > printAllDrawsUpTo}
  class:blocked
  class:vars={varied}
  class:pair={pair !== undefined}
  style={blockStyle ?? varStyle}
  role="img"
  aria-label={label}
  data-bits={chromosome}
  data-matches={matchCount}
  data-sources={sources ? sources.join('') : undefined}
  data-cuts={cuts.length > 0 ? cuts.join(',') : undefined}
  data-flipped={flipped.length > 0 ? flipped.join(',') : undefined}
  data-dropped={dropped.length > 0 ? dropped.join(',') : undefined}>{#if pair}<span class="xy"><span aria-hidden="true">(</span><span class={numberClass(1)}>{pair.x}</span><span aria-hidden="true">, </span><span class={numberClass(2)}>{pair.y}</span><span aria-hidden="true">)</span></span>{:else if varied}{#each [0, 1] as v (v)}<span class="vgrp" data-variable={v === 0 ? 'x' : 'y'}>{#each [...chromosome].slice(v * land!.bits, (v + 1) * land!.bits) as bit, j (j)}{@render gene(bit, v * land!.bits + j)}{/each}</span>{/each}{:else if tightBlocks}{#each blocks!.blockGenes as genes, b (b)}<span class="blk" data-block={b + 1}>{#each genes as g (g)}{@render gene(chromosome[g]!, g)}{/each}{#if noteOf(b)}<span class="bnote {noteOf(b)!.state}" aria-hidden="true">{noteOf(b)!.text}</span>{/if}</span>{/each}{:else}{#each [...chromosome] as bit, k (k)}{@render gene(bit, k)}{/each}{#if blocked && blockNotes.length > 0}<span class="bnotes" aria-hidden="true">{#each blockNotes as note (note.block)}<span class="bnote {note.state}">block {note.block}: {note.text}</span>{/each}</span>{/if}{/if}</span>{/if}

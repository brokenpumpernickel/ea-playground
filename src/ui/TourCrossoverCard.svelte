<script lang="ts">
  import Bits from './Bits.svelte';
  import type { PairResult } from './variation-models';

  /** One crossover pair of a TSP run: the parents and the children as strips of cities, with what the operator did to them. */
  let { pair }: { pair: PairResult } = $props();
  const notes = $derived(pair.tour!);
  const copies = $derived(pair.decision === 'bypassed');
  /**
   * A child's own parent is A for O1 and B for O2; a city taken from the other one is hatched (so a copy has no hatching, and a
   * child that keeps B's slice shows the cities it filled from A as hatched, as O1 shows those it filled from B).
   */
  const hatched = (own: 'A' | 'B', sources: readonly ('A' | 'B')[]) => sources.map((s) => (s === own ? ('A' as const) : ('B' as const)));
  /** OX: O1 keeps A's slice (solid), O2 keeps B's (dashed); PMX: O1 takes B's slice (dashed), O2 takes A's (solid). */
  const dashed = (k: number) => (notes.operator === 'pmx' ? k === 0 : k === 1);
</script>

<div class="tcard" data-testid="tour-card" data-operator={notes.operator} data-decision={pair.decision}>
  {#if notes.cycleText}<p class="cutline" data-testid="tour-cycles">{notes.cycleText}</p>{/if}
  {#if copies}<p class="cutline">no recombination: the children are copies of the parents</p>{/if}
  <div class="crow prow" data-testid="strip-A"><span class="who">A</span><Bits form="strip" chromosome={pair.parentA.bits} slice={notes.slice} cycles={notes.cycleOf} /></div>
  <div class="crow prow" data-testid="strip-B"><span class="who">B</span><Bits form="strip" chromosome={pair.parentB.bits} slice={notes.slice} sliceDashed cycles={notes.cycleOf} /></div>
  {#if notes.mappingText}
    <p class="maprow" data-testid="tour-mapping">{notes.mappingText}</p>
    <p class="maprow" data-testid="tour-example"><b>example:</b> {notes.exampleText}</p>
  {/if}
  {#each pair.children as child, k (child.offspring)}
    <div class="crow prow" class:dropped={child.discarded} data-child={child.offspring} data-dropped={child.discarded ? 'true' : undefined} data-testid="strip-O{child.offspring}">
      <span class="who">O{child.offspring}</span>
      <Bits form="strip" chromosome={child.bits} sources={hatched(k === 0 ? 'A' : 'B', child.sources)} slice={notes.slice} sliceDashed={dashed(k)} followed={notes.followed[k]} cycles={notes.cycleOf} />
    </div>
    <p class="fillnote" data-testid="child-note-{child.offspring}">{notes.childNotes[k]}{#if child.discarded} <span class="badge x"><span aria-hidden="true">✕</span> dropped (odd count)</span>{/if}</p>
  {/each}
  <p class="key tkey">{notes.key}</p>
  <p class="lengths" data-testid="tour-lengths">{notes.lengthsText}</p>
</div>

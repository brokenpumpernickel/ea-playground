<script lang="ts">
  import { getContext } from 'svelte';
  import { targetContextKey, type TargetGetter } from './target-context';

  /** `wide` for the full-size cells of the crossover cards; `cuts` leaves the same gap after the same genes as the strings below. */
  let { wide = false, cuts = [] }: { wide?: boolean; cuts?: readonly number[] } = $props();

  const getTarget = getContext<TargetGetter | undefined>(targetContextKey);
  const target = $derived(getTarget?.());
</script>

{#if target}
  <div class="tgtheader" data-testid="target-row" aria-label="The target is {target}"><span class="tgtlabel" aria-hidden="true">target</span><span class="tgtrow" class:wide aria-hidden="true">{#each [...target] as letter, k (k)}<span class:cutafter={cuts.includes(k + 1)}>{letter === ' ' ? '␣' : letter}</span>{/each}</span></div>
{/if}

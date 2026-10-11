<script lang="ts">
  import { getContext } from 'svelte';
  import { targetContextKey, type TargetGetter } from './target-context';

  const getTarget = getContext<TargetGetter | undefined>(targetContextKey);
  const target = $derived(getTarget?.());
</script>

{#if target}
  <div class="tgtheader" data-testid="target-row" aria-label="The target is {target}"><span class="tgtlabel" aria-hidden="true">target</span><span class="tgtrow" aria-hidden="true">{#each [...target] as letter, k (k)}<span>{letter === ' ' ? '␣' : letter}</span>{/each}</span></div>
{/if}

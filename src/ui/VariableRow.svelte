<script lang="ts">
  import { getContext } from 'svelte';
  import { groupWidth, variableGeometry, variableLabels, variableSentence } from './landscape-cells';
  import { landscapeContextKey, type LandscapeGetter } from './landscape-context';

  /**
   * The landscape's variables printed once above the chromosome columns, as the trap's block row is: for a binary-coded
   * chromosome one label over each group of bits ("x · 10 bits", "y · 10 bits") with a rule under it, for a real-valued one
   * a note that the chromosome is the pair (x, y). Draws nothing for the other problems. The labels are hidden from screen
   * readers, which get one sentence.
   */
  const getLand = getContext<LandscapeGetter | undefined>(landscapeContextKey);
  const info = $derived(getLand?.());
  const geometry = $derived(info && info.representation !== 'real' ? variableGeometry(info.bits) : undefined);
  const style = $derived(geometry ? `--vw:${geometry.cell}px;--vg:${geometry.gap}px;--vgg:${geometry.groupGap}px` : undefined);
</script>

{#if info && geometry}
  <div class="varhdr" data-testid="variable-row" role="img" aria-label={variableSentence(info)} {style}>
    <span class="vrow" aria-hidden="true">{#each variableLabels(info) as text (text)}<span class="vlab" style="width:{groupWidth(info.bits)}px">{text}</span>{/each}</span>
  </div>
{:else if info}
  <div class="varhdr" data-testid="variable-row" aria-hidden="true"><span class="vnote">(x, y)</span></div>
{/if}
